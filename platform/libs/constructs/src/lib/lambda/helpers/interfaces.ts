import { IamRoleInlinePolicy } from '@cdktf/provider-aws/lib/iam-role';
import { LambdaFunctionEnvironment } from '@cdktf/provider-aws/lib/lambda-function';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

/**
 * Represents configuration options for creating a Lambda function.
 * @property {string} functionName - The name of the Lambda function.
 * @property {string} [iamRoleName] - The name of the IAM role to attach to the Lambda function.
 * @property {string} [lambdaAssetS3BucketName] - The name of the S3 bucket to store the Lambda function.
 * @property {AwsProvider} provider - The Terraform Provider used to create the Lambda function.
 * @property {string} lambdaFunctionDirectory - The directory of the Lambda function.
 * @property {string[]} [lambdaManagedPolicyArns] - The ARNs of the managed policies to attach to the Lambda function.
 * @property {number} [lambdaLogGroupRetentionInDays] - The number of days to retain the logs in the CloudWatch Log Group.
 * @property {number} [timeout] - The amount of time the Lambda function has to run in seconds.
 * @property {number} [memorySize] - The amount of memory the Lambda function has in MB.
 * @property {LambdaFunctionEnvironment} [environmentVariables] - The environment variables to pass to the Lambda function.
 * @property {string} [handler] - The entry point of the Lambda function.
 * @property {string} [runtime] - The runtime of the Lambda function.
 * @property {IamRoleInlinePolicy[]} [inlinePolicy] - The inline policy to attach to the Lambda function.
 */
export interface DfLambdaFunctionConstructConfig {
  /**
   * The name of the Lambda function
   */
  functionName: string;
  /**
   * The name of the IAM role to attach to the Lambda function.
   * Set this if you're deploying the Lambda Function to multiple regions
   */
  iamRoleName? : string;
  /**
   * The name of the S3 bucket to store the Lambda function
   * Set this if you're deploying the Lambda Function to multiple regions
   */
  lambdaAssetS3BucketName?: string;
  /**
   * The Terraform Provider used to create the Lambda function
   */
  provider: AwsProvider;
  /**
   * The directory of the Lambda function
   */
  lambdaFunctionDirectory: string;
  /**
   * The ARNs of the managed policies to attach to the Lambda function
   */
  lambdaManagedPolicyArns?: string[];
  /**
   * The number of days to retain the logs in the CloudWatch Log Group
   */
  lambdaLogGroupRetentionInDays?: number;
  /**
   * The amount of time the Lambda function has to run in seconds
   */
  timeout?: number;
  /**
   * The amount of memory the Lambda function has in MB
   */
  memorySize?: number;
  /**
   * The environment variables to pass to the Lambda function
   */
  environmentVariables?: LambdaFunctionEnvironment;
  /**
   * The entry point of the Lambda function
   */
  handler?: string;
  /**
   * The runtime of the Lambda function
   */
  runtime?: string;
  /**
   * The inline policy to attach to the Lambda function
   */
  inlinePolicy?: IamRoleInlinePolicy[];
}
