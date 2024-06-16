import { createAnsibleAssociationLambdasConfig } from './interfaces';
import { DfLambdaFunctionConstruct } from '@dragonfly/constructs';
import { CloudwatchEventRule } from '@cdktf/provider-aws/lib/cloudwatch-event-rule';
import { LambdaPermission } from '@cdktf/provider-aws/lib/lambda-permission';
import { CloudwatchEventTarget } from '@cdktf/provider-aws/lib/cloudwatch-event-target';
import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table';
import { S3BucketNotification } from '@cdktf/provider-aws/lib/s3-bucket-notification';

export function createAnsibleAssociationLambdas(
  config: createAnsibleAssociationLambdasConfig
) {
  /**
   * * DynamoDB Table to track stopped instances
   * * Required for the Reapply and Stop Instances Lambda Functions
   */
  const dynamoDbTable = new DynamodbTable(
    config.scope,
    `stopped-instance-tracking-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `ansible-ssm-association-instance-tracking-${config.dftRegion}`,
      hashKey: 'InstanceId',
      attribute: [
        {
          name: 'InstanceId',
          type: 'S',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
    }
  );

  /**
   * * Reapply Ansible SSM Association Lambda Function
   */

  const reapplyAssociationLambda = new DfLambdaFunctionConstruct(
    config.scope,
    `reapply-ansible-association-lambda-${config.dftRegion}`,
    {
      functionName:
        `reapply-ansible-ssm-association-${config.dftRegion}`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'runAnsibleAssociation',
      lambdaLogGroupRetentionInDays: 3,
      inlinePolicy: [
        {
          name: 'reapply-ansible-ssm-association-permissions',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['kms:RetireGrant', 'kms:Decrypt'],
                Resource: '*',
              },
              {
                Effect: 'Allow',
                Action: [
                  'dynamodb:Scan',
                  'dynamodb:BatchWriteItem',
                  'dynamodb:GetItem',
                  'dynamodb:DeleteItem',
                  'ec2:DescribeInstances',
                  'ec2:StartInstances',
                  'logs:CreateLogStream',
                  'ssm:ListAssociations',
                  'ssm:StartAssociationsOnce',
                  'sts:GetCallerIdentity',
                ],
                Resource: '*',
              },
              {
                Effect: 'Allow',
                Action: [
                  'dynamodb:Scan',
                  'dynamodb:BatchWriteItem',
                  'dynamodb:GetItem',
                  'dynamodb:DeleteItem',
                  'ec2:DescribeInstances',
                  'ec2:StartInstances',
                  'logs:CreateLogStream',
                  'ssm:ListAssociations',
                  'ssm:StartAssociationsOnce',
                  'sts:GetCallerIdentity',
                ],
                Resource: '*',
              },
              {
                Effect: 'Allow',
                Action: [
                  'dynamodb:Scan',
                  'dynamodb:BatchWriteItem',
                  'dynamodb:GetItem',
                  'dynamodb:DeleteItem',
                  'ec2:DescribeInstances',
                  'ec2:StartInstances',
                  'logs:CreateLogStream',
                  'ssm:ListAssociations',
                  'ssm:StartAssociationsOnce',
                  'sts:GetCallerIdentity',
                ],
                Resource: '*',
              },
            ],
          }),
        },
      ],
      iamRoleName:
        `reapply-ansible-association-${config.dftRegion}`.toLowerCase(),
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-dft-reapply-ansible-association-${config.dftRegion}`.toLowerCase(),
      timeout: 300,
      memorySize: 512,
      environmentVariables: {
        variables: {
          associationName: config.associationName,
          dynamodbTableName: dynamoDbTable.name,
          webhookUrl: config.webhookUrl,
        },
      },
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
    }
  );

  const lambdaPermission = new LambdaPermission(
    config.scope,
    `reapply-ansible-assocation-lambda-perm-${config.dftRegion}`,
    {
      provider: config.provider,
      statementId: 'AllowExecutionFromS3',
      action: 'lambda:InvokeFunction',
      functionName: reapplyAssociationLambda.lambdaFunctionArn,
      principal: 's3.amazonaws.com',
      sourceArn: config.ansibleAssetS3BucketArn,
    }
  );

  new S3BucketNotification(
    config.scope,
    `reapply-ansible-association-s3-trigger-${config.dftRegion}`,
    {
      provider: config.provider,
      dependsOn: [lambdaPermission],
      bucket: config.ansibleAssetS3BucketId,
      lambdaFunction: [
        {
          lambdaFunctionArn: reapplyAssociationLambda.lambdaFunctionArn,
          events: ['s3:ObjectCreated:*'],
          filterPrefix: 'ansible.zip',
        },
      ],
    }
  );

  /**
   * * Failure notification
   */

  const associationFailureEvent = new CloudwatchEventRule(
    config.scope,
    `ansible-association-state-failure-event-${config.dftRegion}`,
    {
      provider: config.provider,
      name: 'association-failure-events',
      eventPattern: JSON.stringify({
        source: ['aws.ssm'],
        'detail-type': ['EC2 State Manager Association State Change'],
        detail: {
          status: ['Failed'],
          'association-id': [config.associationId], // Filter for Associations created by this stack
        },
      }),
    }
  );
  const failureNotificationFunction = new DfLambdaFunctionConstruct(
    config.scope,
    `failure-notification-lambda-${config.dftRegion}`,
    {
      functionName: `failure-notification-${config.dftRegion}`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'associationFailureNotification',
      lambdaLogGroupRetentionInDays: 3,
      iamRoleName: `failure-notification-${config.dftRegion}`.toLowerCase(),
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-dft-association-failure-notification-${config.dftRegion}`.toLowerCase(),
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      environmentVariables: {
        variables: {
          webhookUrl: config.webhookUrl,
        },
      },
    }
  );

  new LambdaPermission(
    config.scope,
    `failure-notification-lambda-perm-${config.dftRegion}`,
    {
      provider: config.provider,
      statementId: 'AllowExecutionFromEventBridge',
      action: 'lambda:InvokeFunction',
      functionName: failureNotificationFunction.lambdaFunctionArn,
      principal: 'events.amazonaws.com',
      sourceArn: associationFailureEvent.arn,
    }
  );

  new CloudwatchEventTarget(
    config.scope,
    `ansible-association-failure-event-target-${config.dftRegion}`,
    {
      provider: config.provider,
      arn: failureNotificationFunction.lambdaFunctionArn,
      rule: associationFailureEvent.name,
    }
  );

  /**
   * * Stop instances lambda function
   */

  const stateManagerInstanceStatusEvent = new CloudwatchEventRule(
    config.scope,
    `ansible-assocation-state-manager-instance-status-${config.dftRegion}`,
    {
      provider: config.provider,
      name: `ansible-assocation-state-manager-change-events`,
      eventPattern: JSON.stringify({
        source: ['aws.ssm'],
        'detail-type': ['EC2 State Manager Instance Association State Change'],
        detail: {
          status: ['Success', 'Failed'],
          'association-id': [config.associationId], // Filter for Associations created by this stack
        },
      }),
    }
  );

  const stopInstanceFunction = new DfLambdaFunctionConstruct(
    config.scope,
    `stop-instances-lambda-${config.dftRegion}`,
    {
      functionName: `stop-instances-${config.dftRegion}`.toLowerCase(),
      provider: config.provider,
      lambdaFunctionDirectory: 'stopInstances',
      lambdaLogGroupRetentionInDays: 3,
      inlinePolicy: [
        {
          name: 'stop-instance-function-permission-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['kms:Decrypt', 'kms:RetireGrant'],
                Resource: '*',
              },
              {
                Effect: 'Allow',
                Action: [
                  'dynamodb:Scan',
                  'dynamodb:BatchWriteItem',
                  'dynamodb:GetItem',
                  'dynamodb:DeleteItem',
                  'ec2:DescribeInstances',
                  'ec2:StopInstances',
                  'logs:CreateLogStream',
                  'ssm:ListAssociations',
                  'ssm:StartAssociationsOnce',
                  'sts:GetCallerIdentity',
                ],
                Resource: '*',
              },
            ],
          }),
        },
      ],
      iamRoleName: `stop-instances-${config.dftRegion}`.toLowerCase(),
      lambdaAssetS3BucketName:
        `${config.stackconfig.envName}-dft-stop-instances-${config.dftRegion}`.toLowerCase(),
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      environmentVariables: {
        variables: {
          webhookUrl: config.webhookUrl,
          dynamodbTableName: dynamoDbTable.name,
        },
      },
    }
  );

  new LambdaPermission(
    config.scope,
    `stop-instances-lambda-perm-${config.dftRegion}`,
    {
      provider: config.provider,
      statementId: 'AllowExecutionFromEventBridge',
      action: 'lambda:InvokeFunction',
      functionName: stopInstanceFunction.lambdaFunctionArn,
      principal: 'events.amazonaws.com',
      sourceArn: stateManagerInstanceStatusEvent.arn,
    }
  );

  new CloudwatchEventTarget(
    config.scope,
    `ansible-assocation-state-manager-instance-status-event-target-${config.dftRegion}`,
    {
      provider: config.provider,
      arn: stopInstanceFunction.lambdaFunctionArn,
      rule: stateManagerInstanceStatusEvent.name,
    }
  );
}
