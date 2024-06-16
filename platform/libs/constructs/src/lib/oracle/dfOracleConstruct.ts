import { Construct } from 'constructs';
import { DbInstance } from '@cdktf/provider-aws/lib/db-instance';
import {
  DbOptionGroup,
  DbOptionGroupOption,
} from '@cdktf/provider-aws/lib/db-option-group';
import { DbSubnetGroup } from '@cdktf/provider-aws/lib/db-subnet-group';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DfSpokeVpcConstruct } from '../vpc';
import {
  AccountDefinition,
  Constants,
  DfAccounts,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import {
  DbParameterGroup,
  DbParameterGroupConfig,
} from '@cdktf/provider-aws/lib/db-parameter-group';
import {
  DfAliasedKeyConstruct,
  DfIamRoleConstruct,
  DfPrivateBucketConstruct,
} from '../constructs';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DbInstanceRoleAssociation } from '@cdktf/provider-aws/lib/db-instance-role-association';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Fn } from 'cdktf';

export interface OracleStackConfig {
  id: string;
  subnetIds?: string[];
  route53Name?: string;
  engine: 'oracle-ee' | 'oracle-se2';
  engineVersion: string;
  storageType: string;
  allocatedStorage: number;
  vpcResource?: DfSpokeVpcConstruct;
  instanceClass: string;
  performanceInsightsEnabled: boolean;
  multiRegionKey?: boolean;
  parameterGroupName?: string;
  parameterGroupConfig?: DbParameterGroupConfig;
  createBucket: boolean;
  accountDefinition?: AccountDefinition;
  snapshotIdentifier?: string;
  dbName?: string;
  sopsDbProperty?: string;
  deployMultiAz?: boolean;
  applyImmediately?: boolean;
  backupPolicy?: string;
  additionalOptions?: DbOptionGroupOption[];
  prodCustomerData?: boolean;
  additionalSgCidrBlocks?: string[];
  availabilityZone?: string;
  timezone?: string;
  optionGroupName?: string;
  replicaConfig?: {
    recoveryProvider: AwsProvider;
    recoveryVpc: DfSpokeVpcConstruct;
  };
  kmsNameOverride?: string;
  kmsProviderOverride?: AwsProvider;
  characterSetName?: string;
}

export interface OracleConfig extends OracleStackConfig {
  environment: string;
  region?: Constants.AWS_REGION_ALIASES;
  provider?: AwsProvider;
  subnetIds?: string[];
  vpcResource?: DfSpokeVpcConstruct;
  multiRegionKey?: boolean;
}

/**
 * Oracle Stack
 */
export class DfOracleConstruct extends Construct {
  protected optionsGroup: DbOptionGroup;
  protected instance: DbInstance;
  protected recoveryInstance: DbInstance;
  protected subnetGroup: DbSubnetGroup;
  protected securityGroup: SecurityGroup;
  protected config: OracleConfig;

  /**
   * @param {Construct} scope - Root CDK app
   * @param {OracleConfig} config - The Oracle config
   */
  constructor(scope: Construct, config: OracleConfig) {
    super(scope, config.id);
    this.config = config;
    this.config.multiRegionKey = this.config.multiRegionKey
      ? this.config.multiRegionKey
      : false;

    // Retrieve sops data that contains RDS config credentials

    this.createOptionGroup();
    this.createInstance();
    if (this.config.createBucket) {
      this.createBucket();
    }
  }

  /**
   * Create a bucket for the Oracle instance
   */
  public createBucket() {
    const bucket = new DfPrivateBucketConstruct(
      this,
      `${this.config.environment}-${this.config.id}-bucket`.toLowerCase(),
      {
        provider: this.config.provider,
        bucketName:
          `${this.config.environment}-${this.config.id}-bucket`.toLowerCase(),
        keyProps: {
          name: `${this.config.id}-key`,
          description: `${this.config.id}-key`,
          provider: this.config.kmsProviderOverride ?? undefined,
        },
      }
    );

    const bucketPolicyDocument = new DataAwsIamPolicyDocument(
      this,
      `${this.config.id}-bucket-policy-document`,
      {
        provider: this.config.provider,
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
      this,
      `${this.config.id}-service-role-policy-document`,
      {
        provider: this.config.provider,
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

    const role = new DfIamRoleConstruct(this, {
      provider: this.config.provider,
      roleName: `${this.config.id}-bucket-role`,
      permissionsDocuments: [bucketPolicyDocument],
      assumptionDocument: serviceRolePolicyDocument,
    });

    new DbInstanceRoleAssociation(this, `${this.config.id}-role-association`, {
      provider: this.config.provider,
      dbInstanceIdentifier: this.instance.identifier,
      featureName: 'S3_INTEGRATION',
      roleArn: role.role.arn,
    });
  }

  /**
   * Create the option group for the Oracle instance
   */
  private createOptionGroup() {
    this.optionsGroup = new DbOptionGroup(
      this,
      `${this.config.id}-options-group`,
      {
        provider: this.config.provider,
        name: this.config.optionGroupName
          ? this.config.optionGroupName
          : this.config.id,
        engineName: this.config.engine,
        majorEngineVersion: this.config.engineVersion,
        option: [
          {
            optionName: 'S3_INTEGRATION',
            version: '1.0',
          },
          {
            optionName: 'Timezone',
            optionSettings: [
              {
                name: 'TIME_ZONE',
                value: this.config.timezone || 'UTC',
              },
            ],
          },
          ...(this.config.additionalOptions || []),
        ],
        tags: { Name: this.config.id },
      }
    );
  }

  /**
   * Create the Oracle instance
   */
  private createInstance() {
    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    this.subnetGroup = new DbSubnetGroup(
      this,
      `${this.config.id}-subnet-group`,
      {
        provider: this.config.provider,
        name: this.config.id,
        subnetIds: this.config.subnetIds,
        tags: { Name: this.config.id },
      }
    );

    switch (this.config.region) {
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY: {
        this.securityGroup = this.createSecurityGroups(
          DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
            .gatewayVpcCidr
        );
        break;
      }
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY: {
        this.securityGroup = this.createSecurityGroups(
          DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
            .gatewayVpcCidr
        );
        break;
      }
      default: {
        this.securityGroup = this.createSecurityGroups(
          DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
            .gatewayVpcCidr
        );
        break;
      }
    }

    const key = new DfAliasedKeyConstruct(this, `${this.config.id}-key`, {
      name: this.config.kmsNameOverride
        ? this.config.kmsNameOverride
        : `${this.config.id}-oracle-key`,
      description: 'The KMS key for encypting the DB',
      provider: this.config.provider,
      multiRegion:
        this.config.multiRegionKey || this.config.replicaConfig ? true : false,
      recoveryProvider: this.config.replicaConfig
        ? this.config.replicaConfig.recoveryProvider
        : null,
    });

    const rdsConfigToUse: string = this.config.sopsDbProperty
      ? this.config.sopsDbProperty
      : 'testingStack';
    this.instance = new DbInstance(this, `${this.config.id}-db-instance`, {
      provider: this.config.provider,
      identifier: this.config.id,
      engine: this.config.engine,
      engineVersion: this.config.engineVersion,
      storageType: this.config.storageType ?? 'gp3',
      allocatedStorage: this.config.allocatedStorage,
      instanceClass: this.config.instanceClass,
      username: sopsData.RDS_CONFIG_CREDS[rdsConfigToUse].username,
      password: sopsData.RDS_CONFIG_CREDS[rdsConfigToUse].password,
      licenseModel: this.getLicenseModel(),
      availabilityZone: this.config.availabilityZone ?? undefined,
      dbSubnetGroupName: this.subnetGroup.name,
      vpcSecurityGroupIds: [this.securityGroup.id],
      optionGroupName: this.optionsGroup.name,
      finalSnapshotIdentifier: `${this.config.id}-final`,
      snapshotIdentifier: this.config.snapshotIdentifier ?? undefined,
      performanceInsightsEnabled: this.config.performanceInsightsEnabled,
      backupRetentionPeriod: 7,
      backupWindow: '00:30-02:30',
      deletionProtection: true,
      parameterGroupName: this.config.parameterGroupName
        ? this.config.parameterGroupName
        : this.config.parameterGroupConfig
        ? new DbParameterGroup(this, `${this.config.id}`, {
            ...this.config.parameterGroupConfig,
            ...{ provider: this.config.provider },
            tags: { Name: this.config.id },
          }).name
        : undefined,
      dbName: this.config.dbName ?? 'ORCL',
      multiAz:
        Utils.isEnvironmentProd(this.config.accountDefinition) ||
        this.config.deployMultiAz
          ? this.config.deployMultiAz
          : null,
      applyImmediately:
        this.config.applyImmediately || this.config.deployMultiAz || false,
      kmsKeyId: key.arn,
      storageEncrypted: true,
      tags: {
        Name: this.config.id,
        'backup-policy': this.config.backupPolicy ?? 'root-ou-rds',
        'customer-data': this.config.prodCustomerData ? 'true' : 'false',
      },
      characterSetName: this.config.characterSetName ?? undefined,
    });

    if (this.config.replicaConfig) {
      const recoverySubnet = new DbSubnetGroup(
        this,
        `${this.config.id}-recovery-subnet-group`,
        {
          provider: this.config.replicaConfig.recoveryProvider,
          name: `${this.config.id}-replica`,
          subnetIds: this.config.replicaConfig.recoveryVpc.dataSubnetIds,
          tags: { Name: this.config.id },
        }
      );
      const recoverySecurityGroup = this.createSecurityGroups(
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
        `${this.config.id}-replica`,
        this.config.replicaConfig.recoveryProvider,
        this.config.replicaConfig.recoveryVpc
      );

      this.recoveryInstance = new DbInstance(
        this,
        `${this.config.id}-recovery-db-instance`,
        {
          provider: this.config.replicaConfig.recoveryProvider,
          replicaMode: 'mounted',
          replicateSourceDb: this.instance.arn,
          identifier: `${this.config.id}-replica`,
          instanceClass: this.config.instanceClass,
          dbSubnetGroupName: recoverySubnet.name,
          vpcSecurityGroupIds: [recoverySecurityGroup.id],
          finalSnapshotIdentifier: `${this.config.id}-final`,
          snapshotIdentifier: this.config.snapshotIdentifier ?? undefined,
          performanceInsightsEnabled: this.config.performanceInsightsEnabled,
          backupRetentionPeriod: 7,
          backupWindow: '00:30-02:30',
          deletionProtection: true,
          multiAz: false,
          applyImmediately:
            this.config.applyImmediately || this.config.deployMultiAz || false,
          kmsKeyId: key.getReplicaKey().arn,
          storageEncrypted: true,

          tags: {
            Name: this.config.id,
            'backup-policy': this.config.backupPolicy ?? 'root-ou-rds',
            'customer-data': this.config.prodCustomerData ? 'true' : 'false',
          },
        }
      );
    }
  }

  /**
   *
   * @param {string} ingressCidrBlock
   * @param {string} securityGroupName
   * @param {AwsProvider} recoveryProvider
   * @param {DfSpokeVpcConstruct} recoveryVpc
   * @return {SecurityGroup}
   */
  private createSecurityGroups(
    ingressCidrBlock: string,
    securityGroupName?: string,
    recoveryProvider?: AwsProvider,
    recoveryVpc?: DfSpokeVpcConstruct
  ): SecurityGroup {
    const cidrBlocksDupsRemoved = Fn.distinct([
      ingressCidrBlock,
      this.config.vpcResource.vpcCidrBlock,
      this.config.replicaConfig
        ? this.config.replicaConfig.recoveryVpc.vpcCidrBlock
        : null,
      DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
      ...Utils.getIngressCidrBlocksByNetworkType(this.config.accountDefinition),
      ...(this.config.additionalSgCidrBlocks
        ? this.config.additionalSgCidrBlocks
        : []),
    ]);

    return new SecurityGroup(
      this,
      `${
        securityGroupName ? securityGroupName : this.config.id
      }-security-group`,
      {
        provider: recoveryProvider ? recoveryProvider : this.config.provider,
        name: securityGroupName ? securityGroupName : this.config.id,
        vpcId: recoveryVpc ? recoveryVpc.vpcId : this.config.vpcResource.vpcId,
        ingress: [
          {
            fromPort: 1521,
            toPort: 1521,
            protocol: 'tcp',
            cidrBlocks: cidrBlocksDupsRemoved,
            description: 'Allow incoming Client VPN and local VPC connections',
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
        tags: { Name: this.config.id },
      }
    );
  }

  private getLicenseModel() {
    if (this.config.engine === 'oracle-ee') {
      return 'bring-your-own-license';
    } else if (this.config.engine === 'oracle-se2') {
      return 'license-included';
    } else {
      throw new Error(
        `DF ERROR: Unkown engine type. The oracle engine type must be 'oracle-ee' or 'oracle-se2.`
      );
    }
  }

  /**
   * @return {DbInstance} - Returns the oracle db instance
   */
  public get oracleDbInstanceResource(): DbInstance {
    return this.instance;
  }

  /**
   * @return {DbInstance} - Returns the oracle db instance
   */
  public get oracleDbRecoveryInstanceResource(): DbInstance {
    return this.recoveryInstance;
  }

  /**
   * @return {DbOptionGroup} - Returns the DbOptionGroup
   */
  public get dbOptionGroupResource(): DbOptionGroup {
    return this.optionsGroup;
  }
}
