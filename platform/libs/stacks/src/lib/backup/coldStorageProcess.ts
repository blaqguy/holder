import { PlatformSecrets, Utils } from '@dragonfly/utils';
import path from 'path';
import { RemoteStack, StackConfig } from '../stacks';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { SchedulerSchedule } from '@cdktf/provider-aws/lib/scheduler-schedule';
import { Token } from 'cdktf';
import {
  DfAliasedKeyConstruct,
  DfIamRoleConstruct,
  DfLambdaFunctionConstruct,
  DfPrivateBucketConstruct,
} from '@dragonfly/constructs';
import { S3BucketLifecycleConfiguration } from '@cdktf/provider-aws/lib/s3-bucket-lifecycle-configuration';
import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table';

type BackupFrequency = 'weekly' | 'monthly';
interface ColdStorageLambdaConfig {
  scope: RemoteStack;
  stackconfig: StackConfig;
  dftRegion: string;
  provider: AwsProvider;
  backupFrequency: BackupFrequency;
  accountName: string;
}

// AMI and EBS snapshots to be retained in "archive" state for 90 days for weekly and 7 years for monthly
export function createColdStorageProcess(config: ColdStorageLambdaConfig) {
  const sopsData: PlatformSecrets = Utils.getSecretsForNode(config.scope.node);

  const imageIdTable = new DynamodbTable(
    config.scope,
    `${config.backupFrequency}-store-ec2-backup-ami-ids-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `${config.backupFrequency}-ec2-backup-ami-ids`,
      hashKey: 'ImageId',
      attribute: [
        {
          name: 'ImageId',
          type: 'S',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
      tags: { Name: 'ec2-backup-ami-ids' },
    }
  );

  const ec2SnapshotIdTable = new DynamodbTable(
    config.scope,
    `${config.backupFrequency}-store-ec2-backup-snapshot-ids-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `${config.backupFrequency}-ec2-backup-snapshot-ids`,
      hashKey: 'SnapshotId',
      attribute: [
        {
          name: 'SnapshotId',
          type: 'S',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
      tags: { Name: 'ec2-backup-snapshot-ids' },
    }
  );

  const rdsSnapshotIdTable = new DynamodbTable(
    config.scope,
    `${config.backupFrequency}-store-rds-backup-snapshot-ids-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `${config.backupFrequency}-rds-backup-snapshot-ids`,
      hashKey: 'ExportTaskId',
      attribute: [
        {
          name: 'ExportTaskId',
          type: 'S',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
      tags: { Name: 'rds-backup-snapshot-ids' },
    }
  );

  // Creates the S3 bucket for storage of ec2 and rds backups
  const backupBucket = new DfPrivateBucketConstruct(
    config.scope,
    `${config.backupFrequency}Backup${config.dftRegion}`,
    {
      provider: config.provider,
      bucketName:
        `${config.stackconfig.envName}-df-${config.backupFrequency}-backups-${config.dftRegion}`.toLowerCase(),
      s3ManagedEncryption: true,
    }
  );

  const bucketRule = getBucketLifecycleRule(config.backupFrequency);

  // Creates the backup bucket lifecycle policy
  new S3BucketLifecycleConfiguration(
    config.scope,
    `${config.backupFrequency}BackupBucketLifecycleConfig${config.dftRegion}`,
    {
      provider: config.provider,
      bucket: backupBucket.bucket.id,
      rule: bucketRule,
    }
  );

  /**
   *
   * EC2 COLD STORAGE PROCESS RESOURCES
   *
   */

  /**
   * AWS Scheduler schedule resource that triggers the backup task progress checker lambda
   * will be created and enabled in the starter lambda and disabled in the task checker lambda
   */
  const taskCheckerSchedulerName = `${config.backupFrequency}-ec2-cold-storage-task-checker-trigger`;

  /**
   * PROCESS EC2 BACKUP TASKS LAMBDA FUNCTION
   * 1. Lambda assets builder
   * 2. Lambda function construct infra code
   * 3. IAM trust policy, permissions doc, and role
   */

  // Bundles the ec2ProcessBackupTasks lambda code
  Utils.buildLambdaAsssets({
    lambdaAssetDir: path.resolve(
      __dirname,
      'lambdaAssets/ec2ProcessBackupTasks'
    ),
    lambdaAssetBundleDir: path.resolve(
      __dirname,
      'lambdaAssets/ec2ProcessBackupTasks/dist'
    ),
  });

  // CREATES THE LAMBDA
  const ec2ProcessBackupTasksFunction = new DfLambdaFunctionConstruct(
    config.scope,
    `${config.backupFrequency}-ec2-cold-storage-task-checker-lambda-${config.dftRegion}`,
    {
      functionName:
        `${config.backupFrequency}-ec2-cold-storage-task-checker`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'ec2ProcessBackupTasks',
      lambdaLogGroupRetentionInDays: 3,
      iamRoleName:
        `${config.backupFrequency}-ec2-cold-storage-task-checker-${config.dftRegion}`.toLowerCase(),
      inlinePolicy: [
        // Required permissions for storing AMI in S3 can be found here
        // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ami-store-restore.html#ami-s3-permissions
        {
          name: 'allow-ec2-describe-tasks',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ec2:DescribeStoreImageTasks',
                  'ec2:DescribeSnapshots',
                  'ec2:ModifySnapshotTier',
                ],
                Resource: '*',
              },
            ],
          }),
        },
        {
          name: 'allow-dynamoDb-read-write-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'dynamodb:BatchWriteItem',
                  'dynamodb:Scan',
                  'dynamodb:UpdateItem',
                ],
                Resource: [imageIdTable.arn, ec2SnapshotIdTable.arn],
              },
            ],
          }),
        },
        {
          name: 'allow-delete-scheduler',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['scheduler:DeleteSchedule', 'iam:PassRole'],
                Resource: ['*'],
              },
            ],
          }),
        },
      ],
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-${config.backupFrequency}-ec2BackupTaskCheckerLambdaAssets-${config.dftRegion}`.toLowerCase(),
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      timeout: 300,
      environmentVariables: {
        variables: {
          backupFrequency: config.backupFrequency,
          imageIdTableName: imageIdTable.name,
          snapshotIdTableName: ec2SnapshotIdTable.name,
          webhookUrl: sopsData.TEAMS_INCOMING_WEBBOOK,
          accountName: config.accountName,
          taskCheckerSchedulerName: taskCheckerSchedulerName,
        },
      },
    }
  );

  // Add trust policy for the scheduler service to assume this role
  const taskCheckerTrustDoc = Utils.createTrustPolicyDocument(
    config.scope,
    `${config.backupFrequency}-ec2-task-scheduler-trust-policy-${config.dftRegion}`,
    ['scheduler.amazonaws.com'],
    config.provider
  );

  // Add permissions policy for the scheduler service to be able to invoke the cold storage task checker lambda function
  const taskCheckerPermissionDoc = Utils.createPolicyDocument(
    config.scope,
    `${config.backupFrequency}-ec2TaskSchedulerPermissionDoc-${config.dftRegion}`,
    ['lambda:InvokeFunction'],
    [
      ec2ProcessBackupTasksFunction.lambdaFunctionArn,
      `${ec2ProcessBackupTasksFunction.lambdaFunctionArn}:*`,
    ],
    null, // No additional statements being passed in
    config.provider
  );

  const taskCheckerSchedulerRole = new DfIamRoleConstruct(config.scope, {
    provider: config.provider,
    roleName: `Allow${config.backupFrequency}Ec2TaskCheckerSchedulerLambdaInvoke${config.dftRegion}`,
    permissionsDocuments: [taskCheckerPermissionDoc],
    assumptionDocument: taskCheckerTrustDoc,
  });

  /**
   * EC2 COLD STORAGE LAMBDA FUNCTION & SCHEDULER
   * 1. Lambda assets builder
   * 2. Lambda function construct infra code
   * 3. IAM trust policy, permissions doc, and role
   * 4. Lambda scheduler schedule service
   */

  // Bundles the ec2ColdStorageBackupStarter lambda code
  Utils.buildLambdaAsssets({
    lambdaAssetDir: path.resolve(
      __dirname,
      'lambdaAssets/ec2ColdStorageBackupStarter'
    ),
    lambdaAssetBundleDir: path.resolve(
      __dirname,
      'lambdaAssets/ec2ColdStorageBackupStarter/dist'
    ),
  });

  // Creates the ec2 cold storage lambda function
  const coldStorageFunction = new DfLambdaFunctionConstruct(
    config.scope,
    `${config.backupFrequency}-ec2-cold-storage-task-starter-lambda-${config.dftRegion}`,
    {
      functionName:
        `${config.backupFrequency}-ec2-cold-storage-task-starter`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'ec2ColdStorageBackupStarter',
      lambdaLogGroupRetentionInDays: 3,
      iamRoleName:
        `${config.backupFrequency}-ec2-cold-storage-task-starter-${config.dftRegion}`.toLowerCase(),
      inlinePolicy: [
        // Required permissions for storing AMI in S3 can be found here
        // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ami-store-restore.html#ami-s3-permissions
        {
          name: 'allow-ec2-backup-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ec2:DescribeImages',
                  'ec2:CreateStoreImageTask',
                  'ec2:DescribeStoreImageTasks',
                  'ec2:CreateRestoreImageTask',
                  'ec2:GetEbsEncryptionByDefault',
                  'ec2:DescribeTags',
                  'ec2:CreateTags',
                  'ec2:CopySnapshot',
                  'ec2:ModifySnapshotTier',
                  'ec2:DescribeSnapshots',
                  'ec2:DescribeSnapshotTierStatus',
                ],
                Resource: '*',
              },
            ],
          }),
        },
        {
          name: 'allow-s3-backup-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  's3:DeleteObject',
                  's3:GetObject',
                  's3:ListBucket',
                  's3:PutObject',
                  's3:PutObjectAcl',
                  's3:PutObjectTagging',
                  's3:AbortMultipartUpload',
                ],
                Resource: [
                  backupBucket.bucket.arn,
                  `${backupBucket.bucket.arn}/*`,
                ],
              },
            ],
          }),
        },
        {
          name: 'allow-ebs-backup-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ebs:CompleteSnapshot',
                  'ebs:GetSnapshotBlock',
                  'ebs:ListChangedBlocks',
                  'ebs:ListSnapshotBlocks',
                  'ebs:PutSnapshotBlock',
                  'ebs:StartSnapshot',
                ],
                Resource: '*',
              },
            ],
          }),
        },
        {
          name: 'allow-dynamoDb-write-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['dynamodb:BatchWriteItem'],
                Resource: [imageIdTable.arn, ec2SnapshotIdTable.arn],
              },
            ],
          }),
        },
        {
          name: 'allow-create-scheduler',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['scheduler:CreateSchedule', 'iam:PassRole'],
                Resource: ['*'],
              },
            ],
          }),
        },
      ],
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-${config.backupFrequency}-ec2BackupStarterLambdaAssets-${config.dftRegion}`.toLowerCase(),
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      timeout: 300,
      environmentVariables: {
        variables: {
          coldStorageBucketName: backupBucket.bucket.bucket,
          backupFrequency: config.backupFrequency,
          imageIdTableName: imageIdTable.name,
          snapshotIdTableName: ec2SnapshotIdTable.name,
          taskCheckerSchedulerName: taskCheckerSchedulerName,
          taskCheckerLambdaArn: ec2ProcessBackupTasksFunction.lambdaFunctionArn,
          taskCheckerRoleArn: taskCheckerSchedulerRole.role.arn,
          webhookUrl: sopsData.TEAMS_INCOMING_WEBBOOK,
          accountName: config.accountName,
        },
      },
    }
  );

  // Add trust policy for the scheduler service to assume this role
  const trustDoc = Utils.createTrustPolicyDocument(
    config.scope,
    `${config.backupFrequency}-ec2-starter-scheduler-trust-policy-${config.dftRegion}`,
    ['scheduler.amazonaws.com'],
    config.provider
  );

  // Add permissions policy for the scheduler service to be able to invoke the cold storage lambda function
  const permissionDoc = Utils.createPolicyDocument(
    config.scope,
    `${config.backupFrequency}-ec2StarterSchedulerPermissionDoc-${config.dftRegion}`,
    ['lambda:InvokeFunction'],
    [
      coldStorageFunction.lambdaFunctionArn,
      `${coldStorageFunction.lambdaFunctionArn}:*`,
    ],
    null, // No additional statements being passed in
    config.provider
  );

  const ec2TaskStarterSchedulerRole = new DfIamRoleConstruct(config.scope, {
    provider: config.provider,
    roleName: `Allow${config.backupFrequency}Ec2StarterSchedulerLambdaInvoke${config.dftRegion}`,
    permissionsDocuments: [permissionDoc],
    assumptionDocument: trustDoc,
  });

  // Scheduler service will send an event to the cold storage lambda to kick off the cold storage AMI backup process
  new SchedulerSchedule(
    config.scope,
    `${config.backupFrequency}-ec2-cold-storage-task-starter-event-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `${config.backupFrequency}-ec2-cold-storage-task-starter-trigger`,
      description: `Scheduler service to kick off the ${config.backupFrequency} cold storage task starter lambda AMI backup process`,
      scheduleExpression: getSchedulerExpression(config.backupFrequency),
      target: {
        arn: Token.asString(coldStorageFunction.lambdaFunctionArn),
        roleArn: Token.asString(ec2TaskStarterSchedulerRole.role.arn),
      },
      flexibleTimeWindow: {
        mode: 'OFF',
      },
    }
  );

  /**
   *
   * RDS COLD STORAGE PROCESS RESOURCES
   *
   */

  /**
   * AWS Scheduler schedule resource that triggers the RDS backup task processing lambda
   * will be created and enabled in the task tarter lambda and disabled in the task processer lambda
   */
  const rdsTaskCheckerSchedulerName = `${config.backupFrequency}-rds-cold-storage-task-checker-trigger`;

  /**
   * PROCESS RDS BACKUP TASKS LAMBDA FUNCTION
   * 1. Lambda assets builder
   * 2. Lambda function construct infra code
   * 3. IAM trust policy, permissions doc, and role
   */

  // Bundles the rdsProcessBackupTasks lambda code
  Utils.buildLambdaAsssets({
    lambdaAssetDir: path.resolve(
      __dirname,
      'lambdaAssets/rdsProcessBackupTasks'
    ),
    lambdaAssetBundleDir: path.resolve(
      __dirname,
      'lambdaAssets/rdsProcessBackupTasks/dist'
    ),
  });

  // CREATES THE LAMBDA
  const rdsProcessBackupTasksFunction = new DfLambdaFunctionConstruct(
    config.scope,
    `${config.backupFrequency}-rds-cold-storage-task-checker-lambda-${config.dftRegion}`,
    {
      functionName:
        `${config.backupFrequency}-rds-cold-storage-task-checker`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'rdsProcessBackupTasks',
      lambdaLogGroupRetentionInDays: 3,
      iamRoleName:
        `${config.backupFrequency}-rds-cold-storage-task-checker-${config.dftRegion}`.toLowerCase(),
      inlinePolicy: [
        {
          name: 'allow-dynamoDb-read-write-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['dynamodb:BatchWriteItem', 'dynamodb:Scan'],
                Resource: [rdsSnapshotIdTable.arn],
              },
            ],
          }),
        },
        {
          name: 'allow-rds-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['rds:DescribeExportTasks'],
                Resource: ['*'],
              },
            ],
          }),
        },
        {
          name: 'allow-delete-scheduler',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['scheduler:DeleteSchedule', 'iam:PassRole'],
                Resource: ['*'],
              },
            ],
          }),
        },
      ],
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-${config.backupFrequency}-rdsBackupTaskCheckerLambdaAssets-${config.dftRegion}`.toLowerCase(),
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      timeout: 300,
      environmentVariables: {
        variables: {
          backupFrequency: config.backupFrequency,
          snapshotIdTableName: rdsSnapshotIdTable.name,
          webhookUrl: sopsData.TEAMS_INCOMING_WEBBOOK,
          accountName: config.accountName,
          taskCheckerSchedulerName: rdsTaskCheckerSchedulerName,
        },
      },
    }
  );

  // Add trust policy for the scheduler service to assume this role
  const rdsTaskCheckerTrustDoc = Utils.createTrustPolicyDocument(
    config.scope,
    `${config.backupFrequency}-rds-task-scheduler-trust-policy-${config.dftRegion}`,
    ['scheduler.amazonaws.com'],
    config.provider
  );

  // Add permissions policy for the scheduler service to be able to invoke the cold storage task checker lambda function
  const rdsTaskCheckerPermissionDoc = Utils.createPolicyDocument(
    config.scope,
    `${config.backupFrequency}-rdsTaskSchedulerPermissionDoc-${config.dftRegion}`,
    ['lambda:InvokeFunction'],
    [
      rdsProcessBackupTasksFunction.lambdaFunctionArn,
      `${rdsProcessBackupTasksFunction.lambdaFunctionArn}:*`,
    ],
    null, // No additional statements being passed in
    config.provider
  );

  const rdsTaskCheckerSchedulerRole = new DfIamRoleConstruct(config.scope, {
    provider: config.provider,
    roleName: `Allow${config.backupFrequency}RdsTaskCheckerSchedulerLambdaInvoke${config.dftRegion}`,
    permissionsDocuments: [rdsTaskCheckerPermissionDoc],
    assumptionDocument: rdsTaskCheckerTrustDoc,
  });

  /**
   * RDS COLD STORAGE STARTER LAMBDA FUNCTION & SCHEDULER
   * 1. Lambda assets builder
   * 2. IAM trust policy, permissions doc, and role for RDS export task in lambda
   * 3. Lambda function construct infra code
   * 4. IAM trust policy, permissions doc, and role
   * 5. Lambda scheduler schedule service
   */

  // Bundles the rdsColdStorageBackupStarter lambda code
  Utils.buildLambdaAsssets({
    lambdaAssetDir: path.resolve(
      __dirname,
      'lambdaAssets/rdsColdStorageBackupStarter'
    ),
    lambdaAssetBundleDir: path.resolve(
      __dirname,
      'lambdaAssets/rdsColdStorageBackupStarter/dist'
    ),
  });

  // Add trust policy for the lambda rds service to assume this role
  const rdsExportTrustDoc = Utils.createTrustPolicyDocument(
    config.scope,
    `${config.backupFrequency}-rds-export-trust-policy-${config.dftRegion}`,
    ['export.rds.amazonaws.com'],
    config.provider
  );

  // Add permissions policy for the lambda rds service to be able to export the rds snapshot to s3
  const rdsExportPermissionDoc = Utils.createPolicyDocument(
    config.scope,
    `${config.backupFrequency}-rdsExportPermissionDoc-${config.dftRegion}`,
    [
      's3:PutObject',
      's3:GetObject',
      's3:ListBucket',
      's3:DeleteObject',
      's3:GetBucketLocation',
    ],
    [backupBucket.bucket.arn, `${backupBucket.bucket.arn}/*`],
    null, // No additional statements being passed in
    config.provider
  );

  const lambdaRdsRole = new DfIamRoleConstruct(config.scope, {
    provider: config.provider,
    roleName: `Allow${config.backupFrequency}LambdaRdsExportTask${config.dftRegion}`,
    permissionsDocuments: [rdsExportPermissionDoc],
    assumptionDocument: rdsExportTrustDoc,
  });

  const rdsExportKmsKey = new DfAliasedKeyConstruct(
    config.scope,
    `${config.backupFrequency}-rds-snapshot-export-kms-key-${config.dftRegion}`,
    {
      name: `${config.backupFrequency}-rds-snapshot-export`,
      description: `KMS Key used by rds backup cold storage lambda to export rds snapshots to s3`,
      provider: config.provider,
    }
  );

  // Creates the rds cold storage lambda function
  const rdsColdStorageFunction = new DfLambdaFunctionConstruct(
    config.scope,
    `${config.backupFrequency}-rds-cold-storage-task-starter-lambda-${config.dftRegion}`,
    {
      functionName:
        `${config.backupFrequency}-rds-cold-storage-task-starter`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'rdsColdStorageBackupStarter',
      lambdaLogGroupRetentionInDays: 3,
      iamRoleName:
        `${config.backupFrequency}-rds-cold-storage-task-starter-${config.dftRegion}`.toLowerCase(),
      inlinePolicy: [
        {
          name: 'allow-rds-assume-role',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['iam:PassRole'],
                Resource: [lambdaRdsRole.role.arn],
              },
            ],
          }),
        },
        {
          name: 'allow-rds-export-tasks',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['rds:DescribeDBSnapshots', 'rds:StartExportTask'],
                Resource: '*',
              },
            ],
          }),
        },
        {
          name: 'allow-kms-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'kms:Encrypt',
                  'kms:Decrypt',
                  'kms:GenerateDataKey',
                  'kms:GenerateDataKeyWithoutPlaintext',
                  'kms:ReEncryptFrom',
                  'kms:ReEncryptTo',
                  'kms:CreateGrant',
                  'kms:DescribeKey',
                  'kms:RetireGrant',
                ],
                Resource: '*',
              },
            ],
          }),
        },
        {
          name: 'allow-dynamoDb-read-write-access',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['dynamodb:BatchWriteItem'],
                Resource: [rdsSnapshotIdTable.arn],
              },
            ],
          }),
        },
        {
          name: 'allow-create-scheduler',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['scheduler:CreateSchedule', 'iam:PassRole'],
                Resource: ['*'],
              },
            ],
          }),
        },
      ],
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-${config.backupFrequency}-rdsBackupStarterLambdaAssets-${config.dftRegion}`.toLowerCase(),
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      timeout: 300,
      environmentVariables: {
        variables: {
          backupFrequency: config.backupFrequency,
          rdsSnapshotIdTableName: rdsSnapshotIdTable.name,
          coldStorageBucketName: backupBucket.bucket.bucket,
          rdsIamRole: lambdaRdsRole.role.arn,
          rdsKmsKeyId: rdsExportKmsKey.id,
          taskCheckerSchedulerName: rdsTaskCheckerSchedulerName,
          taskCheckerLambdaArn: rdsProcessBackupTasksFunction.lambdaFunctionArn,
          taskCheckerRoleArn: rdsTaskCheckerSchedulerRole.role.arn,
          webhookUrl: sopsData.TEAMS_INCOMING_WEBBOOK,
          accountName: config.accountName,
        },
      },
    }
  );

  // Add trust policy for the scheduler service to assume this role
  const rdsSchedulerTrustDoc = Utils.createTrustPolicyDocument(
    config.scope,
    `${config.backupFrequency}-scheduler-trust-policy-${config.dftRegion}`,
    ['scheduler.amazonaws.com'],
    config.provider
  );

  // Add permissions policy for the scheduler service to be able to invoke the cold storage lambda function
  const rdsSchedulerPermissionDoc = Utils.createPolicyDocument(
    config.scope,
    `${config.backupFrequency}-schedulerPermissionDoc-${config.dftRegion}`,
    ['lambda:InvokeFunction'],
    [
      coldStorageFunction.lambdaFunctionArn,
      `${coldStorageFunction.lambdaFunctionArn}:*`,
    ],
    null, // No additional statements being passed in
    config.provider
  );

  const rdsTaskStartedSchedulerRole = new DfIamRoleConstruct(config.scope, {
    provider: config.provider,
    roleName: `Allow${config.backupFrequency}SchedulerLambdaInvoke${config.dftRegion}`,
    permissionsDocuments: [rdsSchedulerPermissionDoc],
    assumptionDocument: rdsSchedulerTrustDoc,
  });

  // Scheduler service will send an event to the cold storage lambda to kick off the cold storage AMI backup process
  new SchedulerSchedule(
    config.scope,
    `${config.backupFrequency}-rds-cold-storage-task-starter-event-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `${config.backupFrequency}-rds-cold-storage-task-starter-trigger`,
      description: `Scheduler service to kick off the ${config.backupFrequency} rds cold storage task starter lambda backup process`,
      scheduleExpression: getSchedulerExpression(config.backupFrequency),
      target: {
        arn: Token.asString(rdsColdStorageFunction.lambdaFunctionArn),
        roleArn: Token.asString(rdsTaskStartedSchedulerRole.role.arn),
      },
      flexibleTimeWindow: {
        mode: 'OFF',
      },
    }
  );
}

function getSchedulerExpression(backupFrequency: BackupFrequency) {
  switch (backupFrequency) {
    case 'weekly':
      return 'cron(0 8 ? * 1 *)'; // Defaults to UTC time zone
    case 'monthly':
      return 'cron(0 8 1 * ? *)'; // Defaults to UTC time zone
  }
}

function getBucketLifecycleRule(backupFrequency: BackupFrequency) {
  switch (backupFrequency) {
    case 'weekly':
      return [
        {
          id: 'Transition to Glacier IR and then delete objects after 90 days',
          status: 'Enabled',
          transition: [
            {
              storageClass: 'GLACIER_IR',
            },
          ],
          expiration: {
            days: 90,
          },
        },
      ];
    case 'monthly':
      return [
        {
          id: 'Transition to Glacier and then delete objects after 7 years',
          status: 'Enabled',
          transition: [
            {
              storageClass: 'GLACIER',
            },
          ],
          expiration: {
            days: 2550,
          },
        },
      ];
  }
}
