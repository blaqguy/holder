import { DfPrivateBucketConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';

interface EbCrossAccountEfsShareBucketConfig {
  regionAlias: Constants.AWS_REGION_ALIASES;
}

/**
 * Creates a cross-account bucket in tools for sharing files on EFS across EB accounts
 * The MQ installation is baked into the EB MQ AMI, but depends on certain files existing
 * on the EB EFS to work properly. This bucket stores those files.
 */
export class EbCrossAccountEfsShareBucketStack extends RemoteStack {
  protected provider: AwsProvider;

  /**
   * @param {string} stackName - Takes in the stack name
   * @param {StackConfig} stackConfig - Takes in the stack config
   * @param {EbCrossAccountEfsShareBucketConfig} config - cross account bucket config
   */
  constructor(
    stackName: string,
    stackConfig: StackConfig,
    config: EbCrossAccountEfsShareBucketConfig
  ) {
    super(stackName, stackConfig);

    this.provider = this.getProviderForRegion(config.regionAlias);

    const bucket = new DfPrivateBucketConstruct(
      this,
      'dft-tools-eb-cross-account-efs-share',
      {
        bucketName: EbCrossAccountEfsShareBucketStack.bucketName,
        s3ManagedEncryption: true,
        provider: this.provider,
      }
    );

    new S3BucketPolicy(this, 'eb-cross-account-efs-share-bucket-policy', {
      provider: this.provider,
      bucket: bucket.bucket.bucket,
      policy: new DataAwsIamPolicyDocument(
        this,
        'eb-cross-account-efs-share-bucket-policy-doc',
        {
          provider: this.provider,
          version: '2012-10-17',
          statement: [
            {
              effect: 'Allow',
              principals: [
                {
                  type: 'AWS',
                  identifiers: [
                    `arn:aws:iam::${
                      DfAccounts.getEbCitAccountDef().accountNumber
                    }:root`,
                    `arn:aws:iam::${
                      DfAccounts.getEbQeAccountDef().accountNumber
                    }:root`,
                    `arn:aws:iam::${
                      DfAccounts.getEbProdAccountDef().accountNumber
                    }:root`,
                    `arn:aws:iam::${
                      DfAccounts.getEbUatAccountDef().accountNumber
                    }:root`,
                    `arn:aws:iam::${
                      DfAccounts.getToolsAccountDef().accountNumber
                    }:root`,
                  ],
                },
              ],
              actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject'],
              resources: [bucket.bucket.arn, `${bucket.bucket.arn}/*`],
            },
          ],
        }
      ).json,
    });
  }

  /**
   * @return {string}
   */
  static get bucketName(): string {
    return 'dft-tools-eb-cross-account-efs-share';
  }
}
