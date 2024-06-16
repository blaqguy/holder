import { Construct } from 'constructs';
import { DfFsxDataSyncTaskConfig } from './helpers/interfaces';
import { DatasyncLocationFsxWindowsFileSystem } from '@cdktf/provider-aws/lib/datasync-location-fsx-windows-file-system';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DatasyncTask } from '@cdktf/provider-aws/lib/datasync-task';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { CloudwatchLogResourcePolicy } from '@cdktf/provider-aws/lib/cloudwatch-log-resource-policy';

/**
 * A construct to create a DataSync Task for FSx
 * @extends {Construct}
 */
export class DfFsxDataSyncTask extends Construct {
  /**
   * @param {Construct} scope - The scope of the construct.
   * @param {string} id - The ID of the construct.
   * @param {DfFsxDataSyncTaskConfig} config - The DataSync Task configuration.
   */
  constructor(scope: Construct, id: string, config: DfFsxDataSyncTaskConfig) {
    super(scope, id);

    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    const sourceLocation = new DatasyncLocationFsxWindowsFileSystem(
      this,
      `${id}-source-location`,
      {
        provider: config.providers.source,
        fsxFilesystemArn: config.fsxArns.source,
        user: 'Admin',
        password: sopsData.DOMAIN_ADMIN_PW,
        domain: Constants.MICROSOFT_ACTIVE_DIRECTORY_DOMAIN_NAME,
        securityGroupArns: [
          new SecurityGroup(this, `${id}-source-sg`, {
            provider: config.providers.source,
            name: `${id}-data-sync-task`,
            vpcId: config.vpcs.source.vpcId,
            ingress: [
              {
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0'],
              },
            ],
            egress: [
              {
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0'],
              },
            ],
            tags: {
              Name: `${id}-data-sync-task`,
            },
          }).arn,
        ],
        subdirectory: '/share/',
      }
    );

    const destinationLocation = new DatasyncLocationFsxWindowsFileSystem(
      this,
      `${id}-destination-location`,
      {
        provider: config.providers.destination,
        fsxFilesystemArn: config.fsxArns.destination,
        user: 'Admin',
        password: sopsData.DOMAIN_ADMIN_PW,
        securityGroupArns: [
          new SecurityGroup(this, `${id}-destination-sg`, {
            provider: config.providers.destination,
            name: `${id}-data-sync-task`,
            vpcId: config.vpcs.destination.vpcId,
            ingress: [
              {
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0'],
              },
            ],
            egress: [
              {
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0'],
              },
            ],
            tags: {
              Name: `${id}-data-sync-task`,
            },
          }).arn,
        ],
        subdirectory: '/share/',
      }
    );

    // Cloudwatch log group for datasync task
    const logGroup = new CloudwatchLogGroup(this, `${id}-log-group`, {
      provider: config.providers.source,
      name: `${id}-datasync`,
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        config.accountId
      )
        ? 365
        : 30,
      tags: {
        Name: `${id}-datasync`,
      },
    });

    const policyDocument = new DataAwsIamPolicyDocument(
      this,
      `${id}-datasync-cw-policy-doc`,
      {
        provider: config.providers.source,
        statement: [
          {
            actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            effect: 'Allow',
            principals: [
              {
                identifiers: ['datasync.amazonaws.com'],
                type: 'Service',
              },
            ],
            resources: [`${logGroup.arn}:*`],
          },
        ],
      }
    );

    new CloudwatchLogResourcePolicy(this, `${id}-datasync-cw-policy`, {
      provider: config.providers.source,
      policyDocument: policyDocument.json,
      policyName: `${id}-datasync-cw-policy`,
    });

    // Create Datasync task to sync data hourly
    new DatasyncTask(this, `${id}-datasync-task`, {
      provider: config.providers.source,
      destinationLocationArn: destinationLocation.arn,
      sourceLocationArn: sourceLocation.arn,
      name: config.DataSyncTaskName,
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)',
      },
      options: {
        logLevel: 'BASIC',
        posixPermissions: 'NONE',
        uid: 'NONE',
        gid: 'NONE',
        preserveDeletedFiles: 'REMOVE',
        verifyMode: 'ONLY_FILES_TRANSFERRED',
      },
      cloudwatchLogGroupArn: logGroup.arn,
    });
  }
}
