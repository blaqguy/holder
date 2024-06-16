import {
  DfAliasedKeyConstruct,
  DfEfsConstruct,
  DfInternalLoadBalancerConstruct,
  DfKeyPairConstruct,
  DfOracleConstruct,
  DfPrivateBucketConstruct,
  DfPrivateInstanceConstruct,
  DfPrivateInstanceConstructProps,
  DfPublicIngressConstruct,
  DfSecurityGroupConstruct,
  DfSpokeVpcConstruct,
  PublicIngressLbConfig,
} from '@dragonfly/constructs';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import {
  DfWafStack,
  EbCrossAccountEfsShareBucketStack,
  RemoteStack,
  StackConfig,
  WafConfig,
} from '../stacks';
import { InstanceConfig } from '@cdktf/provider-aws/lib/instance';
import { EbProdClusterNodeTypes } from './ebClusterTypes';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { SecurityGroupIngress } from '@cdktf/provider-aws/lib/security-group';
import { S3BackendConfig } from 'cdktf';
import { TerraformProvider } from 'cdktf';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';

export interface ebConfig {
  vpcConstruct: DfSpokeVpcConstruct;
  recoveryVpcConstruct: DfSpokeVpcConstruct;
  region: Constants.AWS_REGION_ALIASES;
  devDeploy?: boolean;
  skipDatabase?: boolean;
  dbOptions?: {
    idPrefix: string;
    instanceClass?: string;
    storageSize?: number;
    snapshotIdentifier?: string;
    sopsDbProperty?: string;
    engine: 'oracle-se2' | 'oracle-ee';
    optionGroupName?: string;
    parameters?: { name: string; value: string }[];
    timezone?: string;
    multiRegionKey?: boolean;
    kmsNameOverride?: string;
    deployMultiAz?: boolean;
    recoveryVpc?: DfSpokeVpcConstruct;
  };
  clusterOptions: {
    idPrefix: string;
    ansibleManaged?: 'true' | 'false';
  };
  efsOptions: {
    replicationEnabled?: boolean;
    skipEfs?: boolean;
  };
  networkOptions: {
    networkConfig: {
      backendProps: S3BackendConfig;
      recoveryBackendProps: S3BackendConfig;
      networkProviderConfig: AccountProviderConfig;
    };
    route53Config: {
      backedProps: S3BackendConfig;
      recoveryBackedProps: S3BackendConfig;
      route53ProviderConfig: AccountProviderConfig;
    };
  };
  createAdminBucket?: boolean;
  publicIngressConfig?: {
    recordName: string;
    wafConfig?: WafConfig;
    albProps?: PublicIngressLbConfig['albProps'];
  };
  activeRegion?: 'default' | 'recovery';
}

interface EbTierNamedParameters {
  tier: EbProdClusterNodeTypes;
  tierOptions: {
    count: number;
    tierPorts?: {
      tcp: Array<number | [number, number]>;
      udp: Array<number | [number, number]>;
    };
    tierIngresses?: SecurityGroupIngress[];
    amiOverride?: Array<string>;
    recoveryAmiIds?: Array<string>;
  };
  instanceProps: DfPrivateInstanceConstructProps;
}

interface Route53Params {
  region: Constants.AWS_REGION_ALIASES;
  dbDnsName: string;
  envSubdomain: string;
  accountProviderConfig: AccountProviderConfig;
}

type EbInstanceMap = {
  [key in EbProdClusterNodeTypes]?: {
    hostname: string;
    instance: DfPrivateInstanceConstruct;
  }[];
};

/**
 * Stack used for deploying EB application
 */
export class EbStack extends RemoteStack {
  private devInstance: DfPrivateInstanceConstruct;
  private oracleInstance: DfOracleConstruct;
  private keyPair: DfKeyPairConstruct;
  private volumeKey: DfAliasedKeyConstruct;
  private primaryInstanceMap: EbInstanceMap = {};
  private recoveryInstanceMap: EbInstanceMap = {};
  private instanceRole: IamRole;
  private masterProvider: AwsProvider;
  private hubProvider: AwsProvider;

  /**
   * @param {string} stackName - Takes in the stack name
   * @param {StackConfig} stackConfig - Takes in the stack config
   * @param {ebConfig} config - Takes in all config properties needed to initialize the EB application
   * @param {AccountDefinition} accountDefinition - Takes in the account definition
   */
  constructor(
    private stackName: string,
    public readonly stackConfig: StackConfig,
    protected stackProps: ebConfig
  ) {
    super(stackName, stackConfig);

    this.masterProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: Utils.getMasterAccountProviderConfig(),
    });

    this.hubProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount:
        this.stackProps.networkOptions.networkConfig.networkProviderConfig,
    });

    const efsShareBucketPolicy = new IamPolicy(
      this,
      'efs-share-bucket-policy',
      {
        name: `${stackProps.clusterOptions.idPrefix}-allow-efs-share-bucket-read-write`,
        description: 'Allow EB instance role access to bucket in tools',
        policy: new DataAwsIamPolicyDocument(
          this,
          'efs-share-bucket-policy-doc',
          {
            statement: [
              {
                effect: 'Allow',
                actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject'],
                resources: [
                  `arn:aws:s3:::${EbCrossAccountEfsShareBucketStack.bucketName}`,
                  `arn:aws:s3:::${EbCrossAccountEfsShareBucketStack.bucketName}/*`,
                ],
              },
            ],
          }
        ).json,
      }
    );

    this.instanceRole = new IamRole(this, 'eb-instance-role', {
      provider: this.primaryProvider,
      name: `${stackProps.clusterOptions.idPrefix}-instance-role`,
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
        efsShareBucketPolicy.arn,
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
      tags: { Name: 'eb-instance-role' },
    });

    // Retrieves the current provider based on the region passed in

    if (stackProps.devDeploy) {
      this.devInstance = DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: `${this.stackProps.clusterOptions.idPrefix}-instance`,
        constructProps: {
          vpc: this.stackProps.vpcConstruct,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            provider: this.primaryProvider,
            ami: 'ami-0d6f3cf46ddf357c4',
            instanceType: 't2.medium',
            keyName: 'ebKeyPair',
            rootBlockDevice: {
              volumeSize: 150,
            },
            tags: {
              hostname: `${this.stackProps.clusterOptions.idPrefix}-instance`,
              'config-management-playbook': 'eb-instance',
              'ansible-managed': 'false',
              application: 'eb',
            },
          },
          options: {
            createKeyPair: true,
            securityGroup: {
              ports: {
                tcp: Constants.EB_PORTS_APP_TCP,
                udp: [],
              },
            },
          },
        },
      });
    }

    this.keyPair = new DfKeyPairConstruct(
      this,
      `${this.stackProps.clusterOptions.idPrefix}-key-pair`,
      {
        keyName: `${this.stackProps.clusterOptions.idPrefix}-key-pair`,
        provider: this.primaryProvider,
        recoveryProvider: this.recoveryProvider,
      }
    );

    this.volumeKey = new DfAliasedKeyConstruct(this, 'eb-cluster-key', {
      name: `${this.stackConfig.envName}-${this.stackProps.clusterOptions.idPrefix}-cluster-key`,
      description: 'EB Cluster Volumes Kms Key',
      provider: this.primaryProvider,
    });

    if (!stackProps.skipDatabase) {
      this.oracleInstance = new DfOracleConstruct(this, {
        id: stackProps.devDeploy
          ? 'eb-oracle-dev'
          : `${this.stackProps.dbOptions.idPrefix}-oracle`,
        provider: this.primaryProvider,
        subnetIds: this.stackProps.vpcConstruct.dataSubnetIds,
        engine: this.stackProps.dbOptions.engine,
        engineVersion: '19',
        accountDefinition: this.stackConfig.accountDefinition,
        parameterGroupConfig: {
          name: stackProps.devDeploy
            ? 'eb-oracle-dev'
            : `${this.stackProps.dbOptions.idPrefix}-oracle`,
          family: `${this.stackProps.dbOptions.engine}-19`,
          parameter: [
            {
              name: 'sqlnetora.sqlnet.allowed_logon_version_server',
              value: '8',
            },
            {
              name: 'sqlnetora.sqlnet.allowed_logon_version_client',
              value: '8',
            },
            ...(this.stackProps.dbOptions.parameters || []),
          ],
        },
        storageType: 'gp3',
        multiRegionKey: this.stackProps.dbOptions.multiRegionKey
          ? this.stackProps.dbOptions.multiRegionKey
          : null,
        kmsNameOverride: this.stackProps.dbOptions.kmsNameOverride
          ? this.stackProps.dbOptions.kmsNameOverride
          : null,
        deployMultiAz: this.stackProps.dbOptions.deployMultiAz
          ? this.stackProps.dbOptions.deployMultiAz
          : null,
        replicaConfig: this.stackProps.dbOptions.recoveryVpc
          ? {
              recoveryProvider: this.recoveryProvider,
              recoveryVpc: this.stackProps.dbOptions.recoveryVpc,
            }
          : null,
        allocatedStorage: this.stackProps.dbOptions.storageSize || 100,
        vpcResource: this.stackProps.vpcConstruct,
        instanceClass:
          this.stackProps.dbOptions.instanceClass || 'db.m5.2xlarge',
        performanceInsightsEnabled: true,
        environment: this.environment,
        createBucket: true,
        snapshotIdentifier:
          this.stackProps.dbOptions?.snapshotIdentifier ?? undefined,
        sopsDbProperty: this.stackProps.dbOptions?.sopsDbProperty ?? undefined,
        region: this.stackProps.region,
        optionGroupName: this.stackProps.dbOptions.optionGroupName ?? undefined,
        timezone: this.stackProps.dbOptions.timezone || 'UTC',
        kmsProviderOverride: this.primaryProvider,
        characterSetName: 'WE8MSWIN1252',
      });
    }

    if (!stackProps.efsOptions.skipEfs) {
      new DfEfsConstruct(this, 'eb-efs', {
        provider: this.primaryProvider,
        vpc: this.stackProps.vpcConstruct,
        cidrBlocks: [this.stackProps.vpcConstruct.vpcCidrBlock],
        replicaConfig: this.stackProps.efsOptions.replicationEnabled
          ? {
              recoveryProvider: this.recoveryProvider,
              recoveryVpc: this.stackProps.recoveryVpcConstruct,
            }
          : null,
      });
    }

    this.createEbBucket();
  }

  /**
   *
   *
   */
  private createEbBucket() {
    if (!(this.stackConfig.envName === 'ebCit')) {
      return;
    }

    if (!(this.stackProps.createAdminBucket || false)) {
      return;
    }

    new DfPrivateBucketConstruct(this, 'eb-admin', {
      bucketName: 'eb-admin-bucket',
      provider: this.primaryProvider,
      forceDestroy: true,
    });
  }

  /**
   *
   */
  public createEbTier({
    tier,
    tierOptions,
    instanceProps,
  }: EbTierNamedParameters) {
    this.createPrimaryInstance({
      tier: tier,
      tierOptions: tierOptions,
      instanceProps: instanceProps,
    });
    if (tierOptions.recoveryAmiIds && tierOptions.recoveryAmiIds.length > 0) {
      this.createRecoveryInstance({
        tier: tier,
        tierOptions: tierOptions,
        instanceProps: instanceProps,
      });
    }
    this.createLbForTier({ tier: tier });
  }

  private createPrimaryInstance({ tier, tierOptions, instanceProps }) {
    const standardEbInstanceConfig: InstanceConfig = {
      keyName: this.keyPair.getKeyPairResource().keyName,
    };

    if (tierOptions.tierPorts) {
      const cidrBlocks = Utils.getIngressCidrBlocksByNetworkType(
        this.stackConfig.accountDefinition
      );

      const securityGroups = [
        ...cidrBlocks,
        this.stackProps.vpcConstruct.vpcCidrBlock,
        // this.stackProps.recoveryVpcConstruct.vpcCidrBlock,
      ].map((cidrBlock, index) => {
        const sg = new DfSecurityGroupConstruct(
          this,
          `${this.stackProps.clusterOptions.idPrefix}-${tier}-SG-${index}`,
          {
            name: `${this.stackProps.clusterOptions.idPrefix}-${tier}-${index}`,
            provider: this.primaryProvider,
            vpcConstruct: this.stackProps.vpcConstruct,
            accountDefinition: this.stackConfig.accountDefinition,
            extraPorts: tierOptions.tierPorts ?? {
              tcp: [],
              udp: [],
            },
            additionalIngress: [
              {
                description: 'Allow SSH from Tools Primary',
                fromPort: 22,
                toPort: 22,
                protocol: 'tcp',
                cidrBlocks: [
                  DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
                  // DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery,
                ],
              },
              ...(tierOptions.tierIngresses ?? []),
            ],
            ingressConfig: {
              useSingleIngress: true,
              ingressCidrBlock: cidrBlock,
            },
          }
        );
        return sg.securityGroupResource;
      });
      instanceProps.options.securityGroup = {
        resource: securityGroups,
      };
    }

    instanceProps.vpc = this.stackProps.vpcConstruct;
    instanceProps.options.overrideInTransitSubnet = false;
    instanceProps.options.provider = this.primaryProvider;
    instanceProps.options.createKeyPair = false;
    instanceProps.options.instanceProfileRole = this.instanceRole;
    instanceProps.options.volumes?.forEach((volume) => {
      volume.volumeKey = this.volumeKey;
      volume.encrypted = true;
      volume.volumeType = 'gp3';
    });

    instanceProps.instanceResourceConfig = {
      ...instanceProps.instanceResourceConfig,
      ...standardEbInstanceConfig,
    };

    for (let i = 0; i < tierOptions.count; i++) {
      if (tierOptions.amiOverride) {
        instanceProps.instanceResourceConfig = {
          ...instanceProps.instanceResourceConfig,
          ...{
            ami: tierOptions.amiOverride[i],
          },
        };
      }
      const index = i < 9 ? `0${i + 1}` : `${i + 1}`;

      const hostname =
        `${this.stackProps.clusterOptions.idPrefix}${tier}${index}`.toLowerCase();
      instanceProps.instanceResourceConfig = {
        ...instanceProps.instanceResourceConfig,
        tags: {
          'ansible-managed':
            this.stackProps.clusterOptions.ansibleManaged ?? 'true',
          application: 'eb',
          ...(instanceProps.instanceResourceConfig.tags ?? {}),
          ...{ hostname: hostname },
        },
      };

      const instanceConstruct = new DfPrivateInstanceConstruct({
        scope: this,
        name: `${this.stackProps.clusterOptions.idPrefix}-${tier}-${index}`,
        constructProps: instanceProps,
      });

      this.addPrimaryInstance({
        tier: tier,
        instance: instanceConstruct,
        hostname: `${this.stackProps.clusterOptions.idPrefix}${tier}${index}`,
      });
    }
  }
  private createRecoveryInstance({ tier, tierOptions, instanceProps }) {
    const standardEbInstanceConfig: InstanceConfig = {
      keyName: this.keyPair.getKeyPairResource().keyName,
    };

    if (tierOptions.tierPorts) {
      const cidrBlocks = Utils.getIngressCidrBlocksByNetworkType(
        this.stackConfig.accountDefinition
      );

      const securityGroups = [
        ...cidrBlocks,
        this.stackProps.recoveryVpcConstruct.vpcCidrBlock,
      ].map((cidrBlock, index) => {
        const sg = new DfSecurityGroupConstruct(
          this,
          `${this.stackProps.clusterOptions.idPrefix}-${tier}-SG-${index}-recovery`,
          {
            name: `${this.stackProps.clusterOptions.idPrefix}-${tier}-${index}-recovery`,
            provider: this.recoveryProvider,
            vpcConstruct: this.stackProps.recoveryVpcConstruct,
            accountDefinition: this.stackConfig.accountDefinition,
            extraPorts: tierOptions.tierPorts ?? {
              tcp: [],
              udp: [],
            },
            additionalIngress: [
              {
                description: 'Allow SSH from Tools Primary',
                fromPort: 22,
                toPort: 22,
                protocol: 'tcp',
                cidrBlocks: [
                  DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
                  DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery,
                ],
              },
              ...(tierOptions.tierIngresses ?? []),
            ],
            ingressConfig: {
              useSingleIngress: true,
              ingressCidrBlock: cidrBlock,
            },
          }
        );
        return sg.securityGroupResource;
      });
      instanceProps.options.securityGroup = {
        resource: securityGroups,
      };
    }

    instanceProps.vpc = this.stackProps.recoveryVpcConstruct;
    instanceProps.options.overrideInTransitSubnet = false;
    instanceProps.options.provider = this.recoveryProvider;
    instanceProps.options.createKeyPair = false;
    instanceProps.options.instanceProfileRole = this.instanceRole;
    instanceProps.options.recoveredInstance = true;
    instanceProps.options.volumes = [];

    instanceProps.instanceResourceConfig = {
      ...instanceProps.instanceResourceConfig,
      ...standardEbInstanceConfig,
    };

    for (let i = 0; i < tierOptions.count; i++) {
      instanceProps.instanceResourceConfig = {
        ...instanceProps.instanceResourceConfig,
        ...{
          ami: tierOptions.recoveryAmiIds[i],
        },
      };
      const index = i < 9 ? `0${i + 1}` : `${i + 1}`;

      instanceProps.instanceResourceConfig = {
        ...instanceProps.instanceResourceConfig,
        tags: {
          'ansible-managed': false,
        },
      };

      const instanceConstruct = new DfPrivateInstanceConstruct({
        scope: this,
        name: `${this.stackProps.clusterOptions.idPrefix}-${tier}-${index}-recovery`,
        constructProps: instanceProps,
      });

      this.addRecoveryInstance({
        tier: tier,
        instance: instanceConstruct,
        hostname: `${this.stackProps.clusterOptions.idPrefix}${tier}${index}`,
      });
    }
  }

  /**
   *
   * @param {any} param0
   */
  private createLbForTier({ tier }: { tier: EbProdClusterNodeTypes }) {
    if (!(tier === 'mq')) {
      return;
    }

    // TODO: For after DR, change this so primary points to primary servers and recovery points to recovery servers
    new DfInternalLoadBalancerConstruct({
      scope: this,
      stackName: this.stackProps.clusterOptions.idPrefix,
      accountDefinition: this.stackConfig.accountDefinition,
      constructName: 'mq',
      lbName: `${this.stackProps.clusterOptions.idPrefix}-mq-nlb`,
      route53RecordName: `${this.stackProps.clusterOptions.idPrefix.toLowerCase()}-mq.${
        this.stackConfig.envSubdomain
      }.dragonflyft.com`,
      provider: this.primaryProvider,
      recoveryProvider: this.recoveryProvider,
      loadBalancerType: 'network',
      vpc: this.stackProps.vpcConstruct,
      recoveryVpc: this.stackProps.recoveryVpcConstruct,
      targetGroupConfigs: [
        {
          instances: this.getPrimaryInstancesByTier(tier),
          port: 16412,
          protocol: 'TCP',
          targetType: 'ip',
          healthCheck: {
            port: '16412',
            protocol: 'TCP',
          },
        },
      ],
      privateRoute53Config: {
        provider: this.createAwsProvider({
          supportedRegion: this.stackProps.region,
          forAccount:
            this.stackProps.networkOptions.route53Config.route53ProviderConfig,
        }),
        remoteStateBackendProps:
          this.stackProps.networkOptions.route53Config.backedProps,
        recoveryRemoteStateBackendProps:
          this.stackProps.networkOptions.route53Config.recoveryBackedProps,
      },
    });
  }

  /**
   * Creates Route53 attachments
   *
   * @param {Constants.AWS_REGION_ALIASES} region
   * @param {string} dnsName
   * @param {string} envSubdomain
   */
  public createRoute53Attachments({
    region,
    dbDnsName,
    envSubdomain,
    accountProviderConfig,
  }: Route53Params) {
    const sharedNetworkProvider: TerraformProvider = this.createAwsProvider({
      supportedRegion: region,
      forAccount: accountProviderConfig,
    });

    const route53Zone = new DataAwsRoute53Zone(
      this,
      `${dbDnsName}privateZoneLookup`,
      {
        provider: sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    if (this.getOracleInstance()?.oracleDbInstanceResource?.address) {
      // Creates the oracle rds routet53 record
      new Route53Record(this, `${dbDnsName}R53Record`, {
        provider: sharedNetworkProvider,
        name: `${dbDnsName}.${route53Zone.name}`,
        type: 'CNAME',
        zoneId: route53Zone.zoneId,
        records: [
          this.stackProps.activeRegion === 'recovery'
            ? this.getOracleInstance().oracleDbRecoveryInstanceResource.address
            : this.getOracleInstance().oracleDbInstanceResource.address,
        ],
        ttl: 300,
      });
    }

    Object.entries(this.primaryInstanceMap).forEach(([key, val]) => {
      const currentTier = key;
      val.forEach((obj, index) => {
        const instance = obj.instance;
        const privateIp =
          this.stackProps.activeRegion === 'recovery' &&
          this.recoveryInstanceMap[currentTier] &&
          this.recoveryInstanceMap[currentTier][index]
            ? this.recoveryInstanceMap[currentTier][index].instance
                .instanceResource.privateIp
            : instance.instanceResource.privateIp;

        new Route53Record(this, `${obj.hostname}.${envSubdomain}R53Record`, {
          provider: sharedNetworkProvider,
          name: `${obj.hostname}.${envSubdomain}.${route53Zone.name}`,
          type: 'A',
          zoneId: route53Zone.zoneId,
          records: [privateIp],
          ttl: 300,
        });
      });
    });
  }

  /**
   *
   */
  public enablePublicAccess() {
    if (!this.stackProps.publicIngressConfig) {
      return;
    }

    const masterProvider = this.createAwsProvider({
      supportedRegion: this.stackProps.region,
      forAccount: Utils.getMasterAccountProviderConfig(),
    });

    const networkProvider = this.createAwsProvider({
      supportedRegion: this.stackProps.region,
      forAccount:
        this.stackProps.networkOptions.networkConfig.networkProviderConfig,
    });

    const route53Provider = this.createAwsProvider({
      supportedRegion: this.stackProps.region,
      forAccount:
        this.stackProps.networkOptions.route53Config.route53ProviderConfig,
    });

    // * Enable Public Ingress if the config is set
    new DfPublicIngressConstruct(
      this,
      'public-ingress',
      null,
      {
        providers: {
          constructProvider: this.getProviderForRegion(this.stackProps.region),
          masterProvider: masterProvider,
          networkProvider: networkProvider,
          route53Provider: route53Provider,
          recoveryProvider: this.recoveryProvider,
        },
        instancesForTargetGroup: this.getPrimaryInstancesByTier('web'),
        recoveryInstancesForTargetGroup: this.getRecoveryInstancesByTier('web'),
        certDomainName: `${this.stackProps.publicIngressConfig.recordName}.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        r53RecordName: `${this.stackProps.publicIngressConfig.recordName}.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        albName: `${this.stackProps.clusterOptions.idPrefix}-ALB`,
        networkBackendProps:
          this.stackProps.networkOptions.networkConfig.backendProps,
        recoveryNetworkBackendProps:
          this.stackProps.networkOptions.networkConfig.recoveryBackendProps,
        wafId: new DfWafStack(
          `${this.stackProps.clusterOptions.idPrefix}-public-WAF`,
          this.stackConfig,
          this.stackProps.publicIngressConfig.wafConfig
        ).webAclArn,
        albProps: this.stackProps.publicIngressConfig.albProps,
        bucketNameOverride: `${this.stackProps.clusterOptions.idPrefix}-cf-logging-bucket`,
      },
      false,
      this.stackConfig.accountDefinition
    );
  }

  /**
   *
   * @param {{string, DfPrivateInstanceConstruct}} param0 -
   *
   */
  private addPrimaryInstance({
    tier,
    instance,
    hostname,
  }: {
    tier: EbProdClusterNodeTypes;
    instance: DfPrivateInstanceConstruct;
    hostname: string;
  }) {
    if (!(tier in this.primaryInstanceMap)) {
      this.primaryInstanceMap[tier] = [];
    }
    this.primaryInstanceMap[tier].push({
      instance: instance,
      hostname: hostname,
    });
  }

  /**
   *
   * @param {{string, DfPrivateInstanceConstruct}} param0 -
   *
   */
  private addRecoveryInstance({
    tier,
    instance,
    hostname,
  }: {
    tier: EbProdClusterNodeTypes;
    instance: DfPrivateInstanceConstruct;
    hostname: string;
  }) {
    if (!(tier in this.recoveryInstanceMap)) {
      this.recoveryInstanceMap[tier] = [];
    }
    this.recoveryInstanceMap[tier].push({
      instance: instance,
      hostname: hostname,
    });
  }

  /**
   * Gets the dev instance created by the EB Stack
   * @return {DfPrivateInstanceConstruct}
   */
  public getDevInstance(): DfPrivateInstanceConstruct {
    return this.devInstance;
  }

  /**
   * Returns the created oracle consturct
   * @return {DfOracleConstruct}
   */
  public getOracleInstance(): DfOracleConstruct {
    return this.oracleInstance;
  }

  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public getPrimaryEbInstances(): {
    hostname: string;
    instance: DfPrivateInstanceConstruct;
  }[] {
    return Object.values(this.primaryInstanceMap).flat();
  }

  /**
   *
   * @param {EbProdClusterNodeTypes} tier
   * @return {Array<string>}
   */
  public getPrimaryInstancesByTier(
    tier: EbProdClusterNodeTypes
  ): DfPrivateInstanceConstruct[] {
    return this.primaryInstanceMap[tier].map((obj) => obj.instance);
  }

  /**
   *
   * @param {EbProdClusterNodeTypes} tier
   * @return {Array<string>}
   */
  public getRecoveryInstancesByTier(
    tier: EbProdClusterNodeTypes
  ): DfPrivateInstanceConstruct[] {
    return this.recoveryInstanceMap[tier]?.map((obj) => obj.instance);
  }

  /**
   * @return {IamRole}
   */
  public getInstanceRole(): IamRole {
    return this.instanceRole;
  }

  public getActiveRegion() {
    return this.stackProps.activeRegion;
  }
}
