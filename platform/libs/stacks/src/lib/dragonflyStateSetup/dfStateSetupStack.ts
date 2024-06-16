import {
  DataAwsIamPolicyDocument,
  DataAwsIamPolicyDocumentConfig,
  DataAwsIamPolicyDocumentStatement,
} from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table';
import { IamGroup } from '@cdktf/provider-aws/lib/iam-group';
import { IamGroupMembership } from '@cdktf/provider-aws/lib/iam-group-membership';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import {
  DfGroupRoleConstruct,
  DfPrivateBucketConstruct,
} from '@dragonfly/constructs';
import { Constants } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';

/**
 * State setup stack
 */
export class DfStateSetupStack extends RemoteStack {
  private static readonly STACK_ID = 'DragonflyStateSetup';
  private bucketConstruct: DfPrivateBucketConstruct;
  private awsIamPolicyDocumentConfig: DataAwsIamPolicyDocumentConfig;
  public bucketPolicyResource: S3BucketPolicy;

  /**
   *
   * @param {StackConfig} stackConfig - Stack Config
   */
  constructor(protected stackConfig: StackConfig) {
    super(DfStateSetupStack.STACK_ID, stackConfig);

    new DynamodbTable(this, 'TerraformBackendLock', {
      name: 'terraform-backend-lock',
      billingMode: 'PAY_PER_REQUEST',
      hashKey: 'LockID',
      attribute: [
        {
          name: 'LockID',
          type: 'S',
        },
      ],
      tags: { Name: 'terraform-backend-lock' },
    });

    const terraformersGroup = new IamGroup(this, 'TerraformersGroup', {
      name: 'terraformers',
    });

    // TODO: Pull out user list
    //
    // Terraform users should be more easily accessible in some YAML file or federated by AD
    new IamGroupMembership(this, 'TerraformersMembers', {
      name: 'terraformers-members',
      group: terraformersGroup.id,
      users: [
        'Jake.Laverty',
        'Emeka.Nnaji',
        'Darby.Kidwell',
        'Gavin.Dale',
        'Fernando.Hudson',
      ],
    });

    const trustAssumptionDoc: DataAwsIamPolicyDocumentStatement = {
      actions: ['sts:AssumeRole'],
      effect: 'Allow',
      principals: [
        {
          type: 'AWS',
          identifiers: [`arn:aws:iam::${Constants.ACCOUNT_NUMBER_TOOLS}:root`],
        },
      ],
    };

    const provisionRole = new DfGroupRoleConstruct(this, 'ProvisionersRole', {
      group: terraformersGroup,
      roleName: 'dragonflyft-terraform-provisioner',
      permissionsPolicyDocument: new DataAwsIamPolicyDocument(
        this,
        'ProvisionersPolicy',
        {
          statement: [
            {
              actions: [
                's3:*',
                'dynamodb:*',
                'iam:*',
                'kms:*',
                'codepipeline:*',
                'codebuild:*',
                'codestar:*',
                'ssm:*',
                'lambda:*',
                'cloudwatch:*',
                'cloudtrail:*',
                'ec2:*',
                'sqs:*',

                // TODO: Delete this.
                //
                // Ok so here's the deal...The account factory for terraform is going to create 300+ different resources
                // across 3 different AWS accounts. I do not want to find out on resource 127 that I'm missing permission
                // so my plan is to give this role admin access to everything in the Master account TEMPORARILY so the deploy
                // works without an issue. After everything is deployed...I can run a plan without this action
                // but because it's just a plan if I fail to read something I can add the correct permissions and try again
                // without messing up the deployment of those 300+ resources.
                '*',
              ],
              effect: 'Allow',
              resources: ['*'],
            },
          ],
        }
      ),
      additionalTrustPolicy: trustAssumptionDoc,
    });

    const stateAdminRole = new DfGroupRoleConstruct(this, 'StateAdminRole', {
      group: terraformersGroup,
      roleName: this.stateRoleName,
      permissionsPolicyDocument: new DataAwsIamPolicyDocument(
        this,
        'StateAdminPolicy',
        {
          statement: [
            {
              actions: ['s3:*', 'kms:*', 'dynamodb:*'],
              effect: 'Allow',
              resources: ['*'],
            },
          ],
        }
      ),
      additionalTrustPolicy: trustAssumptionDoc,
    });

    this.bucketConstruct = new DfPrivateBucketConstruct(
      this,
      'PrivateStateBucket',
      {
        bucketName: 'dragonflyft-tf-state',
        keyProps: {
          name: 'terraform-backend-key',
          description: 'Terraform backend key',
        },
      }
    );

    this.awsIamPolicyDocumentConfig = {
      statement: [
        {
          actions: ['s3:*'],
          effect: 'Deny',
          resources: [
            this.bucketConstruct.bucket.arn,
            `${this.bucketConstruct.bucket.arn}/*`,
          ],
          principals: [
            {
              type: 'AWS',
              identifiers: ['*'],
            },
          ],
          condition: [
            {
              test: 'ArnNotLike',
              values: [
                stateAdminRole.role.arn,
                `arn:aws:sts::${this.stateAccountId}:assumed-role/${stateAdminRole.role.name}/*`,

                // We add the provisioner here in case something funky happens with the state role we can still access and modify the bucket itself with the provision role
                // All state objects in the bucket should still be owned and modified by the state role and operations to the bucket itself will be managed by the provision role
                // The principle of least privilege states we can tighten down permissiones on each of these individually but for now they have effectively the same level of access.
                provisionRole.role.arn,
                `arn:aws:iam::${Constants.ACCOUNT_NUMBER_MASTER}:role/${Constants.ROLE_PROVISION_ROLE_NAME}`,

                // TODO: Remove this safety net
                'arn:aws:iam::446554332519:user/Jake.Laverty',
              ],
              variable: 'aws:PrincipalArn',
            },
          ],
        },
      ],
    };

    const bucketPolicy = new DataAwsIamPolicyDocument(
      this,
      'StateBucketPolicyDoc',
      this.awsIamPolicyDocumentConfig
    );

    this.bucketPolicyResource = new S3BucketPolicy(this, 'StateBucketPolicy', {
      bucket: this.bucketConstruct.bucket.id,
      policy: bucketPolicy.json,
    });
  }

  /**
   * @return {DfPrivateBucketConstruct} - Private bucket resource
   */
  public get bucket(): DfPrivateBucketConstruct {
    return this.bucketConstruct;
  }

  /**
   * @return {DataAwsIamPolicyDocumentConfig} - State policy document
   */
  public get iamPolicyDocumentConfigResource(): DataAwsIamPolicyDocumentConfig {
    return this.awsIamPolicyDocumentConfig;
  }
}
