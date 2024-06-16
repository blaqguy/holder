import {
  DfAliasedKeyConstruct,
  DfAuroraRdsConstruct,
  DfKeyPairConstruct,
  DfPrivateInstanceConstruct,
  RdsCredentials,
} from '@dragonfly/constructs';
import { DfSpokeVpcStack, RemoteStack, StackConfig } from '../stacks';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  DfMultiRegionDeployment,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { RdsClusterParameterGroup } from '@cdktf/provider-aws/lib/rds-cluster-parameter-group';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { TerraformProvider } from 'cdktf';

interface Route53Config {
  dbDnsName: string;
  accountProviderConfig: AccountProviderConfig;
}

interface Uc4AutomationStackConfig {
  vpcMap: { [x: string]: DfSpokeVpcStack };
  route53Config: Route53Config;
  enableReplica: boolean;
  activeRegion: string;
  engineVersion: string;
}

/**
 * UC4 Automation Stack
 */
export class Uc4AutomationStack
  extends RemoteStack
  implements DfMultiRegionDeployment
{
  private sopsData: PlatformSecrets;
  private sharedNetworkProvider: AwsProvider;

  private primaryAutomationEngine: DfPrivateInstanceConstruct;
  private secondaryAutomationEngine: DfPrivateInstanceConstruct;
  private primaryWebInterface: DfPrivateInstanceConstruct;
  private secondaryWebInterface: DfPrivateInstanceConstruct;

  private recoveryAutomationEngine: DfPrivateInstanceConstruct;
  private recoverySecondaryAutomationEngine: DfPrivateInstanceConstruct;
  private recoveryWebInterface: DfPrivateInstanceConstruct;
  private recoverySecondaryWebInterface: DfPrivateInstanceConstruct;

  private uc4AuroraDb: DfAuroraRdsConstruct;

  private route53Zone: DataAwsRoute53Zone;
  public readonly activeRegion: string;

  private static readonly UC4_UAT_ALLOW_LIST = [
    DfAccounts.getEbUatAccountDef().vpcCidrs.main.primary,
    DfAccounts.getEbUatAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
    DfAccounts.getEwbUatAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
    DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
    DfAccounts.getMuobUatAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getStateStreetUatAccountDef().vpcCidrs.main.primary,
    DfAccounts.getStateStreetUatAccountDef().vpcCidrs.main.recovery,
  ];

  private static readonly UC4_PROD_ALLOW_LIST = [
    DfAccounts.getEbProdAccountDef().vpcCidrs.main.primary,
    DfAccounts.getEbProdAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getEwbProdAccountDef().vpcCidrs.main.primary,
    DfAccounts.getEwbProdAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getMuobProdAccountDef().vpcCidrs.main.primary,
    DfAccounts.getMuobProdAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getSantanderProdAccountDef().vpcCidrs.main.primary,
    DfAccounts.getSantanderProdAccountDef().vpcCidrs.main.recovery,
    DfAccounts.getStateStreetProdAccountDef().vpcCidrs.main.primary,
    DfAccounts.getStateStreetProdAccountDef().vpcCidrs.main.recovery,
  ];

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   * @param {DfSpokeVpcStack} vpc - Vpc to use for this stack
   * @param {boolean} enableReplica
   */
  constructor(
    protected stackId: string,
    protected stackConfig: StackConfig,
    protected config: Uc4AutomationStackConfig
  ) {
    super(stackId, stackConfig);
    this.activeRegion = this.config.activeRegion;

    const providerArray = [this.primaryProvider, this.recoveryProvider];
    this.sopsData = Utils.getSecretsForNode(this.node);
    providerArray.forEach((provider) => this.createUc4Resources(provider));

    this.sharedNetworkProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: Utils.getSharedNetworkAccountProviderConfig(
        this.isInPlatformSandboxEnvironments()
      ),
    });

    this.createUc4Db();
    this.route53Zone = new DataAwsRoute53Zone(
      this,
      `${
        this.stackConfig.envSubdomain === 'prod' ? 'uc4-prod' : 'uc4-uat'
      }-private-zone-lookup`,
      {
        provider: this.sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );
    if (this.config.activeRegion === Constants.AWS_REGION_MAP.DFPRIMARY) {
      this.createR53Record(this.primaryAutomationEngine, 'uc4PrimaryEngine');
      this.createR53Record(
        this.secondaryAutomationEngine,
        'uc4SecondaryEngine'
      );
    } else {
      this.createR53Record(this.recoveryAutomationEngine, 'uc4PrimaryEngine');
      this.createR53Record(
        this.recoverySecondaryAutomationEngine,
        'uc4SecondaryEngine'
      );
    }

    this.createDbR53Record();
  }

  private createUc4Resources(provider: AwsProvider) {
    const cidrAllowList =
      this.stackConfig.envSubdomain === 'prod'
        ? Uc4AutomationStack.UC4_PROD_ALLOW_LIST
        : Uc4AutomationStack.UC4_UAT_ALLOW_LIST;

    let tagName;
    let uc4KeyPair;
    if (provider === this.recoveryProvider) {
      tagName = 'dr-uc4';
      const keyPairName = `${tagName}-automation-engine-key-pair`;
      uc4KeyPair = new DfKeyPairConstruct(this, keyPairName, {
        provider: provider,
        keyName: keyPairName,
        index: 1,
      });
    } else {
      tagName = 'uc4';
      const keyPairName = `${tagName}-automation-engine-key-pair`;
      uc4KeyPair = new DfKeyPairConstruct(this, keyPairName, {
        provider: provider,
        keyName: keyPairName,
      });
    }

    const encryptionKey = new DfAliasedKeyConstruct(
      this,
      `${tagName}-encryption-key`,
      {
        name: `${tagName}-ebs-encryption-key`,
        description: 'The KMS key for encypting the Uc4 Ebs Volumes',
        provider: provider,
      }
    );

    const uc4SessionRole = new IamRole(this, `${tagName}-session-role`, {
      provider: tagName,
      name: [this.stackConfig.envName, `${tagName}-session-role`].join('-'),
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
      tags: { Name: 'uc4-session-role' },
    });

    const primaryAutomationEngine =
      DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: `${tagName}-automation-engine`,
        constructProps: {
          vpc: this.config.vpcMap[provider.region].vpcConstruct,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: this.getInstanceAmi(provider.region, 'primaryEngine'),
            instanceType: 'c5.2xlarge',
            keyName: uc4KeyPair.getKeyPairResource().keyName,
            rootBlockDevice: {
              volumeSize: 1024, // Volume size in GB: 1024GB -> 1TB
              encrypted: true,
              deleteOnTermination: false,
              kmsKeyId: encryptionKey.arn,
            },
            tags: {
              Name: `${tagName}-automation-engine-primary`,
              hostname: 'uc4primaryengine',
              'config-management-playbook': 'uc4',
              'ansible-managed': 'true',
              application: 'uc4',
            },
          },
          options: {
            provider: provider,
            recoveredInstance:
              provider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
            instanceProfileRole: uc4SessionRole,
            subnet: {
              azIndex: 0,
            },
            securityGroup: {
              ports: {
                tcp: [
                  [8443, 8445],
                  [2200, 2317],
                  8088,
                  8080,
                  8871,
                  389,
                  636,
                  25,
                  587,
                ],
                udp: [],
              },
              ingresses: [
                {
                  description: 'TEMP - Allow all traffic from ENV',
                  fromPort: 0,
                  toPort: 0,
                  protocol: '-1',
                  cidrBlocks: cidrAllowList,
                },
              ],
            },
          },
        },
      });

    provider === this.primaryProvider
      ? (this.primaryAutomationEngine = primaryAutomationEngine)
      : (this.recoveryAutomationEngine = primaryAutomationEngine);

    const secondaryAutomationEngine =
      DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: `${tagName}-automation-engine-secondary`,
        constructProps: {
          vpc: this.config.vpcMap[provider.region].vpcConstruct,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: this.getInstanceAmi(provider.region, 'secondaryEngine'),
            instanceType: 'c5.2xlarge',
            keyName: uc4KeyPair.getKeyPairResource().keyName,
            rootBlockDevice: {
              volumeSize: 1024, // Volume size in GB: 1024GB -> 1TB
              encrypted: true,
              deleteOnTermination: false,
              kmsKeyId: encryptionKey.arn,
            },
            tags: {
              Name: `${tagName}-automation-engine-secondary`,
              hostname: 'uc4secondaryengine',
              'config-management-playbook': 'uc4',
              'ansible-managed': 'true',
              application: 'uc4',
            },
          },
          options: {
            provider: provider,
            recoveredInstance:
              provider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
            instanceProfileRole: uc4SessionRole,
            subnet: {
              azIndex: 1,
            },
            securityGroup: {
              ports: {
                tcp: [
                  [8443, 8445],
                  [2200, 2317],
                  8088,
                  8080,
                  8871,
                  389,
                  636,
                  25,
                  587,
                ],
                udp: [],
              },
              ingresses: [
                {
                  description: 'TEMP - Allow all traffic from ENV',
                  fromPort: 0,
                  toPort: 0,
                  protocol: '-1',
                  cidrBlocks: cidrAllowList,
                },
              ],
            },
          },
        },
      });

    provider === this.primaryProvider
      ? (this.secondaryAutomationEngine = secondaryAutomationEngine)
      : (this.recoverySecondaryAutomationEngine = secondaryAutomationEngine);

    const primaryWebInterface = DfPrivateInstanceConstruct.linuxInstanceFactory(
      {
        scope: this,
        name: `${tagName}-automation-web-interface-primary`,
        constructProps: {
          vpc: this.config.vpcMap[provider.region].vpcConstruct,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: this.getInstanceAmi(provider.region, 'primaryWeb'),
            instanceType: 'c5.xlarge',
            keyName: uc4KeyPair.getKeyPairResource().keyName,
            rootBlockDevice: {
              volumeSize: 512, // Volume size in GB: 512GB
              encrypted: true,
              deleteOnTermination: false,
              kmsKeyId: encryptionKey.arn,
            },
            tags: {
              Name: `${tagName}-automation-web-interface-primary`,
              hostname: 'uc4primarywebinterface',
              'config-management-playbook': 'uc4',
              'ansible-managed': 'true',
              application: 'uc4',
            },
          },
          options: {
            provider: provider,
            recoveredInstance:
              provider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
            instanceProfileRole: uc4SessionRole,
            securityGroup: {
              ports: {
                tcp: [
                  [8443, 8445],
                  [2200, 2317],
                  8088,
                  8080,
                  8871,
                  389,
                  636,
                  25,
                  587,
                ],
                udp: [],
              },
            },
          },
        },
      }
    );

    provider === this.primaryProvider
      ? (this.primaryWebInterface = primaryWebInterface)
      : (this.recoveryWebInterface = primaryWebInterface);

    const secondaryWebInterface =
      DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: `${tagName}-automation-web-interface-secondary`,
        constructProps: {
          vpc: this.config.vpcMap[provider.region].vpcConstruct,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: this.getInstanceAmi(provider.region, 'secondaryWeb'),
            instanceType: 'c5.xlarge',
            keyName: uc4KeyPair.getKeyPairResource().keyName,
            rootBlockDevice: {
              volumeSize: 512, // Volume size in GB: 512GB
              encrypted: true,
              deleteOnTermination: false,
              kmsKeyId: encryptionKey.arn,
            },
            tags: {
              Name: `${tagName}-automation-web-interface-secondary`,
              hostname: 'uc4secondarywebinterface',
              'config-management-playbook': 'uc4',
              'ansible-managed': 'true',
              application: 'uc4',
            },
          },
          options: {
            provider: provider,
            recoveredInstance:
              provider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
            instanceProfileRole: uc4SessionRole,
            securityGroup: {
              ports: {
                tcp: [
                  [8443, 8445],
                  [2200, 2317],
                  8088,
                  8080,
                  8871,
                  389,
                  636,
                  25,
                  587,
                ],
                udp: [],
              },
            },
          },
        },
      });

    provider === this.primaryProvider
      ? (this.secondaryWebInterface = secondaryWebInterface)
      : (this.recoverySecondaryWebInterface = secondaryWebInterface);
  }

  private createUc4Db() {
    // Retrieve sops data that contains RDS config credentials
    const rdsCredentials: RdsCredentials = {
      username: this.sopsData.RDS_CONFIG_CREDS.uc4.username,
      password: this.sopsData.RDS_CONFIG_CREDS.uc4.password,
    };

    const key = new DfAliasedKeyConstruct(this, 'uc4-db-key', {
      name: this.config.enableReplica
        ? 'uc4-db-multi-region-key'
        : 'uc4-db-key',
      description: 'The KMS key for encypting the UC4 DB',
      provider: this.primaryProvider,
      multiRegion: this.config.enableReplica,
      recoveryProvider: this.recoveryProvider,
    });

    const uc4Params = [
      {
        name: 'log_lock_waits ',
        value: '1',
        applyMethod: 'immediate',
      },
      {
        name: 'idle_in_transaction_session_timeout',
        value: '600000',
        applyMethod: 'immediate',
      },
      {
        name: 'pg_stat_statements.track_utility',
        value: '1',
        applyMethod: 'immediate',
      },
      {
        name: 'autovacuum_vacuum_cost_delay',
        value: '0',
        applyMethod: 'immediate',
      },
      {
        name: 'vacuum_cost_limit',
        value: '10000',
        applyMethod: 'immediate',
      },
      {
        name: 'shared_buffers', // units of 8kb
        value: '2097152', // 16GB
        applyMethod: 'immediate',
      },
      {
        name: 'work_mem', // units of 1kb
        value: '409600', // 400MB
        applyMethod: 'immediate',
      },
      {
        name: 'maintenance_work_mem', // units of 1kb
        value: '2097152', // 2GB
        applyMethod: 'immediate',
      },
      {
        name: 'effective_cache_size', // units of 8kb
        value: '16777216', // 128GB
        applyMethod: 'immediate',
      },
      {
        name: 'autovacuum_naptime', // units of seconds
        value: '60',
        applyMethod: 'immediate',
      },
      {
        name: 'random_page_cost',
        value: '1.0',
        applyMethod: 'immediate',
      },
      {
        name: 'autovacuum_vacuum_scale_factor',
        value: '.01',
        applyMethod: 'immediate',
      },
      {
        name: 'random_page_cost',
        value: '1.0',
        applyMethod: 'immediate',
      },
    ];

    this.uc4AuroraDb = DfAuroraRdsConstruct.auroraPostgresRdsInstanceFactory(
      this.environment,
      this,
      this.stackConfig.federatedAccountId,
      `uc4-automation-engine-db-${this.stackId}`,
      {
        primaryProvider: this.primaryProvider,
        subnetIds:
          this.config.vpcMap[this.primaryProvider.region].vpcConstruct
            .dataSubnetIds,
        accountDefinition: this.stackConfig.accountDefinition,
        vpcResource:
          this.config.vpcMap[this.primaryProvider.region].vpcConstruct,
        id: 'uc4-automation-engine-db',
        rdsCredentials: rdsCredentials,
        // snapshotId: 'uc4-multi-region-snapshot',
        allocatedStorage: 100,
        instanceClass: 'db.r5.2xlarge',
        databaseName: undefined,
        engineVersion: this.config.engineVersion,
        additionalSubnets: [
          this.config.vpcMap[this.recoveryProvider.region].cidr,
        ],
        clusterParameterGroupName: new RdsClusterParameterGroup(
          this,
          'uc4-aurora-parameter-group',
          {
            name: 'uc4-aurora-parameter-group',
            family: 'aurora-postgresql14',
            provider: this.primaryProvider,
            parameter: uc4Params,
            tags: { Name: 'uc4-aurora-parameter-group' },
          }
        ).name,
        kmsKey: key,
        prodCustomerData: true,
        replicaConfig: this.config.enableReplica
          ? {
              vpc: this.config.vpcMap[this.recoveryProvider.region]
                .vpcConstruct,
              replicaProvider: this.recoveryProvider,
              replicaClusterFamily: 'aurora-postgresql14',
              replicaClusterParameterGroupName: `${this.stackId}-replica-cluster-parameter-group`,
              replicaClusterParameters: uc4Params,
              replicaKmsKeyArn: key.getReplicaKey().arn,
            }
          : null,
        applyImmediately: true,
      },
      this.stackConfig.accountDefinition,
      this.config.enableReplica
    );
  }

  private getInstanceAmi(
    providerRegion,
    uc4InstanceType:
      | 'primaryEngine'
      | 'secondaryEngine'
      | 'primaryWeb'
      | 'secondaryWeb'
  ) {
    if (providerRegion === Constants.AWS_REGION_MAP.DFPRIMARY) {
      return Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
        Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
      ];
    }
    if (this.stackConfig.envSubdomain === 'prod') {
      switch (uc4InstanceType) {
        case 'primaryEngine':
          return 'ami-032e54f3361b1b93c';
        case 'secondaryEngine':
          return 'ami-06a068b4f1b6b6016';
        case 'primaryWeb':
          return 'ami-05876ad6b99195e43';
        case 'secondaryWeb':
          return 'ami-00d30365273fd7564';
        default:
          return Constants.MANAGED_AMI_IDS[
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ][Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7];
      }
    }

    switch (uc4InstanceType) {
      case 'primaryEngine':
        return 'ami-0c9d595dad00d8131';
      case 'secondaryEngine':
        return 'ami-02420b399414bc66a';
      case 'primaryWeb':
        return 'ami-0eea3f6811f4791d5';
      case 'secondaryWeb':
        return 'ami-0fea1ba667191bf40';
      default:
        return Constants.MANAGED_AMI_IDS[
          Constants.AWS_REGION_ALIASES.DF_RECOVERY
        ][Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7];
    }
  }

  /**
   * Creates a R53 record for Uc4 servers
   *
   * @param {DfPrivateInstanceConstruct} instance - The instance to make the hostname for
   * @param {string} hostname - The hostname for the instance
   *
   */
  private createR53Record(
    instance: DfPrivateInstanceConstruct,
    hostname: string
  ) {
    new Route53Record(
      this,
      `${hostname}${this.stackConfig.envSubdomain}R53Record`,
      {
        provider: this.sharedNetworkProvider,
        name: `${[hostname, this.stackConfig.envSubdomain].join('.')}.${
          this.route53Zone.name
        }`,
        type: 'A',
        zoneId: this.route53Zone.zoneId,
        records: [instance.instanceResource.privateIp],
        ttl: 300,
      }
    );
  }

  /**
   * Creates a R53 record for Uc4 Database
   */
  private createDbR53Record() {
    const sharedNetworkProvider: TerraformProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: this.config.route53Config.accountProviderConfig,
    });

    const route53Zone = new DataAwsRoute53Zone(
      this,
      `${this.config.route53Config.dbDnsName}privateZoneLookup`,
      {
        provider: sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    new Route53Record(this, `${this.config.route53Config.dbDnsName}R53Record`, {
      provider: sharedNetworkProvider,
      name: `${this.config.route53Config.dbDnsName}.${route53Zone.name}`,
      type: 'CNAME',
      zoneId: route53Zone.zoneId,
      records:
        this.config.activeRegion === Constants.AWS_REGION_MAP.DFPRIMARY
          ? [this.database.rdsClusterResource.endpoint]
          : [this.database.rdsClusterRecoveryResource.endpoint],
      ttl: 300,
    });
  }

  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public get engines(): DfPrivateInstanceConstruct[] {
    return [this.primaryAutomationEngine, this.secondaryAutomationEngine];
  }

  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public get webInterfaces(): DfPrivateInstanceConstruct[] {
    return [this.primaryWebInterface, this.secondaryWebInterface];
  }

  public get recoveryWebInterfaces(): DfPrivateInstanceConstruct[] {
    return [this.recoveryWebInterface, this.recoverySecondaryWebInterface];
  }

  /**
   * @return {DfAuroraRdsConstruct}
   */
  public get database(): DfAuroraRdsConstruct {
    return this.uc4AuroraDb;
  }
}
