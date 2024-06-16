import {
  DfAliasedKeyConstruct,
  DfPrivateInstanceConstruct,
  DfPrivateInstanceConstructProps,
  DfSecurityGroupConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import { UobStack } from '../uobStack';
import { UobHelperStack } from '../uobHelperStack';
import {
  AccountDefinition,
  DfAccounts,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import {
  UobTierCtor,
  UobTierConstants,
  CreateUobTierNamedParameters,
  UobTierType,
} from './uobTierTypes';
import { Fn } from 'cdktf';
import path from 'path';
import { clusterProperties, tierProperties } from './uobEnvConfiguration';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import {
  SecurityGroup,
  SecurityGroupIngress,
} from '@cdktf/provider-aws/lib/security-group';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';

export enum TOKENS {
  fiName,
  envSubdomain,
  tier,
  instanceIndex,
}

/**
 * A class representing a UOB tier.
 */
export class UobTier {
  protected tier: UobTierType;
  protected tierConfiguration: tierProperties;
  protected sharedProperties: clusterProperties;
  protected count: number;
  protected ami: string;
  protected instanceType: string;
  protected volumes: {
    volumeName: string;
    volumeSize: number;
    deviceName: string;
    volumeKey?: DfAliasedKeyConstruct;
    encrypted?: boolean;
  }[];
  protected userDataParams: { [key: string]: string };
  protected securityGroupConstruct: DfSecurityGroupConstruct;

  protected helper: UobHelperStack;
  protected uobStack: UobStack;
  protected sopsData: PlatformSecrets;
  private instances: {
    hostname: string;
    instance: DfPrivateInstanceConstruct;
  }[] = [];
  private recoveryInstances: {
    hostname: string;
    instance: DfPrivateInstanceConstruct;
  }[] = [];

  private accountDefinition: AccountDefinition;
  private primarySecurityGroups: SecurityGroup[];
  private recoverySecurityGroups: SecurityGroup[];
  private legacySecurityGroups: SecurityGroup[];

  /**
   *
   * @param {UobTierCtor} param0
   * @param {UobHelperStack} param0.uobHelper
   * @param {UobStack} param0.uobStack
   * @param {PlatformSecrets} param0.sopsData
   */
  constructor({
    uobHelper,
    uobStack,
    sopsData,
    tierType: tier,
    tierConfiguration,
    sharedProperties,
    accountDefinition,
  }: UobTierCtor) {
    this.helper = uobHelper;
    this.uobStack = uobStack;
    this.sopsData = sopsData;
    this.tier = tier;
    this.tierConfiguration = tierConfiguration;
    this.sharedProperties = sharedProperties;
    this.accountDefinition = accountDefinition;

    this.setTierConfiguration();
  }

  /**
   *
   */
  private setTierConfiguration() {
    this.count = this.tierConfiguration.count;
    this.ami = this.tierConfiguration.ami;
    this.instanceType = this.tierConfiguration.instanceType;

    // Set encryption key if volume encryption is set to true
    this.volumes = this.tierConfiguration.volumes.map((volume) => {
      volume.encrypted = volume.encrypted ?? false;
      volume.volumeKey = volume.encrypted
        ? this.uobStack.kmsEncryptionKey
        : null;
      return volume;
    });

    this.tierParameters;
  }

  /**
   * @return {UobTierType}
   */
  public get tierName(): UobTierType {
    return this.tier;
  }

  /**
   * @return {Array<{instance: DfPrivateInstanceConstruct, hostname: string}>}
   */
  public createTierInstances(): {
    instance: DfPrivateInstanceConstruct;
    hostname: string;
  }[] {
    this.createInstances(this.tierParameters);
    return this.instances;
  }

  /**
   *
   * @param {UobTierConstants} tierConstants
   * @return {CreateUobTierNamedParameters}
   */
  protected defaultUobTierNamedParameters(tierConstants: UobTierConstants) {
    const uobTierParams: CreateUobTierNamedParameters = {
      tier: tierConstants.tier,
      tierOptions: {
        count: tierConstants.count,
        tierPorts: this.helper.getPortsForTier(tierConstants.tier),
      },
      instanceProps: {
        instanceResourceConfig: {
          ...this.helper.standardUobInstanceResourceConfig,
          ami: tierConstants.ami,
          instanceType: tierConstants.instanceType,
        },
        accountDefinition: this.uobStack.stackConfig.accountDefinition,
        options: {
          instanceProfileRole: this.helper.uobInstanceRole,
          userData: {
            templateEnabled: true,
            template: this.uobStack.getUserDataTemplateForTier(
              tierConstants.tier
            ),
            params: {
              ...this.helper.standardUobUserdataParams,
              efs_name: this.helper.uobEfs
                ? `${this.helper.uobEfs.node.id}-Efs`
                : null,
              ...tierConstants.userDataParams,
            },
          },
          volumes: tierConstants.volumes,
        },
      },
    };
    return uobTierParams;
  }

  /**
   * Creates instances for the given UOB tier.
   *
   * @param {CreateUobTierNamedParameters} params - The function parameters.
   */
  private createInstances(params: CreateUobTierNamedParameters) {
    const {
      tier,
      tierOptions: { count, tierIngresses, tierPorts },
      instanceProps,
    } = params;

    if (tierIngresses ?? tierPorts) {
      const cidrBlocks = Utils.getIngressCidrBlocksByNetworkType(
        this.accountDefinition
      );

      if (this.uobStack.primaryVpc) {
        this.primarySecurityGroups = this.createRegionalSecurityGroups(
          this.uobStack.primaryProvider,
          this.uobStack.primaryVpc,
          cidrBlocks,
          tier,
          tierPorts,
          tierIngresses
        );
        if (this.uobStack.recoveryVpc) {
          this.recoverySecurityGroups = this.createRegionalSecurityGroups(
            this.uobStack.recoveryProvider,
            this.uobStack.recoveryVpc,
            cidrBlocks,
            tier,
            tierPorts,
            tierIngresses,
            '-recovery'
          );
        }
      } else
        this.legacySecurityGroups = this.createRegionalSecurityGroups(
          this.uobStack.getProvider(),
          this.uobStack.vpc,
          cidrBlocks,
          tier,
          tierPorts,
          tierIngresses
        );
    }

    for (let i = 0; i < count; i++) {
      const instanceIndex = i < 9 ? `0${i + 1}` : `${i + 1}`;
      const constructName = this.tierConstructNameCallback(instanceIndex);
      const primaryHostname = this.tierHostnameCallback(instanceIndex, i);
      const recoveryHostname = this.tierHostnameCallback(
        instanceIndex,
        i,
        true
      );

      if (this.uobStack.primaryVpc) {
        this.setInstanceSg(instanceProps, this.primarySecurityGroups);
        this.createPrimaryInstance(
          instanceProps,
          this.uobStack.primaryVpc,
          constructName,
          primaryHostname,
          i
        );
        if (
          this.uobStack.recoveryVpc &&
          this.tierConfiguration.recoveryAmiIds
        ) {
          this.setInstanceSg(instanceProps, this.recoverySecurityGroups);
          this.createRecoveryInstance(
            instanceProps,
            this.uobStack.recoveryVpc,
            `${constructName}-recovery`,
            primaryHostname,
            recoveryHostname,
            i
          );
        }
      } else {
        this.setInstanceSg(instanceProps, this.legacySecurityGroups);
        this.createPrimaryInstance(
          instanceProps,
          this.uobStack.vpc,
          constructName,
          primaryHostname,
          i
        );
      }
    }
  }

  private createRegionalSecurityGroups(
    provider: AwsProvider,
    regionalVpc: DfSpokeVpcConstruct,
    cidrBlocks: string[],
    tier: UobTierType,
    tierPorts: {
      tcp: Array<number | [number, number]>;
      udp: Array<number | [number, number]>;
    },
    tierIngresses: SecurityGroupIngress[],
    suffix = ''
  ): SecurityGroup[] {
    const blocks = [...cidrBlocks];
    if (this.uobStack.primaryVpc) {
      blocks.push(this.uobStack.primaryVpc.vpcCidrBlock);
      if (this.uobStack.recoveryVpc) {
        blocks.push(this.uobStack.recoveryVpc.vpcCidrBlock);
      }
    } else {
      blocks.push(this.uobStack.vpc.vpcCidrBlock);
    }

    return blocks
      .filter((e) => !!e)
      .map((cidrBlock, index) => {
        const resourceId = `${this.sharedProperties.fiName}-${tier}-SG${suffix}-${index}`;
        const sg = new DfSecurityGroupConstruct(this.uobStack, resourceId, {
          provider: provider,
          name: resourceId,
          vpcConstruct: regionalVpc,
          ingressConfig: {
            useSingleIngress: true,
            ingressCidrBlock: cidrBlock,
          },
          extraPorts: tierPorts ?? {
            tcp: [],
            udp: [],
          },
          accountDefinition: this.accountDefinition,
          additionalIngress: [
            {
              description: 'Allow SSH from Tools Primary',
              fromPort: 22,
              toPort: 22,
              protocol: 'tcp',
              cidrBlocks: [
                DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'Allow all from PUPI CIDR Range',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary.additionalCidrs.join(
                  ','
                ),
              ],
            },
            ...tierIngresses,
          ],
        });
        return sg.securityGroupResource;
      });
  }

  private setInstanceSg(instanceProps, securityGroups) {
    if (securityGroups) {
      instanceProps.options.securityGroup = {
        resource: securityGroups,
      };
    }
  }

  private createPrimaryInstance(
    instanceProps: DfPrivateInstanceConstructProps,
    vpc: DfSpokeVpcConstruct,
    constructName: string,
    hostname: string,
    index = 0
  ) {
    // Checking for ami overrides and setting them here. Usin 'as string' because this attribute is readonly
    (instanceProps.instanceResourceConfig.ami as string) =
      this.tierAmiCallback(index);

    const subnetIndex = index % vpc.appSubnets.length;

    const userDataParams = {
      ...instanceProps.options.userData.params,
      instance_name: constructName,
      host_name: hostname,
      fi_name: this.sharedProperties.fiName,
      vpc_cidr: vpc.vpcCidrBlock,
    };

    instanceProps.instanceResourceConfig = {
      ...instanceProps.instanceResourceConfig,
      tags: {
        ...instanceProps.instanceResourceConfig.tags,
        hostname: hostname,
        Name: constructName,
        FiName: this.sharedProperties.fiName,
        'ansible-managed': this.sharedProperties.disableAnsibleManagement
          ? 'false'
          : 'true',
        application: this.helper.clusterType,
        tier: this.tier,
        fi_name: this.sharedProperties.fiName,
      },
    };

    const instanceConstruct = new DfPrivateInstanceConstruct({
      scope: this.uobStack,
      name: constructName,
      constructProps: {
        ...instanceProps,
        vpc,
        options: {
          ...instanceProps.options,
          subnet: { azIndex: subnetIndex },
          userData: {
            ...instanceProps.options.userData,
            templateEnabled: instanceProps.options.userData.templateEnabled,
            params: userDataParams,
          },
          provider: this.uobStack.getProvider(),
        },
      },
    });

    this.instances.push({
      instance: instanceConstruct,
      hostname: hostname,
    });
  }

  private createRecoveryInstance(
    instanceProps: DfPrivateInstanceConstructProps,
    vpc: DfSpokeVpcConstruct,
    constructName: string,
    primaryHostname: string,
    recoveryHostname: string,
    index = 0
  ) {
    // Checking for ami overrides and setting them here. Usin 'as string' because this attribute is readonly
    (instanceProps.instanceResourceConfig.ami as string) =
      this.tierConfiguration.recoveryAmiIds[index] ||
      this.tierAmiCallback(index);

    const subnetIndex = index % vpc.appSubnets.length;

    const userDataParams = {
      ...instanceProps.options.userData.params,
      instance_name: constructName,
      host_name: recoveryHostname,
      fi_name: this.sharedProperties.fiName,
      vpc_cidr: vpc.vpcCidrBlock,
    };

    instanceProps.instanceResourceConfig = {
      ...instanceProps.instanceResourceConfig,
      tags: {
        ...instanceProps.instanceResourceConfig.tags,
        hostname: recoveryHostname,
        Name: constructName,
        FiName: this.sharedProperties.fiName,
        'ansible-managed': this.sharedProperties.disableAnsibleManagement
          ? 'false'
          : 'true',
        application: 'uob',
        tier: this.tier,
        fi_name: this.sharedProperties.fiName,
      },
    };

    // Query for the most recent AMI matching the specified tags
    // Check if this thing^^^ is in AWS Backup.
    // If Yes get AMI ID and make a recoveryVersion of this thing^^^
    // use AMI ID as an override to this new Construct
    // RT is the exception. They are deployed as fresh instances, not from snapshots.
    // createVolumesInRecovery will create new volumes based on the env config file.
    // Usually we don't want to do this because the volume will already exist
    // on the AMIs created by AWS Backup, but recovery RT servers are not deployed from backups,
    // so we need to create the volumes.

    if (this.tierConfiguration.recoveryAmiIds?.[index]) {
      const recoveryInstance = new DfPrivateInstanceConstruct({
        scope: this.uobStack,
        name: constructName,
        constructProps: {
          ...instanceProps,
          vpc,
          options: {
            ...instanceProps.options,
            volumes: this.tierConfiguration.createVolumesInRecovery
              ? this.tierConfiguration.volumes.map((volume) => {
                  return {
                    ...volume,
                    volumeKey: this.uobStack.kmsEncryptionKeyRecovery,
                  };
                })
              : [],
            subnet: { azIndex: subnetIndex },
            userData: {
              ...instanceProps.options.userData,
              templateEnabled: instanceProps.options.userData.templateEnabled,
              params: userDataParams,
            },
            provider: this.uobStack.recoveryProvider,
            recoveredInstance: true,
          },
        },
      });

      /**
       * Servers deployed from primary region backups contain an entry in /etc/hosts for the primary region
       * ip address. The recovery entry should be the primary and recovery dns resolving to the recovery ip.
       * RT servers are not deployed from backups, so we don't need to include the primary dns record.
       */
      const etcHostsEntryValue =
        this.tier === 'rt'
          ? `${recoveryInstance.instanceResource.privateIp} ${recoveryHostname}.${this.helper.standardUobUserdataParams.sub_domain} ${recoveryHostname}`
          : `${recoveryInstance.instanceResource.privateIp} ${recoveryHostname}.${this.helper.standardUobUserdataParams.sub_domain} ${recoveryHostname} ${primaryHostname}.${this.helper.standardUobUserdataParams.sub_domain} ${primaryHostname}`;

      new SsmParameter(this.uobStack, `${recoveryHostname}-ansible-param`, {
        provider: this.uobStack.recoveryProvider,
        name: `${recoveryHostname}_etc_hosts_entry`,
        value: etcHostsEntryValue,
        type: 'String',
      });

      this.recoveryInstances.push({
        instance: recoveryInstance,
        hostname: recoveryHostname,
      });
    }
  }

  /**
   * @return {CreateUobTierNamedParameters}
   */
  public get tierParameters(): CreateUobTierNamedParameters {
    const params = this.defaultUobTierNamedParameters({
      tier: this.tier,
      count: this.count,
      ami: this.ami,
      instanceType: this.instanceType,
      volumes: this.volumes,
      userDataParams: this.userDataParams,
    });
    params.instanceProps.instanceResourceConfig = {
      ...params.instanceProps.instanceResourceConfig,
      userDataReplaceOnChange:
        this.tierConfiguration.instanceResourceConfig.userDataReplaceOnChange,
      disableApiStop:
        this.tierConfiguration.instanceResourceConfig.disableApiStop,
      disableApiTermination:
        this.tierConfiguration.instanceResourceConfig.disableApiTermination,
      userData: this.tierConfiguration.userDataFileName
        ? Fn.file(
            `${path.resolve(__dirname, 'buildAssets/scripts')}/${
              this.tierConfiguration.userDataFileName
            }`
          )
        : null,
      keyName:
        this.tierConfiguration.instanceResourceConfig.keyName ??
        params.instanceProps.instanceResourceConfig.keyName,
      lifecycle: this.tierConfiguration.instanceResourceConfig.lifecycle,
      tags: this.tierConfiguration.instanceResourceConfig.tags,
      rootBlockDevice:
        this.tierConfiguration.instanceResourceConfig.rootBlockDevice ??
        params.instanceProps.instanceResourceConfig.rootBlockDevice,
    };

    params.instanceProps.options.userData.templateEnabled =
      this.tierConfiguration.templateEnabled;
    params.tierOptions.tierIngresses = this.tierConfiguration.tierIngresses;

    if (this.helper.isProdLikeCustomer()) {
      params.tierOptions.tierIngresses.push(this.helper.sharedAccountIngress);
    }

    return params;
  }

  /**
   *
   * @param {string} instanceIndex
   * @param {number} loopIndex
   * @param {boolean} isDrInstance
   * @return {string}
   */
  protected tierHostnameCallback(
    instanceIndex: string,
    loopIndex: number,
    isDrInstance?: boolean
  ): string {
    let hostname: string;
    if (this.tierConfiguration.hostnamePatternOverride) {
      hostname = this.tierConfiguration.hostnamePatternOverride[loopIndex];
    } else if (this.tierConfiguration.hostnamePattern) {
      hostname = this.tierConfiguration.hostnamePattern
        .replace('${UobTier.TOKENS.tier}', this.tier)
        .replace('${UobTier.TOKENS.fiName}', this.sharedProperties.fiName)
        .replace(
          '${UobTier.TOKENS.envSubdomain}',
          this.uobStack.stackConfig.envSubdomain
        )
        .replace('${UobTier.TOKENS.instanceIndex}', instanceIndex);
    } else {
      hostname = `${this.sharedProperties.fiName}${this.uobStack.stackConfig.envSubdomain}${this.tier}${instanceIndex}`;
    }

    if (isDrInstance) {
      hostname = `${hostname}-dr`;
    }

    return hostname;
  }

  /**
   *
   * @param {string} instanceIndex
   * @return {string}
   */
  protected tierConstructNameCallback(instanceIndex: string): string {
    return this.sharedProperties.constructNamePattern
      ? this.sharedProperties.constructNamePattern
          .replace('${UobTier.TOKENS.tier}', this.tier)
          .replace('${UobTier.TOKENS.instanceIndex}', instanceIndex)
          .replace('${UobTier.TOKENS.fiName}', this.sharedProperties.fiName)
          .replace(
            '${UobTier.TOKENS.envSubdomain}',
            this.uobStack.stackConfig.envSubdomain
          )
      : `${this.sharedProperties.fiName}-${this.tierName}-${instanceIndex}`;
  }

  /**
   *
   * @param {number} loopIndex
   * @return {string}
   */
  protected tierAmiCallback(loopIndex: number): string {
    return (
      this.tierConfiguration?.amiPatternOverride?.[loopIndex] ??
      this.tierConfiguration.ami
    );
  }

  /**
   *
   * @return {DfSecurityGroupConstruct}
   */
  public getSecurityGroup(): DfSecurityGroupConstruct {
    return this.securityGroupConstruct;
  }

  /**
   *
   * @return {string}
   */
  public getInstanceCidrBlock(): string {
    return this.uobStack.primaryVpc
      ? this.uobStack.primaryVpc.vpcCidrBlock
      : this.uobStack.vpc.vpcCidrBlock;
  }

  public getRecoveryInstances() {
    return this.recoveryInstances;
  }
}
