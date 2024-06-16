import { Alb } from '@cdktf/provider-aws/lib/alb';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import {
  DfSpokeVpcConstruct,
  DfEcsConstruct,
  OracleStackConfig,
  DfOracleConstruct,
  DfPrivateBucketConstruct,
  DfIamRoleConstruct,
} from '@dragonfly/constructs';
import { AccountProviderConfig, Constants, Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { Asg } from '@dragonfly/generated';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DataAwsIamRole } from '@cdktf/provider-aws/lib/data-aws-iam-role';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DbInstanceRoleAssociation } from '@cdktf/provider-aws/lib/db-instance-role-association';

export type UPFReverseProxyStackConfig = {
  clusterVpcConstruct: DfSpokeVpcConstruct;
  upfDbConfig: OracleStackConfig;
  upfRoute53Name: string;
  // upfDbHostname?: string; // TODO: THIS IS TEMPORARILY OPTIONAL TO NOT BREAK EXISTING STACKS BUT SHOULD BE REMOVED AS DB WILL BE CREATED HERE
  dockerPushRoleAssumption: string;
  remoteStack: RemoteStack;
  useNewNaming?: boolean;
  accountProviderConfig?: AccountProviderConfig;
  oracleStackShell?: RemoteStack;
  oracleStackName?: string;
  useDynamicRoleName?: boolean;
};

/**
 *
 */
export class UPFReverseProxyStack {
  private _rpEcsConstruct: DfEcsConstruct;
  private _rpNLB: Alb;
  private _rpSG: SecurityGroup;
  private _rpASG: Asg;
  private _role: DataAwsIamRole;
  private provider: AwsProvider;
  public _oracleStackShell: RemoteStack;

  /**
   *
   * @param {string}stackName
   * @param {StackConfig}stackConfig
   * @param {UPFReverseProxyStackConfig}config
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private config: UPFReverseProxyStackConfig,
    protected region: Constants.AWS_REGION_ALIASES = Constants
      .AWS_REGION_ALIASES.LEGACY
  ) {
    this._oracleStackShell = config.oracleStackShell
      ? config.oracleStackShell
      : config.remoteStack;

    if (config.accountProviderConfig) {
      config.remoteStack.createAwsProvider({
        supportedRegion: this.region,
        forAccount: config.accountProviderConfig,
      });
      config.oracleStackShell.createAwsProvider({
        supportedRegion: this.region,
        forAccount: config.accountProviderConfig,
      });
    }

    // Retrieves the current provider based on the region passed in
    this.provider = config.remoteStack.getProviderForRegion(region);

    this.createUpfOracleDb(config.upfDbConfig, config);
  }

  /**
   * @return {DfOracleConstruct}
   * @param {OracleConfig} upfDbConfig
   * @param {UPFReverseProxyStackConfig} config
   * @param {boolean} deployWithReverseProxy
   */
  private createUpfOracleDb(
    upfDbConfig: OracleStackConfig,
    config: UPFReverseProxyStackConfig
  ): DfOracleConstruct {
    const oracleRdsConstruct = new DfOracleConstruct(this._oracleStackShell, {
      environment: config.remoteStack.environment,
      provider: this.provider,
      accountDefinition: this.stackConfig.accountDefinition,
      region: this.region,
      subnetIds: this.config.clusterVpcConstruct.dataSubnetIds,
      vpcResource: this.config.clusterVpcConstruct,
      ...upfDbConfig,
    });

    const sharedNetworkProvider = config.remoteStack.createAwsProvider({
      supportedRegion: this.region,
      forAccount: Utils.getSharedNetworkAccountProviderConfig(
        config.remoteStack.isInPlatformSandboxEnvironments()
      ),
    });

    const route53Zone = new DataAwsRoute53Zone(
      config.remoteStack,
      Utils.createStackResourceId(
        config.useNewNaming
          ? config.remoteStack.getStackUuid
          : config.upfDbConfig.id,
        `${this.stackName}-private-zone-lookup`
      ),
      {
        provider: sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    let oracleRoute53Zone;
    if (config.oracleStackShell) {
      oracleRoute53Zone = new DataAwsRoute53Zone(
        config.oracleStackShell,
        Utils.createStackResourceId(
          config.useNewNaming
            ? config.remoteStack.getStackUuid
            : config.upfDbConfig.id,
          `${this.stackName}-private-zone-lookup-oracle`
        ),
        {
          provider: sharedNetworkProvider,
          name: 'dragonflyft.com',
          privateZone: true,
        }
      );
    }

    // Creates the oracle db route53 record
    new Route53Record(
      this._oracleStackShell,
      Utils.createStackResourceId(
        config.useNewNaming ? null : config.upfDbConfig.id,
        `${upfDbConfig.route53Name}R53Record`
      ),
      {
        provider: sharedNetworkProvider,
        name: `${upfDbConfig.route53Name}.${
          oracleRoute53Zone ? oracleRoute53Zone?.name : route53Zone.name
        }`,
        type: 'CNAME',
        zoneId: oracleRoute53Zone
          ? oracleRoute53Zone?.zoneId
          : route53Zone.zoneId,
        records: [oracleRdsConstruct.oracleDbInstanceResource.address],
        ttl: 300,
      }
    );

    // If the construct is not making the bucket, then we need to create the bucket here
    if (!upfDbConfig.createBucket) {
      this.createBucket(upfDbConfig, oracleRdsConstruct, config);
    }
    return oracleRdsConstruct;
  }

  /**
   * Create a bucket for the Oracle instance
   * @param {OracleStackConfig} dbConfig
   * @param {DfOracleConstruct} oracleRdsConstruct
   * @param {UPFReverseProxyStackConfig} config
   */
  private createBucket(
    dbConfig: OracleStackConfig,
    oracleRdsConstruct: DfOracleConstruct,
    config: UPFReverseProxyStackConfig
  ) {
    const bucket = new DfPrivateBucketConstruct(
      this._oracleStackShell,
      Utils.createStackResourceId(
        config.useNewNaming ? null : config.upfDbConfig.id,
        `${config.remoteStack.environment}-${dbConfig.id}-bucket`
      ).toLowerCase(),
      {
        provider: this.provider,
        bucketName:
          `${config.remoteStack.environment}-${dbConfig.id}-bucket`.toLowerCase(),
        keyProps: {
          name: `${dbConfig.id}-key`,
          description: `${dbConfig.id}-key`,
          provider: this.provider,
        },
      }
    );

    const bucketPolicyDocument = new DataAwsIamPolicyDocument(
      this._oracleStackShell,
      Utils.createStackResourceId(
        config.useNewNaming ? null : config.upfDbConfig.id,
        `${dbConfig.id}-bucket-policy-document`
      ),
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
      this._oracleStackShell,
      Utils.createStackResourceId(
        config.useNewNaming
          ? config.remoteStack.getStackUuid
          : config.upfDbConfig.id,
        `${dbConfig.id}-service-role-policy-document`
      ),
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

    const role = new DfIamRoleConstruct(this._oracleStackShell, {
      provider: this.provider,
      roleName:
        config.useNewNaming && config.oracleStackName
          ? `${config.oracleStackName.toLowerCase()}-bucket-role`
          : `${dbConfig.id}-bucket-role`,
      permissionsDocuments: [bucketPolicyDocument],
      assumptionDocument: serviceRolePolicyDocument,
    });

    new DbInstanceRoleAssociation(
      this._oracleStackShell,
      Utils.createStackResourceId(
        config.useNewNaming ? null : config.upfDbConfig.id,
        `${dbConfig.id}-role-association`
      ),
      {
        provider: this.provider,
        dbInstanceIdentifier:
          oracleRdsConstruct.oracleDbInstanceResource.identifier,
        featureName: 'S3_INTEGRATION',
        roleArn: role.role.arn,
      }
    );
  }

  /**
   * @return {Alb} rp NLB dns name
   */
  public get reverseProxyResource(): Alb {
    return this._rpNLB;
  }

  /**
   * @return {Asg}
   */
  public get asg(): Asg {
    return this._rpASG;
  }

  /**
   * @return {DataAwsIamRole}
   */
  public get role(): DataAwsIamRole {
    return this._role;
  }
}
