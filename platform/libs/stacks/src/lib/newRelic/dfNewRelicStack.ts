import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { RemoteStack, StackConfig } from '../stacks';
import { CloudAwsLinkAccount } from '@cdktf/provider-newrelic/lib/cloud-aws-link-account';
import { ApiAccessKey } from '@cdktf/provider-newrelic/lib/api-access-key';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { DfPrivateBucketConstruct } from '@dragonfly/constructs';
import { KinesisFirehoseDeliveryStream } from '@cdktf/provider-aws/lib/kinesis-firehose-delivery-stream';
import { CloudwatchMetricStream } from '@cdktf/provider-aws/lib/cloudwatch-metric-stream';

/**
 * * REFERENCE: https://github.com/newrelic/terraform-provider-newrelic/blob/main/examples/modules/cloud-integrations/aws/main.tf
 *
 * * Deleted The CloudIntegrationPull resources as it seems they're for
 * * The API polling functionality which we don't need
 */

export class DfNewRelicStack extends RemoteStack {
  constructor(stackUuid: string, staclConfig: StackConfig) {
    super(stackUuid, staclConfig);

    // * Global Resources
    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    const newRelicRole = new IamRole(this, 'newrelic-role', {
      name: 'NewRelicInfrastructure-Integrations',
      description: 'New Relic Cloud integration role',
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              AWS: 'arn:aws:iam::754728514883:root',
            },
            Action: 'sts:AssumeRole',
            Condition: {
              StringEquals: {
                'sts:ExternalId': '4262100',
              },
            },
          },
        ],
      }),
      managedPolicyArns: ['arn:aws:iam::aws:policy/ReadOnlyAccess'],
      inlinePolicy: [
        {
          name: 'NewRelicBudget',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Action: ['budgets:ViewBudget'],
                Effect: 'Allow',
                Resource: '*',
              },
            ],
          }),
        },
      ],
    });

    new CloudAwsLinkAccount(this, 'newrelic-aws-link-account', {
      arn: newRelicRole.arn,
      metricCollectionMode: 'PUSH',
      name: `AWS ${this.stackConfig.accountDefinition.name} Account`,
    });

    const newRelicApiKey = new ApiAccessKey(this, 'newrelic-api-key', {
      accountId: sopsData.NEW_RELIC_ACCOUNT_ID,
      name: `Metric Stream Key for ${this.stackConfig.accountDefinition.name}`,
      keyType: 'INGEST',
      ingestType: 'LICENSE',
    });

    const newRelicKinesisFireHoseRole = new IamRole(
      this,
      'newrelic-kinesis-firehose-role',
      {
        name: 'firehose_newrelic_role',
        description: 'New Relic Kinesis Firehose role',
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'firehose.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
      }
    );

    // * Regional Resources
    const regionalProviders = {
      [Constants.AWS_REGION_ALIASES.LEGACY]: null,
      [Constants.AWS_REGION_ALIASES.DF_PRIMARY]: this.primaryProvider,
      [Constants.AWS_REGION_ALIASES.DF_RECOVERY]: this.recoveryProvider,
    };

    for (const [region, provider] of Object.entries(regionalProviders)) {
      const newRelicS3Bucket = new DfPrivateBucketConstruct(
        this,
        `newrelic-s3-bucket-${region}`,
        {
          bucketName:
            `dft-${this.stackConfig.accountDefinition.name}-newrelic-${region}`.toLowerCase(),
          s3ManagedEncryption: true,
          ownership: 'BucketOwnerEnforced',
          forceDestroy: true,
          provider: provider,
        }
      );

      const newRelicMetricStreamDelivery = new KinesisFirehoseDeliveryStream(
        this,
        `newrelic-kinesis-firehose-${region}`,
        {
          provider: provider,
          name: `newrelic_firehose_stream_${region}`,
          destination: 'http_endpoint',
          httpEndpointConfiguration: {
            url: 'https://aws-api.newrelic.com/cloudwatch-metrics/v1',
            name: `${this.stackConfig.accountDefinition.name} New Relic`,
            accessKey: newRelicApiKey.key,
            bufferingSize: 1,
            bufferingInterval: 60,
            roleArn: newRelicKinesisFireHoseRole.arn,
            s3BackupMode: 'FailedDataOnly',
            s3Configuration: {
              roleArn: newRelicKinesisFireHoseRole.arn,
              bucketArn: newRelicS3Bucket.bucket.arn,
              bufferingInterval: 400,
              bufferingSize: 10,
              compressionFormat: 'GZIP',
            },
            requestConfiguration: {
              contentEncoding: 'GZIP',
            },
          },
        }
      );

      // Creating a role per region because its easier
      const newRelicMetricStreamRole = new IamRole(
        this,
        `newrelic-metric-stream-role-${region}`,
        {
          provider: provider,
          name: `newrelic_metric_stream_to_firehose_${region}`,
          description: 'New Relic Metric Stream role',
          assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'streams.metrics.cloudwatch.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          }),
          inlinePolicy: [
            {
              name: 'NewRelic-MetricStream',
              policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
                    Resource: newRelicMetricStreamDelivery.arn,
                  },
                ],
              }),
            },
          ],
        }
      );

      new CloudwatchMetricStream(this, `newrelic-metric-stream-${region}`, {
        provider: provider,
        name: `newrelic-metric-stream-${region}`,
        roleArn: newRelicMetricStreamRole.arn,
        firehoseArn: newRelicMetricStreamDelivery.arn,
        outputFormat: 'opentelemetry0.7',
      });
    }
  }
}
