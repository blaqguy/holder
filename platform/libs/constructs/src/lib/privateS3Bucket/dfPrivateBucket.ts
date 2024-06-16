import { S3Bucket, S3BucketConfig } from '@cdktf/provider-aws/lib/s3-bucket';
import { S3BucketPublicAccessBlock } from '@cdktf/provider-aws/lib/s3-bucket-public-access-block';
import { Construct } from 'constructs';
import {
  DfAliasedKeyConstruct,
  DfKeyProps,
} from '../aliasedKey/dfAliasedKeyConstruct';
import { S3BucketOwnershipControls } from '@cdktf/provider-aws/lib/s3-bucket-ownership-controls';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import {
  DataAwsIamPolicyDocument,
  DataAwsIamPolicyDocumentStatement,
} from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';

interface DfPrivateBucketProps {
  bucketName: string;
  s3ManagedEncryption?: boolean;
  keyProps?: DfKeyProps;
  bucketConfigOverride?: S3BucketConfig;
  provider?: AwsProvider;
  ownership?: 'BucketOwnerEnforced' | 'BucketOwnerPreferred';
  enableVersioning?: boolean;
  forceDestroy?: boolean;
  bucketPolicyStatement?: DataAwsIamPolicyDocumentStatement[];
}

/**
 * Private S3 bucket construct
 */
export class DfPrivateBucketConstruct extends Construct {
  public readonly bucket: S3Bucket;
  private bucketKey: DfAliasedKeyConstruct;

  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {string} id - A logical identifier for the construct
   * @param {DfPrivateBucketProps} props - Properties of the KmsKey used to encrypt the bucket
   */
  constructor(scope: Construct, id: string, props: DfPrivateBucketProps) {
    super(scope, id);

    props.keyProps
      ? (this.bucketKey = new DfAliasedKeyConstruct(this, id, props.keyProps))
      : undefined;

    this.bucket = new S3Bucket(
      this,
      `${id}Bucket`,
      props.bucketConfigOverride
        ? { bucket: props.bucketName, ...props.bucketConfigOverride }
        : {
            bucket: props.bucketName,
            versioning: {
              enabled: props.enableVersioning || true,
              mfaDelete: false,
            },
            serverSideEncryptionConfiguration: {
              rule: {
                applyServerSideEncryptionByDefault: {
                  sseAlgorithm: props.s3ManagedEncryption
                    ? 'AES256'
                    : 'aws:kms',
                  kmsMasterKeyId: props.keyProps
                    ? this.bucketKey.arn
                    : undefined,
                },
                bucketKeyEnabled: props.s3ManagedEncryption ? true : undefined, // * Reduces costs of SSE-KMS: https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-key.html
              },
            },
            provider: props.provider,
            tags: { Name: props.bucketName },
            forceDestroy: props.forceDestroy || false,
          }
    );

    new S3BucketOwnershipControls(this, `${id}OwnershipControl`, {
      provider: props.provider,
      bucket: this.bucket.id,
      rule: {
        objectOwnership: props.ownership ?? 'BucketOwnerEnforced',
      },
    });

    new S3BucketPublicAccessBlock(this, `${id}AccessBlock`, {
      provider: props.provider,
      bucket: this.bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    if (props.bucketPolicyStatement) {
      // Update the passed in bucketPolicyStatements to include the newly created bucket arn as the bucket policy resource
      const updatedStatements = props.bucketPolicyStatement.map((statement) => {
        return {
          ...statement,
          resources: [this.bucket.arn, `${this.bucket.arn}/*`],
        };
      });

      // Create optional Bucket policy based on passed in statements
      new S3BucketPolicy(this, `${props.bucketName}-bucket-policy`, {
        provider: props.provider,
        bucket: this.bucket.bucket,
        policy: new DataAwsIamPolicyDocument(
          this,
          `${props.bucketName}-bucket-policy-doc`,
          {
            provider: props.provider,
            version: '2012-10-17',
            statement: updatedStatements,
          }
        ).json,
      });
    }
  }

  /**
   * @return {AliasedKeyConstruct} - returns the bucketKey
   */
  public get bucketKeyConstruct(): DfAliasedKeyConstruct {
    return this.bucketKey;
  }

  /**
   * @return {string} - returns the bucket Id
   */
  public get bucketId(): string {
    return this.bucket.id;
  }
}
