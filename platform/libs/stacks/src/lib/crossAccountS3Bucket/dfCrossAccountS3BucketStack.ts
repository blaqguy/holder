import { DfPrivateBucketConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import { Constants } from '@dragonfly/utils';
import { S3BucketLifecycleConfiguration } from '@cdktf/provider-aws/lib/s3-bucket-lifecycle-configuration';

export interface DfCrossAccountS3BucketStackConfig {
  bucketName: string;
  bucketRegion: Constants.AWS_REGION_ALIASES;
  s3ManagedEncryption?: boolean;
  retentionPeriod?: number;
  additionalPolicyStatements?: object[];
}

/**
 * Stack to create cross account S3 bucket
 */
export class DfCrossAccountS3BucketStack extends RemoteStack {
  private crossAccountS3Bucket: DfPrivateBucketConstruct;
  /**
   * Constructs an instance of DfCrossAccountS3Bucket
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   * @param {DfCrossAccountS3BucketStackConfig} config - config
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    config: DfCrossAccountS3BucketStackConfig
  ) {
    super(stackId, stackConfig);
    const currentAccountId = new DataAwsCallerIdentity(this, 'account_id', {})
      .accountId;

    // Retrieves the current provider based on the region passed in
    const provider = this.getProviderForRegion(config.bucketRegion);

    this.crossAccountS3Bucket = new DfPrivateBucketConstruct(
      this,
      `${config.bucketName}dfCrossAccountS3Bucket`,
      {
        provider: provider,
        bucketName: config.bucketName,
        s3ManagedEncryption: config.s3ManagedEncryption,
        keyProps: config.s3ManagedEncryption
          ? undefined
          : {
              name: config.bucketName,
              description: `KMS key for ${config.bucketName}`,
              policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Sid: 'AllowThisAccountFullAccess',
                    Effect: 'Allow',
                    Principal: {
                      AWS: `arn:aws:iam::${currentAccountId}:root`,
                    },
                    Action: 'kms:*',
                    Resource: '*',
                  },
                ],
              }),
            },
      }
    );

    new S3BucketPolicy(
      this,
      `${config.bucketName}dfCrossAccountS3BucketPolicy`,
      {
        provider: provider,
        bucket: this.crossAccountS3Bucket.bucket.id,
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'AllowIamRoles',
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${currentAccountId}:root`,
              },
              Action: 's3:*',
              Resource: [
                `arn:aws:s3:::${config.bucketName}`,
                `arn:aws:s3:::${config.bucketName}/*`,
              ],
            },
            {
              Sid: 'AllowOrgPrincipals',
              Effect: 'Allow',
              Principal: '*',
              Action: 's3:*',
              Resource: [
                `arn:aws:s3:::${config.bucketName}`,
                `arn:aws:s3:::${config.bucketName}/*`,
              ],
              Condition: {
                StringEquals: {
                  'aws:PrincipalOrgID': Constants.PRINCIPAL_ORG_ID,
                },
              },
            },
            ...(config.additionalPolicyStatements
              ? config.additionalPolicyStatements
              : []),
          ],
        }),
      }
    );

    new S3BucketLifecycleConfiguration(
      this,
      `${config.bucketName}dfCrossAccountS3BucketLifecycleConfiguration`,
      {
        bucket: this.crossAccountS3Bucket.bucket.id,
        rule: [
          {
            id: 'Delete objects after 7 days',
            status: 'Enabled',
            expiration: {
              days: config.retentionPeriod ?? 7,
            },
          },
          {
            id: 'Intelligent Tiering',
            status: 'Enabled',
            transition: [
              {
                storageClass: 'INTELLIGENT_TIERING',
              },
            ],
          },
        ],
      }
    );
  }

  /**
   * @return {string} - The bucket name
   */
  public get bucketName(): string {
    return this.crossAccountS3Bucket.bucket.id;
  }

  /**
   * @return {string} - The bucket region
   */
  public get bucketRegion(): string {
    return this.crossAccountS3Bucket.bucket.region;
  }

  /**
   * @return {string} - The bucket arn
   */
  public get bucketArn(): string {
    return this.crossAccountS3Bucket.bucket.arn;
  }
}
