import {
  DfEfsConstruct,
  DfEcrConstruct,
  DfSpokeVpcConstruct,
  DfPrivateInstanceConstruct,
  DfAttachedEbsVolume,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { createResources } from './resources';
import { EfsAccessPoint } from '@cdktf/provider-aws/lib/efs-access-point';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export interface DfJenkinStackConfig {
  spokeVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  targetGroupArn: string;
  albSgId: string;
  dockerPushRoleAssumption: string;
  domainName: string;
  activeSecondaryUOBBuildInstances: number;
  activeSecondaryEBBuildInstances: number;
}

/**
 * Jenkins stack
 */
export class DfJenkinsStack extends RemoteStack {
  public static readonly STACK_ID = 'Jenkins';
  readonly domainName: string;
  protected providerToChoose: AwsProvider;
  public uobBuildServers: DfPrivateInstanceConstruct[] = [];
  public ebBuildServers: DfPrivateInstanceConstruct[] = [];

  public jenkinsSecurityGroups: {
    master: SecurityGroup;
  } = {
    master: null,
  };

  public jenkinsEfs: DfEfsConstruct;
  public jenkinsEcr: DfEcrConstruct;
  public efsAccessPoint: EfsAccessPoint;

  /**
   *
   * @param {StackConfig} stackConfig
   * @param {DfJenkinStackConfig} jenkinsStackConfig
   * @param {string} prefix -
   * @param {Constants.AWS_REGION_ALIASES} region
   */
  constructor(
    protected stackId: string,
    protected stackConfig: StackConfig,
    public readonly jenkinsStackConfig: DfJenkinStackConfig,
    protected prefix: string,
    protected region: Constants.AWS_REGION_ALIASES = Constants
      .AWS_REGION_ALIASES.LEGACY
  ) {
    super(stackId, stackConfig);
    this.domainName = jenkinsStackConfig.domainName;
    this.providerToChoose = this.getProviderForRegion(region);

    this.createSecurityGroup();

    this.createEfs();

    this.createJenkinsEcr();

    // TODO: Pull the rest of these out into constructs
    createResources(
      this,
      this.providerToChoose,
      this.stackConfig.federatedAccountId,
      prefix
    );

    this.uobBuildServers.push(this.createInitialBuildServer());
    this.uobBuildServers.push(
      ...this.createSecondaryBuildServers(
        jenkinsStackConfig.activeSecondaryUOBBuildInstances,
        'jenkins'
      )
    );
    this.ebBuildServers.push(
      ...this.createSecondaryBuildServers(
        jenkinsStackConfig.activeSecondaryEBBuildInstances,
        'eb'
      )
    );
  }

  /**
   *
   */
  private createEfs() {
    this.jenkinsEfs = new DfEfsConstruct(this, 'Jenkins', {
      securityGroups: [this.jenkinsSecurityGroups.master.id],
      vpc: this.jenkinsStackConfig.spokeVpc,
      provider: this.providerToChoose,
    });

    this.efsAccessPoint = new EfsAccessPoint(
      this,
      'jenkinsEfs-EfsAccessPoint',
      {
        provider: this.providerToChoose,
        fileSystemId: this.jenkinsEfs.efsId,
        posixUser: {
          gid: 0,
          uid: 0,
        },
        rootDirectory: {
          path: '/',
          creationInfo: {
            ownerGid: 1000,
            ownerUid: 1000,
            permissions: '755',
          },
        },
        tags: {
          Name: 'jenkinsEfs-EfsAccessPoint',
        },
      }
    );
  }

  /**
   *
   */
  private createSecurityGroup() {
    this.jenkinsSecurityGroups.master = new SecurityGroup(
      this,
      'jenkinsMasterSecurityGroup',
      {
        provider: this.providerToChoose,
        name: 'jenkinsMaster',
        description: 'Security group for Jenkins Master',
        vpcId: this.jenkinsStackConfig.spokeVpc.vpcId,
        ingress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            securityGroups: [this.jenkinsStackConfig.albSgId],
            description: 'Communication channel to Jenkins Master',
          },
        ],
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow all outbound traffic',
          },
        ],
        tags: {
          Name: 'jenkinsMaster',
        },
      }
    );
  }

  /**
   *
   */
  private createJenkinsEcr() {
    this.jenkinsEcr = new DfEcrConstruct(
      this,
      'JenkinsEcr',
      'jenkins',
      null,
      null,
      this.providerToChoose
    );
  }

  /**
   *
   * @return {DfPrivateInstanceConstruct}
   */
  private createInitialBuildServer() {
    const buildServer = DfPrivateInstanceConstruct.windowsInstanceFactory({
      scope: this,
      name: 'jenkins-windows-build-server',
      constructProps: {
        vpc: this.jenkinsStackConfig.spokeVpc,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS[this.region]['windows-2022-default'],
          keyName: 'jenkins-windows-build-server',
          instanceType:
            this.stackConfig.accountDefinition.accountNumber ===
            DfAccounts.getPlatformSandboxAccountDef().accountNumber
              ? 't3.medium'
              : 'r5.2xlarge',
          rootBlockDevice: {
            volumeSize: 50,
          },
        },
        options: {
          provider: this.providerToChoose,
          createKeyPair: true,
          securityGroup: {
            ingresses: [
              {
                description: 'Allow AppScan ports',
                fromPort: 51101,
                toPort: 51103,
                protocol: 'tcp',
                cidrBlocks: [
                  DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy,
                  DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
                  DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery,
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .legacy.gatewayVpcCidr,
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .primary.gatewayVpcCidr,
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .recovery.gatewayVpcCidr,
                ],
              },
            ],
          },
          iamInstanceProfileNameOverride:
            `${this.stackId}-default-instance-profile`.toLowerCase(),
        },
      },
    });

    new DfAttachedEbsVolume(this, 'jenkins-windows-build-server-ebs', {
      provider: this.providerToChoose,
      volume: {
        name: 'jenkins-windows-build-server',
        size: 750,
        type: 'gp3',
      },
      attachment: {
        deviceName: '/dev/xvdf',
      },
      deps: {
        instance: buildServer,
      },
    });

    return buildServer;
  }

  /**
   *
   * @param {number} activeSecondaryBuildInstances
   * @param {string} constructId
   * @return {DfPrivateInstanceConstruct[]}
   */
  private createSecondaryBuildServers(
    activeSecondaryBuildInstances: number,
    constructId: string
  ) {
    return Array.from(
      { length: activeSecondaryBuildInstances },
      (v, k) => k + 2
    ).map((index) => {
      return DfPrivateInstanceConstruct.windowsInstanceFactory({
        scope: this,
        name: `${constructId}-windows-build-server-${index}`,
        constructProps: {
          vpc: this.jenkinsStackConfig.spokeVpc,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: Constants.MANAGED_AMI_IDS[this.region][
              Constants.AMIS.JENKINS_WINDOWS_AGENT_SNAPSHOT
            ],
            keyName: 'jenkins-windows-build-server',
            instanceType: index === 6 ? 'r5.8xlarge' : 'r5.2xlarge', // See PTSD-970
            rootBlockDevice: {
              volumeSize: 50,
            },
          },
          options: {
            provider: this.providerToChoose,
            createKeyPair: false,
            securityGroup: {
              ingresses: [
                {
                  description: 'Allow AppScan ports',
                  fromPort: 51101,
                  toPort: 51103,
                  protocol: 'tcp',
                  cidrBlocks: [
                    DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy,
                    DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
                    DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery,
                    DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                      .legacy.gatewayVpcCidr,
                    DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                      .primary.gatewayVpcCidr,
                    DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                      .recovery.gatewayVpcCidr,
                  ],
                },
                {
                  description: 'Allow HTTP on VPN',
                  fromPort: 8080,
                  toPort: 8080,
                  protocol: 'tcp',
                  cidrBlocks: Utils.getIngressCidrBlocksByNetworkType(
                    DfAccounts.getToolsAccountDef()
                  ),
                },
              ],
            },
          },
        },
      });
    });
  }

  /**
   *
   */
  public get federatedAccountId() {
    return this.stackConfig.federatedAccountId;
  }
}
