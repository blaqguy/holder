import { DfPrivateBucketConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants } from '@dragonfly/utils';

/**
 * Creates a cross-account bucket in tools for uploading all DFT lambda assets
 */
export class DfLambdaAssetsBucketStack extends RemoteStack {
  /**
   * @param {string} stackName - Takes in the stack name
   * @param {StackConfig} stackConfig - Takes in the stack config
   */
  constructor(stackName: string, stackConfig: StackConfig) {
    super(stackName, stackConfig);

    const supportedProviders = [this.primaryProvider, this.recoveryProvider];

    supportedProviders.forEach((provider) => {
      const regionalBucketName = `${Constants.DFT_LAMBDA_ASSETS_BUCKET_NAME}-${provider.region}`;

      new DfPrivateBucketConstruct(this, regionalBucketName, {
        bucketName: regionalBucketName,
        provider: provider,
        s3ManagedEncryption: true,
        bucketPolicyStatement: [
          {
            effect: 'Allow',
            principals: [
              {
                type: 'AWS',
                identifiers: Constants.ACCOUNT_NUMBERS,
              },
            ],
            actions: ['s3:GetObject', 's3:ListBucket'],
          },
        ],
      });
    });
  }
}
