import { AccountProviderConfig, Constants, DfAccounts } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';
import {
  BriteStack,
  DfBuildAutomationRoleStack,
  DfCrossAccountS3BucketStack,
} from '@dragonfly/stacks';

/** Log Archive Env */
export default class LogArchiveEnvironment extends AbstractEnvironment {
  private static instance: LogArchiveEnvironment;
  private crossAccountSsmInventoryBucket: DfCrossAccountS3BucketStack;
  private crossAccountFlowLogsBucket: DfCrossAccountS3BucketStack;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    this.crossAccountSsmInventoryBucket = new DfCrossAccountS3BucketStack(
      'ssm-inventory-bucket',
      this.stackConfig,
      {
        bucketName: Constants.S3BUCKETS.INVENTORY_BUCKET.NAME,
        bucketRegion: Constants.S3BUCKETS.INVENTORY_BUCKET.REGION,
        additionalPolicyStatements: [
          {
            Sid: 'AllowSsmServicePrincipalInOrg',
            Effect: 'Allow',
            Principal: {
              Service: 'ssm.amazonaws.com',
            },
            Action: 's3:PutObject',
            Resource: [
              `arn:aws:s3:::${Constants.S3BUCKETS.INVENTORY_BUCKET.NAME}/*`,
              `arn:aws:s3:::${Constants.S3BUCKETS.INVENTORY_BUCKET.NAME}`,
            ],
            Condition: {
              StringEquals: {
                'aws:SourceAccount': DfAccounts.getAllAccountNumbers(),
              },
            },
          },
        ],
        retentionPeriod: 2, // 2 days to reduce stale data. Terminated instance data remains in the bucket until lifecycle runs, and inventory runs every 24 hours.
      }
    );

    this.crossAccountFlowLogsBucket = new DfCrossAccountS3BucketStack(
      'flow-logs-bucket',
      this.stackConfig,
      {
        bucketName: Constants.S3BUCKETS.CENTRALIZED_FLOW_LOGS_BUCKET.NAME,
        bucketRegion: Constants.S3BUCKETS.CENTRALIZED_FLOW_LOGS_BUCKET.REGION,
        s3ManagedEncryption: true,
        retentionPeriod: 365,
        additionalPolicyStatements: [
          {
            Sid: 'AWSLogDeliveryWrite',
            Effect: 'Allow',
            Principal: {
              Service: 'delivery.logs.amazonaws.com',
            },
            Action: 's3:PutObject',
            Resource: `arn:aws:s3:::${Constants.S3BUCKETS.CENTRALIZED_FLOW_LOGS_BUCKET.NAME}/*`,
            Condition: {
              StringEquals: {
                's3:x-amz-acl': 'bucket-owner-full-control',
                'aws:SourceAccount': DfAccounts.getAllAccountNumbers(),
              },
            },
          },
          {
            Sid: 'AWSLogDeliveryCheck',
            Effect: 'Allow',
            Principal: {
              Service: 'delivery.logs.amazonaws.com',
            },
            Action: 's3:GetBucketAcl',
            Resource: `arn:aws:s3:::${Constants.S3BUCKETS.CENTRALIZED_FLOW_LOGS_BUCKET.NAME}`,
            Condition: {
              StringEquals: {
                'aws:SourceAccount': DfAccounts.getAllAccountNumbers(),
              },
            },
          },
          {
            Sid: 'DenyUnencryptedTraffic',
            Effect: 'Deny',
            Principal: {
              AWS: '*',
            },
            Action: 's3:*',
            Resource: [
              `arn:aws:s3:::${Constants.S3BUCKETS.CENTRALIZED_FLOW_LOGS_BUCKET.NAME}/*`,
              `arn:aws:s3:::${Constants.S3BUCKETS.CENTRALIZED_FLOW_LOGS_BUCKET.NAME}`,
            ],
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          },
        ],
      }
    );

    new BriteStack('brite-stack', this.stackConfig);

    return this.handler;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'logArchive';
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'log-archive';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_LOG_ARCHIVE;
  }

  /**
   *
   * Singleton constructor for the PlatformSandboxSharedNetwork
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {LogArchiveEnvironment}
   *
   */
  public static getInstance(app: App): LogArchiveEnvironment {
    if (!LogArchiveEnvironment.instance) {
      LogArchiveEnvironment.instance = new LogArchiveEnvironment(app);
      LogArchiveEnvironment.instance.deployStacks();
    }

    return LogArchiveEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @return {DfCrossAccountS3BucketStack}
   */
  public get crossAccountSsmInventoryBucketStack(): DfCrossAccountS3BucketStack {
    return this.crossAccountSsmInventoryBucket;
  }

  /**
   * @return {DfCrossAccountS3BucketStack}
   */
  public get crossAccountFlowLogsBucketStack(): DfCrossAccountS3BucketStack {
    return this.crossAccountFlowLogsBucket;
  }

  /**
   *
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: DfAccounts.getLogArchiveAccountDef().accountNumber,
      accountName: LogArchiveEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: LogArchiveEnvironment.PROVIDER_ROLE_NAME,
    };
  }
}
