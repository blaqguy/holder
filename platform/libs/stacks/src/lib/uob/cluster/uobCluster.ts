import {
  AccountProviderConfig,
  CustomerDefinition,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import { UobHelperStack } from '../uobHelperStack';
import { UobStack } from '../uobStack';
import { UobTier } from '../tier/uobTier';
import {
  CustomerAlbConfig,
  CustomerLbConfig,
  DfCustomerAlbConstruct,
  DfCustomerNlbConstruct,
  DfIamRoleConstruct,
  DfOracleConstruct,
  DfPrivateBucketConstruct,
  DfPrivateInstanceConstruct,
  DfPublicIngressConstruct,
  DfSecurityGroupConstruct,
  OracleStackConfig,
} from '@dragonfly/constructs';
import { UobClusterNamedParameters } from './uobClusterTypes';
import { UobTierType } from '../tier/uobTierTypes';
import { environmentConfig } from '../tier/uobEnvConfiguration';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { DbInstanceRoleAssociation } from '@cdktf/provider-aws/lib/db-instance-role-association';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { S3BackendConfig } from 'cdktf';
import { DfWafStack } from '../../stacks';

/**
 * Represents a UOB cluster.
 */
export class UobCluster {
  private helper: UobHelperStack;
  protected uobStack: UobStack;
  protected sopsData: PlatformSecrets;
  protected clusterConfiguration: environmentConfig;
  private _tiers: UobTier[];
  protected _clusterName: string;
  private sharedNetworkProvider: AwsProvider;
  private networkInstanceBackend: S3BackendConfig;
  private recoveryNetworkInstanceBackend: S3BackendConfig;
  private paloNetworkBackend: S3BackendConfig;
  private useDbConfigs: boolean;
  private customerDefinition: CustomerDefinition;

  /**
   * A map of tiers to their associated instances.
   */
  private instanceMap: Record<
    UobTierType,
    { instance: DfPrivateInstanceConstruct; hostname: string }[]
  > = {} as Record<
    UobTierType,
    { instance: DfPrivateInstanceConstruct; hostname: string }[]
  >;

  private recoveryInstanceMap: Record<
    UobTierType,
    { instance: DfPrivateInstanceConstruct; hostname: string }[]
  > = {} as Record<
    UobTierType,
    { instance: DfPrivateInstanceConstruct; hostname: string }[]
  >;
  private provider: AwsProvider;
  private route53Zone: DataAwsRoute53Zone;
  private dbConfigs: OracleStackConfig[];
  private masterAccountProviderConfig: AccountProviderConfig;
  private publicIngressAlbs: { [key: string]: DfPublicIngressConstruct } = {};

  /**
   * Creates a new UOB cluster.
   * @param {string} clusterName - The name of the cluster
   * @param {UobClusterNamedParameters} options - The options for the cluster.
   * @param {UobHelperStack} options.helper - The helper stack.
   * @param {UobStack} options.uobStack - The UOB stack.
   * @param {PlatformSecrets} options.sopsData - The SOPS data.
   * @param {UobTierConstructor[]} options.tierClasses - The constructors for the tiers.
   */
  constructor({
    helper,
    uobStack,
    sopsData,
    clusterConfiguration,
    networkInstanceBackend,
    recoveryNetworkInstanceBackend,
    paloNetworkBackend,
    customerDefinition,
  }: UobClusterNamedParameters) {
    this.helper = helper;
    this.uobStack = uobStack;
    this.sopsData = sopsData;
    this.clusterConfiguration = clusterConfiguration;
    this._clusterName = this.clusterConfiguration.properties.clusterName;
    this.dbConfigs = this.clusterConfiguration.dbConfigs;
    this.networkInstanceBackend = networkInstanceBackend;
    this.recoveryNetworkInstanceBackend = recoveryNetworkInstanceBackend;
    this.paloNetworkBackend = paloNetworkBackend;
    this.customerDefinition = customerDefinition;

    const sharedProperites = this.clusterConfiguration.properties;
    const tierDefinitions = this.clusterConfiguration['tiers'];
    const tiersToCreate: string[] = Object.keys(tierDefinitions);

    this.provider = uobStack.getProvider();

    this._tiers = tiersToCreate.map((tierToCreate: UobTierType): UobTier => {
      const tierConfiguration = tierDefinitions[tierToCreate];
      return new UobTier({
        uobHelper: this.helper,
        uobStack: this.uobStack,
        sopsData: this.sopsData,
        tierType: tierToCreate,
        tierConfiguration: tierConfiguration,
        sharedProperties: sharedProperites,
        accountDefinition: this.uobStack.stackConfig.accountDefinition,
      });
    });

    this.sharedNetworkProvider = this.uobStack.createAwsProvider({
      supportedRegion: this.uobStack.region,
      forAccount: Utils.getSharedNetworkAccountProviderConfig(),
    });

    this.createClusterInstances();
    this.publicAccess();
    this.createCustomerLb();
    this.createRoute53Records();

    // Only create an oracle db if the configuration includes a dbConfig that is not empty
    if (
      this.clusterConfiguration.properties.useDbConfigs &&
      this.dbConfigs &&
      this.dbConfigs.length > 0
    ) {
      this.createUobOracleDbs();
    }
  }

  /**
   * Returns the UOB stack.
   */
  public get stack() {
    return this.uobStack;
  }

  /**
   * Creates the instances for each tier in the cluster.
   */
  protected createClusterInstances() {
    this._tiers.forEach((tier) => {
      const tierInstances = tier.createTierInstances();
      this.addInstancesForTier({
        tier: tier.tierName,
        instances: tierInstances,
      });
      this.addRecoveryInstancesForTier({
        tier: tier.tierName,
        instances: tier.getRecoveryInstances(),
      });
    });
  }

  /**
   *
   * @param {any} param0
   */
  private addInstancesForTier({
    tier,
    instances,
  }: {
    tier: UobTierType;
    instances: { instance: DfPrivateInstanceConstruct; hostname: string }[];
  }) {
    this.instanceMap[tier] = instances;
  }

  private addRecoveryInstancesForTier({
    tier,
    instances,
  }: {
    tier: UobTierType;
    instances: { instance: DfPrivateInstanceConstruct; hostname: string }[];
  }) {
    this.recoveryInstanceMap[tier] = instances;
  }

  /**
   *
   */
  private publicAccess() {
    // If public ingress exits and is not empty then continue otherwise fail fast
    if (
      !Array.isArray(
        this.clusterConfiguration.properties.publicIngressPartial
      ) ||
      !this.clusterConfiguration.properties.publicIngressPartial.length
    ) {
      return;
    }

    const masterProvider = this.uobStack.createAwsProvider({
      supportedRegion: this.uobStack.region,
      forAccount: Utils.getMasterAccountProviderConfig(),
    });

    const sharedNetworkProvider = this.uobStack.createAwsProvider({
      supportedRegion: this.uobStack.region,
      forAccount: Utils.getSharedNetworkAccountProviderConfig(
        this.uobStack.isInPlatformSandboxEnvironments()
      ),
    });

    const route53Provider = this.uobStack.createAwsProvider({
      supportedRegion: this.uobStack.region,
      forAccount: Utils.getSharedNetworkAccountProviderConfig(),
    });

    this.clusterConfiguration.properties.publicIngressPartial.forEach(
      (publicIngressPartial) => {
        const domainName = publicIngressPartial.recordProps.skipDomain
          ? publicIngressPartial.recordProps.recordName
          : publicIngressPartial.recordProps.skipSubDomain
          ? `${publicIngressPartial.recordProps.recordName}.dragonflyft.com`
          : `${publicIngressPartial.recordProps.recordName}.${this.uobStack.stackConfig.envSubdomain}.dragonflyft.com`;
        // * Enable Public Ingress if the config is set
        this.publicIngressAlbs[publicIngressPartial.recordProps.recordName] =
          new DfPublicIngressConstruct(
            this.uobStack,
            `${
              publicIngressPartial.recordProps.constructName
                ? publicIngressPartial.recordProps.constructName
                : publicIngressPartial.recordProps.recordName
            }-${this.uobStack.stackConfig.envSubdomain}-public-ingress`,
            null,
            {
              rootZoneNameOverride: publicIngressPartial.recordProps
                .rootZoneNameOverride
                ? publicIngressPartial.recordProps.rootZoneNameOverride
                : null,
              providers: {
                constructProvider:
                  this.uobStack.getProviderForRegion(
                    publicIngressPartial.albProps.region
                  ) || this.uobStack.getProvider(),
                masterProvider: masterProvider,
                networkProvider: sharedNetworkProvider,
                route53Provider: route53Provider,
                recoveryProvider: this.uobStack.recoveryProvider,
              },
              instancesForTargetGroup:
                publicIngressPartial.msiTargetTierOverride
                  ? this.getInstancesByTier('msi')
                  : this.getInstancesByTier('web'),
              recoveryInstancesForTargetGroup:
                this.getRecoveryInstancesByTier('web'),
              certDomainName: domainName,
              r53RecordName: domainName,
              albName: `${
                publicIngressPartial.recordProps.constructName
                  ? publicIngressPartial.recordProps.constructName
                  : publicIngressPartial.recordProps.recordName
              }-${this.uobStack.stackConfig.envSubdomain}-public-ALB`,
              networkBackendProps: this.networkInstanceBackend,
              recoveryNetworkBackendProps: this.recoveryNetworkInstanceBackend,
              wafId: new DfWafStack(
                `${
                  publicIngressPartial.recordProps.constructName
                    ? publicIngressPartial.recordProps.constructName
                    : publicIngressPartial.recordProps.recordName
                }-${this.uobStack.stackConfig.envSubdomain}-public-WAF`,
                this.uobStack.stackConfig,
                publicIngressPartial.wafConfig,
                publicIngressPartial.deploySeparateWafStack
                  ? undefined
                  : this.uobStack
              ).webAclArn,
              albProps: {
                /**
                 * 180 is higher than the default threshold. We've requested our TAM increase the thresholds on all our existing distributions.
                 * This is set to 180 to both apply it to all existing distributions as well as throw an error as a reminder to request our
                 * TAM increases the timeout after we deploy the distribution.
                 *
                 * If you encounter an error because of this default, override it in the environment configuration, deploy it,
                 * request our TAM to increase the timeout, and then remove the override.
                 *  */
                cloudfrontOriginReadTimeout: 180,
                ...publicIngressPartial.albProps,
              },
              bucketNameOverride: publicIngressPartial.bucketName,
              deployToXL: publicIngressPartial.deployToXL ?? false,
              activeRegion: this.clusterConfiguration.properties.activeRegion,
            },
            false,
            this.uobStack.stackConfig.accountDefinition
          );
      }
    );
  }

  /**
   *
   */
  private createCustomerLb() {
    if (
      this.helper.getCustomerObjectSubnet() &&
      this.clusterConfiguration.tiers?.web?.customerMappings
    ) {
      this.clusterConfiguration.tiers?.web?.customerMappings.forEach(
        (customerMapping, index) => {
          const masterProvider = this.uobStack.createAwsProvider({
            supportedRegion: Utils.getRegionAliasFromRegion(
              this.uobStack.primaryProvider.region
            ),
            forAccount: Utils.getMasterAccountProviderConfig(),
          });
          const properties = <CustomerAlbConfig['lbProps']>(
            customerMapping.props
          );
          const lbProps = {
            targetGroups: properties.targetGroups.map((targetGroup) => {
              return {
                ...targetGroup,
                instancesForTargetGroup: this.getInstancesByTier('web'),
                recoveryInstancesForTargetGroup:
                  this.getRecoveryInstancesByTier('web'),
              };
            }),
          };

          // Maintain current customer mapped alb id and name the same but increment the rest
          const albId =
            index === 0
              ? 'customer-lb-internal-alb'
              : `customer-lb-internal-alb'-${index}`;

          const albName =
            index === 0
              ? `${this.clusterConfiguration.properties.fiName}-customer-alb`
              : `${this.clusterConfiguration.properties.fiName}-${index}-customer-alb`;

          new DfCustomerAlbConstruct(this.uobStack, albId, {
            lbName: albName,
            overrideTgConstructName: false,
            accountDefinition: this.uobStack.stackConfig.accountDefinition,
            lbProps: lbProps,
            certDomainName: `${customerMapping.customerSubdomain}.${this.uobStack.stackConfig.envSubdomain}.dragonflyft.com`,
            recoveryNetworkBackendProps: this.recoveryNetworkInstanceBackend,
            networkBackendProps: this.networkInstanceBackend,
            providers: {
              constructProvider: this.uobStack.primaryProvider,
              networkProvider: null,
              route53Provider: null,
              masterProvider: masterProvider,
              recoveryProvider: this.uobStack.recoveryProvider,
            },
            customerDefinition: this.customerDefinition,
            activeRegion: this.clusterConfiguration.properties.activeRegion,
          });
        }
      );
    }
    if (
      this.helper.getCustomerObjectSubnet() &&
      this.clusterConfiguration.tiers?.rt?.customerMappings
    ) {
      this.clusterConfiguration.tiers?.rt?.customerMappings.forEach(
        (customerMapping, index) => {
          const masterProvider = this.uobStack.createAwsProvider({
            supportedRegion: Utils.getRegionAliasFromRegion(
              this.uobStack.primaryProvider.region
            ),
            forAccount: Utils.getMasterAccountProviderConfig(),
          });

          // Maintain current customer mapped nlb id the same but increment the rest
          const nlbId =
            index === 0
              ? `${this.clusterConfiguration.properties.fiName}-rt-lb`
              : `${this.clusterConfiguration.properties.fiName}-${index}-rt-lb`;

          new DfCustomerNlbConstruct(
            this.uobStack,
            nlbId,
            this.uobStack.stackConfig,
            {
              lbName: nlbId,
              customerDefinition: this.customerDefinition,
              accountDefinition: this.uobStack.stackConfig.accountDefinition,
              lbProps: {
                targetGroups: (<CustomerLbConfig['lbProps']>(
                  customerMapping.props
                )).targetGroups.map((tg) => {
                  return {
                    constructName: tg.constructName,
                    instancesForTargetGroup: this.getInstancesByTier('rt'),
                    recoveryInstancesForTargetGroup:
                      this.getRecoveryInstancesByTier('rt'),
                    targetPort: tg.targetPort,
                    targetProtocol: tg.targetProtocol,
                    healthCheck: tg.healthCheck,
                    listeners: tg.listeners,
                  };
                }),
              },
              certDomainName: `${customerMapping.customerSubdomain}.${this.uobStack.stackConfig.envSubdomain}.dragonflyft.com`,
              networkBackendProps: this.networkInstanceBackend,
              recoveryNetworkBackendProps: this.recoveryNetworkInstanceBackend,
              providers: {
                constructProvider: this.uobStack.primaryProvider,
                networkProvider: null,
                route53Provider: null,
                masterProvider: masterProvider,
                recoveryProvider: this.uobStack.recoveryProvider,
              },
              activeRegion: this.clusterConfiguration.properties.activeRegion,
            }
          );
        }
      );
    }
    if (
      this.helper.getCustomerObjectSubnet() &&
      this.clusterConfiguration.tiers?.mq?.customerMappings
    ) {
      this.clusterConfiguration.tiers?.mq?.customerMappings.forEach(
        (customerMapping, index) => {
          const masterProvider = this.uobStack.createAwsProvider({
            supportedRegion: Utils.getRegionAliasFromRegion(
              this.uobStack.primaryProvider.region
            ),
            forAccount: Utils.getMasterAccountProviderConfig(),
          });

          // Maintain current customer mapped nlb id the same but increment the rest
          const nlbId =
            index === 0
              ? `${this.clusterConfiguration.properties.fiName}-mq-lb`
              : `${this.clusterConfiguration.properties.fiName}-${index}-mq-lb`;

          new DfCustomerNlbConstruct(
            this.uobStack,
            nlbId,
            this.uobStack.stackConfig,
            {
              lbName: nlbId,
              customerDefinition: this.customerDefinition,
              accountDefinition: this.uobStack.stackConfig.accountDefinition,
              lbProps: {
                targetGroups: (<CustomerLbConfig['lbProps']>(
                  customerMapping.props
                )).targetGroups.map((tg) => {
                  return {
                    constructName: tg.constructName,
                    instancesForTargetGroup: this.getInstancesByTier('mq'),
                    recoveryInstancesForTargetGroup:
                      this.getRecoveryInstancesByTier('mq'),
                    targetPort: tg.targetPort,
                    targetProtocol: tg.targetProtocol,
                    healthCheck: tg.healthCheck,
                    listeners: tg.listeners,
                  };
                }),
              },
              certDomainName: `${customerMapping.customerSubdomain}.${this.uobStack.stackConfig.envSubdomain}.dragonflyft.com`,
              networkBackendProps: this.networkInstanceBackend,
              recoveryNetworkBackendProps: this.recoveryNetworkInstanceBackend,
              providers: {
                constructProvider: this.uobStack.primaryProvider,
                networkProvider: null,
                route53Provider: null,
                masterProvider: masterProvider,
                recoveryProvider: this.uobStack.recoveryProvider,
              },
              activeRegion: this.clusterConfiguration.properties.activeRegion,
            }
          );
        }
      );
    }
  }

  /**
   * @return {Array<{instance: DfPrivateInstanceConstruct, hostname: string}>}
   */
  public get instances() {
    return Object.values(this.instanceMap).flat();
  }

  public get recoveryInstances() {
    return Object.values(this.instanceMap).flat();
  }

  /**
   * @return {UobTierType[]}
   */
  public get tierTypes(): UobTierType[] {
    return Object.keys(this.instanceMap) as UobTierType[];
  }

  /**
   * @return {UobTier[]}
   */
  public get tiers(): UobTier[] {
    return this._tiers;
  }

  /**
   * @return {string}
   */
  public get clusterName(): string {
    return this._clusterName;
  }

  /**
   * @return {string}
   */
  public get fiName(): string {
    return this.clusterConfiguration.properties.fiName;
  }

  /**
   *
   * @param {UobTierType} tier
   * @return {Array<string>}
   */
  public getInstanceIdsByTier(tier: UobTierType) {
    return this.instanceMap[tier].map(
      (obj) => obj.instance.instanceResource.id
    );
  }

  public getRecoveryInstanceIdsByTier(tier: UobTierType) {
    return this.recoveryInstanceMap[tier].map(
      (obj) => obj.instance.instanceResource.id
    );
  }

  /**
   *
   * @param {UobTierType} tier
   * @return {Array<string>}
   */
  public getInstancesByTier(tier: UobTierType): DfPrivateInstanceConstruct[] {
    return this.instanceMap[tier].map((obj) => obj.instance);
  }

  /**
   *
   * @param {UobTierType} tier
   * @return {Array<string>}
   */
  public getRecoveryInstancesByTier(
    tier: UobTierType
  ): DfPrivateInstanceConstruct[] {
    return this.recoveryInstanceMap[tier].map((obj) => obj.instance);
  }

  /**
   *
   * @param {UobTierType} tier -
   * @return {UobTier} -
   */
  private getTierByType(tier: UobTierType): UobTier {
    const uobTierArray = this._tiers.filter(
      (currentTier) => currentTier.tierName === `${tier}`
    );
    return uobTierArray[0];
  }

  /**
   *
   * @param {UobTierType} tier -
   * @return {UobTier} -
   */
  public getSecurityGroupByTier(tier: UobTierType): DfSecurityGroupConstruct {
    return this.getTierByType(tier).getSecurityGroup();
  }

  public findPublicDomain(publicRecord) {
    if (!(publicRecord in this.publicIngressAlbs)) {
      return undefined;
    }
    return this.publicIngressAlbs[publicRecord].cloudfrontDomain;
  }

  /**
   *
   */
  private createRoute53Records(): void {
    this.route53Zone = new DataAwsRoute53Zone(
      this.uobStack,
      `${this._clusterName}-private-zone-lookup`,
      {
        provider: this.sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );
    Object.entries(this.instanceMap).forEach(([key, val]) => {
      const currentTier = key;
      val.forEach((obj, index) => {
        const hostname = obj.hostname;
        const instance = obj.instance;
        const privateIp =
          this.clusterConfiguration.properties.activeRegion === 'recovery' &&
          this.recoveryInstanceMap[currentTier][index]
            ? this.recoveryInstanceMap[currentTier][index].instance
                .instanceResource.privateIp
            : instance.instanceResource.privateIp;

        new Route53Record(
          this.uobStack,
          `${hostname}${this.uobStack.stackConfig.envSubdomain}R53Record`,
          {
            provider: this.sharedNetworkProvider,
            name: `${[hostname, this.uobStack.stackConfig.envSubdomain].join(
              '.'
            )}.${this.route53Zone.name}`,
            type: 'A',
            zoneId: this.route53Zone.zoneId,
            records: [privateIp],
            ttl: 300,
          }
        );
      });
    });

    if (this.recoveryInstanceMap) {
      Object.entries(this.recoveryInstanceMap).forEach(([, val]) => {
        val.forEach((obj) => {
          new Route53Record(this.uobStack, `${obj.hostname}-record`, {
            provider: this.sharedNetworkProvider,
            name: `${[
              obj.hostname,
              this.uobStack.stackConfig.envSubdomain,
            ].join('.')}.${this.route53Zone.name}`,
            type: 'A',
            zoneId: this.route53Zone.zoneId,
            records: [obj.instance.instanceResource.privateIp],
            ttl: 300,
          });
        });
      });
    }
  }

  /**
   *
   */
  private createUobOracleDbs(): void {
    this.dbConfigs.map((dbConfig) => {
      const oracleRdsConstruct = new DfOracleConstruct(this.uobStack, {
        environment: this.uobStack.environment,
        provider: this.provider,
        accountDefinition: this.uobStack.stackConfig.accountDefinition,
        region: this.uobStack.region,
        subnetIds: this.uobStack.primaryVpc
          ? this.uobStack.primaryVpc.dataSubnetIds
          : this.uobStack.vpc.dataSubnetIds,
        vpcResource: this.uobStack.primaryVpc || this.uobStack.vpc,
        replicaConfig: this.helper.getUobReplicaConfig()
          ? {
              recoveryProvider: this.helper.recoveryProvider,
              recoveryVpc: this.helper.getUobReplicaConfig().recoveryVpc,
            }
          : null,
        ...dbConfig,
      });

      // Creates the oracle db route 53 record
      new Route53Record(this.uobStack, `${dbConfig.route53Name}R53Record`, {
        provider: this.sharedNetworkProvider,
        name: `${dbConfig.route53Name}.${this.route53Zone.name}`,
        type: 'CNAME',
        zoneId: this.route53Zone.zoneId,
        records:
          this.clusterConfiguration.properties.activeRegion === 'recovery' &&
          oracleRdsConstruct.oracleDbRecoveryInstanceResource
            ? [oracleRdsConstruct.oracleDbRecoveryInstanceResource.address]
            : [oracleRdsConstruct.oracleDbInstanceResource.address],
        ttl: 300,
      });

      // If the construct is not making the bucket, then we need to create the bucket here
      if (!dbConfig.createBucket) {
        this.createBucket(dbConfig, oracleRdsConstruct);
      }
    });
  }

  /**
   * Create a bucket for the Oracle instance
   * @param {OracleStackConfig} dbConfig
   * @param {DfOracleConstruct} oracleRdsConstruct
   */
  public createBucket(
    dbConfig: OracleStackConfig,
    oracleRdsConstruct: DfOracleConstruct
  ) {
    const bucket = new DfPrivateBucketConstruct(
      this.uobStack,
      `${this.uobStack.environment}-${dbConfig.id}-bucket`.toLowerCase(),
      {
        provider: this.provider,
        bucketName:
          `${this.uobStack.environment}-${dbConfig.id}-bucket`.toLowerCase(),
        keyProps: {
          name: `${dbConfig.id}-key`,
          description: `${dbConfig.id}-key`,
          provider: this.provider,
        },
      }
    );

    const bucketPolicyDocument = new DataAwsIamPolicyDocument(
      this.uobStack,
      `${dbConfig.id}-bucket-policy-document`,
      {
        provider: this.provider,
        statement: [
          {
            effect: 'Allow',
            actions: [
              's3:PutObject',
              's3:GetObject',
              's3:ListBucket',
              's3:DeleteObject',
            ],
            resources: [`${bucket.bucket.arn}`, `${bucket.bucket.arn}/*`],
          },
          {
            effect: 'Allow',
            actions: [
              'kms:Decrypt',
              'kms:Encrypt',
              'kms:ReEncryptTo',
              'kms:GenerateDataKey',
              'kms:DescribeKey',
              'kms:ReEncryptFrom',
            ],
            resources: [`${bucket.bucketKeyConstruct.key.arn}`],
          },
        ],
      }
    );

    const serviceRolePolicyDocument = new DataAwsIamPolicyDocument(
      this.uobStack,
      `${dbConfig.id}-service-role-policy-document`,
      {
        provider: this.provider,
        statement: [
          {
            effect: 'Allow',
            principals: [
              {
                type: 'Service',
                identifiers: ['rds.amazonaws.com'],
              },
            ],
            actions: ['sts:AssumeRole'],
          },
        ],
      }
    );

    const role = new DfIamRoleConstruct(this.uobStack, {
      provider: this.provider,
      roleName: `${dbConfig.id}-bucket-role`,
      permissionsDocuments: [bucketPolicyDocument],
      assumptionDocument: serviceRolePolicyDocument,
    });

    new DbInstanceRoleAssociation(
      this.uobStack,
      `${dbConfig.id}-role-association`,
      {
        provider: this.provider,
        dbInstanceIdentifier:
          oracleRdsConstruct.oracleDbInstanceResource.identifier,
        featureName: 'S3_INTEGRATION',
        roleArn: role.role.arn,
      }
    );
  }
}
