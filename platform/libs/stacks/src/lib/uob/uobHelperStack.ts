import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { RemoteStack, StackConfig, UobTierType } from '../stacks';
import {
  CustomerObjectSubnet,
  DfEfsConstruct,
  DfKeyPairConstruct,
  DfPsqlRdsConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DbParameterGroupConfig } from '@cdktf/provider-aws/lib/db-parameter-group';
import { provider as LocalProvider } from '@cdktf/provider-local';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import { SecurityGroupIngress } from '@cdktf/provider-aws/lib/security-group';
import { DataAwsSsmParameter } from '@cdktf/provider-aws/lib/data-aws-ssm-parameter';
import { SecretsmanagerSecret } from '@cdktf/provider-aws/lib/secretsmanager-secret';
import { SecretsmanagerSecretVersion } from '@cdktf/provider-aws/lib/secretsmanager-secret-version';

export type ClusterType = 'uob' | 'dbs';

interface UobReplicaConfig {
  recoveryVpc: DfSpokeVpcConstruct;
  replicateKey?: boolean;
}

interface StandardUobIamRoleNamedParams {
  resourceName: string;
  envName: string;
}

interface UobInstanceKeyProps {
  constructName?: string;
  keyName: string;
  parameterStoreNameOverride?: string;
}

interface UobEfsProps {
  constructName: string;
  vpc: DfSpokeVpcConstruct;
  backupPolicy?: string;
}

interface IPsqlRdsConfig {
  vpc: DfSpokeVpcConstruct;
  allowedCidrBlocks: string[];
  rdsInstanceName: string;
  dbVersion: string;
  allocatedStorage: number;
  instanceClass: string;
  dbName?: string;
  username?: string;
  password: string;
  multiAz?: boolean;
  backupPolicy?: string;
  customerData?: 'true' | 'false';
  finalSnapshotName?: string;
  iops?: number;
  autoMinorVersionUpgrade: boolean;
  paramaterGroupConfig?: DbParameterGroupConfig;
  dbDnsName: string;
  region: Constants.AWS_REGION_ALIASES;
  accountProviderConfig: AccountProviderConfig;
  performanceInsightsEnabled?: boolean;
}

interface ansibleConfigMangementVariables {
  privateKeySsmParameterName?: string;
  prodServiceAccounts: boolean;
  sharedBuildKeyParameterName?: string;
  upfDatabaseFqdns?: string[];
  upfDatabaseFqdnsDr?: string[];
}

interface secretKeyConfig {
  name: string;
  numberOfPublicKeys: number;
  numberOfPrivateKeys: number;
}

interface uobHelperStackConfig {
  regionAlias: Constants.AWS_REGION_ALIASES;
  stackName?: string;
  uobReplicaConfig?: UobReplicaConfig;
  customerObjectSubnet?: CustomerObjectSubnet[];
  ansibleManaged?: boolean;
  clusterType?: ClusterType;
  ansibleVars?: ansibleConfigMangementVariables;
  keyProps?: UobInstanceKeyProps;
  roleProps?: StandardUobIamRoleNamedParams;
  efsProps?: UobEfsProps;
  createProdLikeResourcesNewWay?: boolean;
  secretKeyConfgs?: secretKeyConfig[];
}

/**
 * A stack for resources intended to be shared for all UOB deployments in a given account.
 */
export class UobHelperStack extends RemoteStack {
  private static readonly STACK_NAME = 'Shared-Uob';

  private sharedInstanceRoleResource: IamRole = undefined;
  private sharedInstanceKeyConstruct: DfKeyPairConstruct = undefined;
  private sharedEfsConstruct: DfEfsConstruct = undefined;
  private provider: AwsProvider;
  private uobReplicaConfig: UobReplicaConfig;
  private customerObjectSubnets: CustomerObjectSubnet[];
  private ansibleManaged: boolean;
  private _clusterType: ClusterType;
  public readonly sharedAccountIngress: SecurityGroupIngress;
  public readonly createProdLikeResourcesNewWay: boolean;

  /**
   * @param {StackConfig} stackConfig - Stack Config
   * @param {uobHelperStackConfig} config - Configuration for the UOB Helper Stack
   */
  constructor(
    protected stackConfig: StackConfig,
    config: uobHelperStackConfig
  ) {
    super(
      config.stackName ? config.stackName : UobHelperStack.STACK_NAME,
      stackConfig
    );

    this._clusterType = config.clusterType ? config.clusterType : 'uob';
    this.customerObjectSubnets = config.customerObjectSubnet;
    this.uobReplicaConfig = config.uobReplicaConfig;
    this.createProdLikeResourcesNewWay = config.createProdLikeResourcesNewWay;
    // Retrieves the current provider based on the region passed in
    this.provider = this.getProviderForRegion(config.regionAlias);
    new LocalProvider.LocalProvider(this, `LocalProvider`);
    new NullProvider(this, `NullProvider`);

    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    this.createSecretObjects(config);

    // allows for creating key at instantiation instead of after
    if (config.keyProps && !config.ansibleVars.privateKeySsmParameterName) {
      const keyPair = this.createUobInstanceKey(config.keyProps);
      config.ansibleVars.privateKeySsmParameterName =
        keyPair.keyPairParameter.name;
    }

    if (config.roleProps) {
      this.createUobInstanceRole(config.roleProps);
    }

    if (config.efsProps) {
      this.createUobEfs(config.efsProps);
    }

    // TODO: https://dragonflyft.atlassian.net/browse/AE-910
    if (this.isProdLikeCustomer()) {
      [this.primaryProvider, this.recoveryProvider].forEach((provider) => {
        const sharedAccountProvider = this.createAwsProvider({
          forAccount: Utils.getSharedAccountProviderConfig(
            this.stackConfig.accountDefinition
          ),
          supportedRegion: Utils.getRegionAliasFromRegion(provider.region),
        });

        const sharedBldPubKey = new DataAwsSsmParameter(
          this,
          `shared-bld-pub-key-${provider.alias}-lookup`,
          {
            name: 'shared-bld-pub-key',
            provider: sharedAccountProvider,
          }
        );

        new SsmParameter(
          this,
          `shared-bld-pub-key-${Utils.getRegionAliasFromRegion(
            provider.region
          )}`,
          {
            provider: provider,
            name: `shared-bld-pub-key`,
            type: 'SecureString',
            value: sharedBldPubKey.value,
            tags: { Name: 'shared-bld-pub-key' },
          }
        );

        config.ansibleVars.sharedBuildKeyParameterName = sharedBldPubKey.name;
      });

      this.sharedAccountIngress = {
        description: `Allow inbound traffic from shared ${this.stackConfig.accountDefinition.accountType} primary and recovery`,
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        cidrBlocks: DfAccounts.getSharedAccountCidrByAccountType(
          this.stackConfig.accountDefinition.accountType
        ),
      };
    }

    /**
     * * These variables are only used for UOB clusters
     * * We don't want them to be created for other cluster types
     */
    if (config.ansibleVars && this._clusterType === 'uob') {
      const providers = [this.provider];
      if (this.uobReplicaConfig) {
        providers.push(this.recoveryProvider);
      }
      const password = config.ansibleVars.prodServiceAccounts
        ? sopsData.PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS
        : sopsData.NON_PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS;

      const uobConfigManagementVariables = {
        private_key_parameter_name:
          config.ansibleVars.privateKeySsmParameterName,
        us_finame_pw: password.app.usfiname,
        mqm_pw: password.mq.mqm,
        usrsvs_pw: password.msi.usrsvs,
        usrrpt_pw: password.rpt.usrrpt,
        ihsadmin_pw: password.web.ihsadmin,
        build_key_name: config.ansibleVars.sharedBuildKeyParameterName || null,
        upf_database_fqdns: config.ansibleVars.upfDatabaseFqdns || null,
      };

      providers.forEach((provider, index) => {
        Object.entries(uobConfigManagementVariables).forEach(([key, value]) => {
          if (value != null) {
            if (
              config.regionAlias != Constants.AWS_REGION_ALIASES.LEGACY &&
              provider.region === this.recoveryProvider.region &&
              key === 'upf_database_fqdns' &&
              config.ansibleVars.upfDatabaseFqdnsDr
            ) {
              value = config.ansibleVars.upfDatabaseFqdnsDr;
            }
            new SsmParameter(this, `${key}-ssm-param-${index}`, {
              provider: provider,
              name: key,
              type: key.includes('pw') ? 'SecureString' : 'String',
              value: Array.isArray(value) ? value.join(',') : value,
            });
          }
        });
      });
    }
  }

  private createSecretObjects(config: uobHelperStackConfig) {
    if (config.secretKeyConfgs) {
      config.secretKeyConfgs.forEach((secretConfig) => {
        Array(secretConfig.numberOfPrivateKeys)
          .fill(0)
          .forEach((item, index) => {
            const secret = new SecretsmanagerSecret(
              this,
              `secrets-manager-${secretConfig.name}-private-key-${index + 1}`,
              {
                provider: this.provider,
                name: `${secretConfig.name}-private-key-${index + 1}`,
              }
            );
            new SecretsmanagerSecretVersion(
              this,
              `secrets-manager-version-${secretConfig.name}-private-key-${
                index + 1
              }`,
              {
                provider: this.provider,
                secretId: secret.id,
                secretString: 'default',
                lifecycle: {
                  ignoreChanges: ['secret_string'],
                },
              }
            );
          });
        Array(secretConfig.numberOfPublicKeys)
          .fill(0)
          .forEach((item, index) => {
            const secret = new SecretsmanagerSecret(
              this,
              `secrets-manager-${secretConfig.name}-public-key-${index + 1}`,
              {
                provider: this.provider,
                name: `${secretConfig.name}-public-key-${index + 1}`,
              }
            );
            new SecretsmanagerSecretVersion(
              this,
              `secrets-manager-version-${secretConfig.name}-public-key-${
                index + 1
              }`,
              {
                provider: this.provider,
                secretId: secret.id,
                secretString: 'default',
                lifecycle: {
                  ignoreChanges: ['secret_string'],
                },
              }
            );
          });
      });
    }
  }

  /**
   * Creates an Iam role and assigns it
   * @param {StandardUobIamRoleNamedParams} props
   * @return {IamRole}
   */
  public createUobInstanceRole(props: StandardUobIamRoleNamedParams) {
    if (this.sharedInstanceRoleResource) {
      return this.sharedInstanceRoleResource;
    }

    this.sharedInstanceRoleResource = new IamRole(this, props.resourceName, {
      provider: this.provider,
      name: [props.envName, props.resourceName].join('-'),
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonElasticFileSystemReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonVPCReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
      ],
      inlinePolicy: [
        {
          name: 'ansible-ec2-tagging',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ec2:CreateTags',
                  'ec2:DeleteTags',
                  'ec2:DescribeTags',
                ],
                Resource: '*',
              },
            ],
          }),
        },
      ],
      tags: { Name: [props.envName, props.resourceName].join('-') },
    });

    return this.sharedInstanceRoleResource;
  }

  /**
   *
   * @param {UobInstanceKeyProps} props
   * @return {DfKeyPairConstruct}
   */
  public createUobInstanceKey(props: UobInstanceKeyProps): DfKeyPairConstruct {
    if (this.sharedInstanceKeyConstruct) {
      return this.sharedInstanceKeyConstruct;
    }

    if (this._clusterType === 'uob') {
      new SsmParameter(this, `${props.keyName}-ssm-param`, {
        provider: this.provider,
        name: 'key_pair_name',
        type: 'String',
        value: props.keyName,
      });
    }

    this.sharedInstanceKeyConstruct = new DfKeyPairConstruct(
      this,
      props.constructName,
      {
        keyName: props.keyName,
        provider: this.provider,
        recoveryProvider: this.uobReplicaConfig?.replicateKey
          ? this.recoveryProvider
          : undefined,
      }
    );

    if (Utils.isSharedAccount(this.stackConfig.accountDefinition)) {
      [this.primaryProvider, this.recoveryProvider].forEach((provider) => {
        new SsmParameter(
          this,
          `${
            this.stackConfig.accountDefinition.alias
          }-bld-pub-key-param-${Utils.getRegionAliasFromRegion(
            provider.region
          )}`,
          {
            provider: provider,
            name: 'shared-bld-pub-key',
            type: 'String',
            value: this.sharedInstanceKeyConstruct.getPubKey(),
          }
        );
      });
    }
    return this.sharedInstanceKeyConstruct;
  }

  /**
   *
   * @param {UobEfsProps} props
   * @return {DfEfsConstruct}
   */
  public createUobEfs(props: UobEfsProps) {
    if (this.sharedEfsConstruct) {
      console.log('EFS already exists skipping...');
      return this.sharedEfsConstruct;
    }

    this.sharedEfsConstruct = new DfEfsConstruct(this, props.constructName, {
      provider: this.provider,
      vpc: props.vpc,
      cidrBlocks: [props.vpc.vpcCidrBlock],
      backupPolicy: props.backupPolicy,
      replicaConfig: this.uobReplicaConfig
        ? {
            recoveryProvider: this.recoveryProvider,
            recoveryVpc: this.uobReplicaConfig.recoveryVpc,
          }
        : null,
    });

    new SsmParameter(this, 'efs-dns-name-ssm-param', {
      provider: this.provider,
      name: 'efs_address',
      type: 'String',
      value: this.sharedEfsConstruct.efsAddress,
    });

    if (this.uobReplicaConfig) {
      new SsmParameter(this, 'efs-dns-name-ssm-param-recovery', {
        provider: this.recoveryProvider,
        name: 'efs_address',
        type: 'String',
        value: `${this.sharedEfsConstruct.replicationConfig.destination.fileSystemId}.efs.${Constants.AWS_REGION_MAP.DFRECOVERY}.amazonaws.com`,
      });
    }

    return this.sharedEfsConstruct;
  }

  /**
   *
   * @param {UobClusterNodeType} tier
   * @return {{tcp: Array<number | [number, number]>, udp: Array<number | [number, number]>}}
   */
  public getPortsForTier(tier: UobTierType): {
    tcp: Array<number | [number, number]>;
    udp: Array<number | [number, number]>;
  } {
    if (this._clusterType === 'uob') {
      switch (tier) {
        case 'app': {
          return {
            tcp: Constants.UOB_PORTS_APP_TCP,
            udp: Constants.UOB_PORTS_APP_UDP,
          };
        }
        case 'bld': {
          return {
            tcp: Constants.UOB_PORTS_BLD_TCP,
            udp: Constants.UOB_PORTS_BLD_UDP,
          };
        }
        case 'mq': {
          return {
            tcp: Constants.UOB_PORTS_MQ_TCP,
            udp: Constants.UOB_PORTS_MQ_UDP,
          };
        }
        case 'lbs': {
          return {
            tcp: Constants.UOB_PORTS_LBS_TCP,
            udp: Constants.UOB_PORTS_LBS_UDP,
          };
        }
        case 'msi': {
          return {
            tcp: Constants.UOB_PORTS_MSI_TCP,
            udp: Constants.UOB_PORTS_MSI_UDP,
          };
        }
        case 'rpt': {
          return {
            tcp: Constants.UOB_PORTS_RPT_TCP,
            udp: Constants.UOB_PORTS_RPT_UDP,
          };
        }
        case 'rt': {
          return {
            tcp: Constants.UOB_PORTS_UPF_TCP,
            udp: Constants.UOB_PORTS_UPF_UDP,
          };
        }
        case 'web': {
          return {
            tcp: Constants.UOB_PORTS_WEB_TCP,
            udp: Constants.UOB_PORTS_WEB_UDP,
          };
        }
        case 'cfm': {
          return {
            tcp: Constants.UOB_PORTS_CFM_TCP,
            udp: Constants.UOB_PORTS_CFM_UDP,
          };
        }
        case 'sim': {
          return {
            tcp: Constants.UOB_PORTS_SIM_TCP,
            udp: [],
          };
        }
        case 'bat': {
          return {
            tcp: Constants.UOB_PORTS_BAT_TCP,
            udp: Constants.UOB_PORTS_BAT_UDP,
          };
        }
        default: {
          return {
            tcp: [],
            udp: [],
          };
        }
      }
    } else {
      switch (tier) {
        case 'app': {
          return {
            tcp: Constants.DBS_PORTS_APP_TCP,
            udp: [],
          };
        }
        case 'web': {
          return {
            tcp: Constants.DBS_PORTS_WEB_TCP,
            udp: [],
          };
        }
        case 'mq': {
          return {
            tcp: Constants.DBS_PORTS_MQ_TCP,
            udp: [],
          };
        }
        case 'db': {
          return {
            tcp: Constants.DBS_PORTS_DB_TCP,
            udp: [],
          };
        }
        default: {
          return {
            tcp: [],
            udp: [],
          };
        }
      }
    }
  }

  /**
   * @param {IPsqlRdsConfig} config - Configuration for the RDS instance
   * @return {DfPsqlRdsConstruct} - Returns a new instance of the DfPsqlRdsConstruct
   */
  public createPsqlRdsInstance(config: IPsqlRdsConfig): DfPsqlRdsConstruct {
    return new DfPsqlRdsConstruct(this, config.rdsInstanceName, {
      provider: this.provider,
      vpc: config.vpc,
      securityGroup: {
        allowedCidrBlocks: config.allowedCidrBlocks,
      },
      dbOptions: {
        rdsInstanceName: config.rdsInstanceName,
        dbVersion: config.dbVersion,
        allocatedStorage: config.allocatedStorage,
        instanceClass: config.instanceClass,
        dbName: config.dbName,
        username: config.username,
        password: config.password,
        multiAz: config.multiAz,
        backupPolicy: config.backupPolicy,
        customerData: config.customerData,
        iops: config.iops,
        autoMinorVersionUpgrade: config.autoMinorVersionUpgrade,
        paramaterGroupConfig: config.paramaterGroupConfig,
        performanceInsightsEnabled: config.performanceInsightsEnabled,
      },
    });
  }

  /**
   *
   */
  public get standardUobInstanceResourceConfig(): {
    userDataReplaceOnChange: boolean;
    disableApiStop: boolean;
    disableApiTermination: boolean;
    rootBlockDevice: {
      volumeSize: number;
      volumeType: string;
      deleteOnTermination: boolean;
      encrypted: boolean;
    };
    keyName: string;
  } {
    return {
      userDataReplaceOnChange: false,
      disableApiStop: false,
      disableApiTermination: true,
      rootBlockDevice: {
        volumeSize: 200,
        volumeType: 'gp3',
        deleteOnTermination: true,
        encrypted: true,
      },
      keyName: 'uobKeyPair',
    };
  }

  /**
   *
   * @param {{string, DfSpokeVpcConstruct}} param0
   * @return {any}
   *
   */
  public get standardUobUserdataParams(): {
    mount_point: string;
    sub_domain: string;
    ingress_vpc_cidr: string;
    parameter_name: string;
    ssh_key_file_name: string;
    blk_device_name: string;
    key_pair_name: string;
    public_key_file_name: string;
  } {
    return {
      mount_point: '/mnt/efs',
      sub_domain: `${this.stackConfig.envSubdomain}.dragonflyft.com`,
      ingress_vpc_cidr:
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      parameter_name: 'shared-bld-01-private-key',
      ssh_key_file_name: 'id_rsa',
      blk_device_name: '/dev/nvme1n1',
      key_pair_name: 'uobKeyPair',
      public_key_file_name: 'uobKeyPair.pub',
    };
  }

  /**
   * @return {IamRole | undefined}
   */
  public get uobInstanceRole() {
    return this.sharedInstanceRoleResource;
  }

  /**
   *
   */
  public get uobInstanceKeyConstruct() {
    return this.sharedInstanceKeyConstruct;
  }

  /**
   *
   */
  public get uobEfs() {
    return this.sharedEfsConstruct;
  }

  public getUobReplicaConfig(): UobReplicaConfig {
    return this.uobReplicaConfig;
  }

  public getCustomerObjectSubnet(): CustomerObjectSubnet[] {
    return this.customerObjectSubnets;
  }

  public getAnsibleManaged(): boolean {
    return this.ansibleManaged;
  }

  public get clusterType(): string {
    return this._clusterType;
  }

  public isProdLikeCustomer(): boolean {
    return (
      this.createProdLikeResourcesNewWay &&
      Utils.isProdLikeCustomerEnvironment(
        this.stackConfig.accountDefinition,
        this.stackConfig.customerDefinition
      )
    );
  }
}
