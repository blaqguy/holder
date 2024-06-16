import { DfPrivateBucketConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants } from '@dragonfly/utils';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { S3Object } from '@cdktf/provider-aws/lib/s3-object';

interface DfWindowsNetworkSensorAgentInstallerBucketConfig {
  regionAlias: Constants.AWS_REGION_ALIASES;
}

/**
 * Creates an S3 bucket where the Network Sensor Windows Agent installer is uploaded manually
 * Associations in each account will pull the MSI from the S3 bucket
 */
export class DfWindowsNetworkSensorAgentInstallerBucketStack extends RemoteStack {
  public bucket: DfPrivateBucketConstruct;
  public installerObject: S3Object;
  /**
   *
   * @param {StackConfig} stackConfig
   * @param {string} id
   * @param {DfWindowsNetworkSensorAgentInstallerBucketConfig} config
   */
  constructor(
    stackConfig: StackConfig,
    id: string,
    config: DfWindowsNetworkSensorAgentInstallerBucketConfig
  ) {
    super(id, stackConfig);

    const provider = this.getProviderForRegion(config.regionAlias);

    this.bucket = new DfPrivateBucketConstruct(
      this,
      'network-sensor-windows-agent-installer-bucket',
      {
        bucketName: 'dft-network-sensor-windows-agent-installer',
        provider: provider,
        s3ManagedEncryption: true,
      }
    );

    new S3BucketPolicy(
      this,
      'network-sensor-windows-agent-installer-bucket-policy',
      {
        provider: provider,
        bucket: this.bucket.bucket.bucket,
        policy: new DataAwsIamPolicyDocument(
          this,
          'network-sensor-windows-agent-installer-bucket-policy-doc',
          {
            provider: provider,
            version: '2012-10-17',
            statement: [
              {
                effect: 'Allow',
                principals: [
                  {
                    type: 'AWS',
                    identifiers: Constants.ACCOUNT_NUMBERS,
                  },
                ],
                actions: ['s3:GetObject', 's3:ListBucket'],
                resources: [
                  this.bucket.bucket.arn,
                  `${this.bucket.bucket.arn}/*`,
                ],
              },
            ],
          }
        ).json,
      }
    );
  }
}
