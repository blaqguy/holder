import {
  DfIamRoleConstruct,
  DfOracleConstruct,
  DfPrivateBucketConstruct,
  OracleStackConfig,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { DbInstance } from '@cdktf/provider-aws/lib/db-instance';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DbInstanceRoleAssociation } from '@cdktf/provider-aws/lib/db-instance-role-association';
import { Constants } from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

/**
 * Oracle database Stack
 */
export class DfOracleDatabaseStack extends RemoteStack {
  protected oracleRdsConstruct: DfOracleConstruct;
  protected provider: AwsProvider;

  /**
   *
   * @param {StackConfig} stackConfig - Config for the stack
   * @param {OracleConfig} databaseConfig - database config
   */
  public constructor(
    protected stackId: string,
    protected stackConfig: StackConfig,
    protected databaseConfig: OracleStackConfig,
    protected region: Constants.AWS_REGION_ALIASES = Constants
      .AWS_REGION_ALIASES.LEGACY
  ) {
    super(stackId, stackConfig);

    // Retrieves the current provider based on the region passed in
    this.provider = this.getProviderForRegion(region);

    databaseConfig.accountDefinition = this.stackConfig.accountDefinition;
    this.oracleRdsConstruct = new DfOracleConstruct(this, {
      ...databaseConfig,
      ...{
        environment: this.stackConfig.envName,
        provider: this.provider,
        region: region,
        accountDefinition: this.stackConfig.accountDefinition,
      },
    });

    // If the construct is not making the bucket, then we need to create the bucket here
    if (!this.databaseConfig.createBucket) {
      this.createBucket();
    }
  }

  /**
   * Create a bucket for the Oracle instance
   */
  private createBucket() {
    const bucket = new DfPrivateBucketConstruct(
      this,
      `${this.environment}-${this.databaseConfig.id}-bucket`.toLowerCase(),
      {
        provider: this.provider,
        bucketName:
          `${this.environment}-${this.databaseConfig.id}-bucket`.toLowerCase(),
        keyProps: {
          name: `${this.databaseConfig.id}-key`,
          description: `${this.databaseConfig.id}-key`,
          provider: this.provider,
        },
      }
    );

    const bucketPolicyDocument = new DataAwsIamPolicyDocument(
      this,
      `${this.databaseConfig.id}-bucket-policy-document`,
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
      this,
      `${this.databaseConfig.id}-service-role-policy-document`,
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

    const role = new DfIamRoleConstruct(this, {
      provider: this.provider,
      roleName: `${this.databaseConfig.id}-bucket-role`,
      permissionsDocuments: [bucketPolicyDocument],
      assumptionDocument: serviceRolePolicyDocument,
    });

    new DbInstanceRoleAssociation(
      this,
      `${this.databaseConfig.id}-role-association`,
      {
        provider: this.provider,
        dbInstanceIdentifier:
          this.oracleRdsConstruct.oracleDbInstanceResource.identifier,
        featureName: 'S3_INTEGRATION',
        roleArn: role.role.arn,
      }
    );
  }
  /**
   * @return {DbInstance}
   */
  public get oracleDbInstanceResource(): DbInstance {
    return this.oracleRdsConstruct.oracleDbInstanceResource;
  }

  /**
   * @return {DbInstance}
   */
  public get oracleDbRecoveryInstanceResource(): DbInstance {
    return this.oracleRdsConstruct.oracleDbRecoveryInstanceResource;
  }
}
