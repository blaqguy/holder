import { Construct } from 'constructs/lib/construct';
import { DfLambdaFunctionConstructConfig } from './helpers/interfaces';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { LambdaFunction } from '@cdktf/provider-aws/lib/lambda-function';
import path from 'path';
import { DfPrivateBucketConstruct } from '../constructs';
import { DataArchiveFile } from '@cdktf/provider-archive/lib/data-archive-file';
import { S3Object } from '@cdktf/provider-aws/lib/s3-object';
import { Utils } from '@dragonfly/utils';

/**
 * Creates a DFT custom Lambda function
 */
export class DfLambdaFunctionConstruct extends Construct {
  private lambdaFunction: LambdaFunction;

  /**
   * @param {Construct} scope - The scope the resource is created in
   * @param {string} id - The id for the terraform resource
   * @param {DfLambdaFunctionConfig} config - The configuration properties for the Lambda function
   */
  constructor(
    scope: Construct,
    id: string,
    config: DfLambdaFunctionConstructConfig
  ) {
    super(scope, id);

    const lambdaAsset = new DataArchiveFile(
      this,
      `${config.functionName}-lambda-asset`,
      {
        sourceDir: path.resolve(
          __dirname,
          `lambdaAssets/${config.lambdaFunctionDirectory}`
        ),
        outputPath: path.resolve(
          __dirname,
          `lambdaAssets/${config.functionName}/lambdaAsset.zip`
        ),
        type: 'zip',
      }
    );

    const lambdaArchiveStore = new DfPrivateBucketConstruct(
      this,
      `${config.functionName}-lambdaArchiveStore`,
      {
        bucketName:
          config.lambdaAssetS3BucketName ||
          `${config.functionName}-lambdaAsset`.toLowerCase(),
        provider: config.provider,
      }
    );

    const lambdaArchive = new S3Object(
      this,
      `${config.functionName}lambdaArchive`,
      {
        provider: config.provider,
        bucket: lambdaArchiveStore.bucketId,
        key: 'lambdaAsset.zip',
        source: lambdaAsset.outputPath,
        sourceHash: lambdaAsset.outputBase64Sha256,
      }
    );

    const lambdaRole = new IamRole(this, `${config.functionName}-role`, {
      provider: config.provider,
      name: config.iamRoleName || `${config.functionName}-role`,
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
          },
        ],
      }),
      inlinePolicy: config.inlinePolicy || null,
    });

    const lambdaManagedPolicyArns = [
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      ...(config.lambdaManagedPolicyArns || []),
    ];

    // * Attach managed policies to the role
    lambdaRole.managedPolicyArns = lambdaManagedPolicyArns;

    const lambdaFunctionLogGroup = new CloudwatchLogGroup(
      this,
      `${config.functionName}-lambdaLogGroup`,
      {
        provider: config.provider,
        name: `/aws/lambda/${config.functionName}`,
        retentionInDays: config.lambdaLogGroupRetentionInDays || 7,
      }
    );

    // Make sure that none of the env vars are undefined
    Utils.objContainsFalsyValue(config.environmentVariables.variables);

    /**
     * * Per Terraform Docs, need to explicitly set depends on to the CloudWatch Log Group
     * * To Enable logging
     */
    this.lambdaFunction = new LambdaFunction(
      this,
      `${config.functionName}-lambdaFunction`,
      {
        provider: config.provider,
        dependsOn: [lambdaFunctionLogGroup],
        functionName: config.functionName,
        s3Bucket: lambdaArchiveStore.bucketId,
        s3Key: lambdaArchive.key,
        handler: config.handler || 'dist/index.handler',
        runtime: config.runtime || 'nodejs18.x',
        role: lambdaRole.arn,
        publish: true,
        timeout: config.timeout || 3,
        memorySize: config.memorySize || 128,
        environment: config.environmentVariables || {},
        sourceCodeHash: lambdaAsset.outputBase64Sha256,
      }
    );
  }

  /**
   * @return {string} The ARN of the Lambda function
   */
  public get lambdaFunctionArn(): string {
    return this.lambdaFunction.arn;
  }
}
