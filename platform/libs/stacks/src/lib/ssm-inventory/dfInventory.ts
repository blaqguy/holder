import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import { RemoteStack, StackConfig } from '../stacks';
import { SsmResourceDataSync } from '@cdktf/provider-aws/lib/ssm-resource-data-sync';
import { DfCrossAccountS3BucketStack } from '../crossAccountS3Bucket/dfCrossAccountS3BucketStack';
import { Constants } from '@dragonfly/utils';

/**
 * Stack to enable inventory collection on all SSM managed instances
 */
export class DfInventoryStack extends RemoteStack {
  private readonly crossAccountS3BucketStack: DfCrossAccountS3BucketStack;
  /**
   * Constructs an instance of DfInventory
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   * @param {S3BackendConfig} s3BackendConfig - s3 backend props
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    private stackDependency: DfCrossAccountS3BucketStack
  ) {
    super(stackId, stackConfig);

    const providers = [null, this.primaryProvider, this.recoveryProvider]

    this.addDependency(stackDependency)

    providers.forEach((provider, index) => {
      new SsmAssociation(this, `ssmInventoryAssociation-${index}`, {
        provider: provider,
        name: 'AWS-GatherSoftwareInventory',
        associationName: 'enable-ssm-inventory',
        targets: [
          {
            key: 'InstanceIds',
            values: ['*'],
          },
        ],
        scheduleExpression: 'rate(24 hours)',
        parameters: {
          applications: 'Enabled',
          awsComponents: 'Enabled',
          windowsUpdates: 'Enabled',
          services: 'Enabled',
        },
      });
      
      new SsmResourceDataSync(this, `ssmInventoryResourceDataSync-${index}`, {
        provider: provider,
        name: 'ssm-inventory-resource-data-sync',
        s3Destination: {
          bucketName: Constants.S3BUCKETS.INVENTORY_BUCKET.NAME,
          region: Constants.S3BUCKETS.INVENTORY_BUCKET.REGION,
        },
      });      
    });
  }
}
