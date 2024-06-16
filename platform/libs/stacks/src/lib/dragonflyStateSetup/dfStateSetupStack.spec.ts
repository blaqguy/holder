import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table';
import { IamGroup } from '@cdktf/provider-aws/lib/iam-group';
import { IamGroupMembership } from '@cdktf/provider-aws/lib/iam-group-membership';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfStateSetupStack } from '../stacks';
import { DfAccounts } from '@dragonfly/utils';

describe('Df State Setup Stack', () => {
  it('\r\nShould create a DragonflyStateSetup Stack', () => {
    const mockApp = Testing.app();
    const sopsData = {
      DD_API_KEY: 'test',
      RDS_CONFIG_CREDS: {
        testingStack: {
          username: 'test-admin',
          password: 'password',
        },
      },
    };
    mockApp.node.setContext('sopsData', sopsData);
    const dfStateSetupStack = new DfStateSetupStack({
      envName: 'Dev',
      envSubdomain: 'dev',
      scope: mockApp,
      federatedAccountId: '123',
      handler: [],
      providerRoleName: 'test',
      accountDefinition: DfAccounts.getDevAccountDef(),
      customerDefinition: DfAccounts.getCustomerByAccountDefinition(
        DfAccounts.getDevAccountDef()
      ),
    });
    const synthedMockStack = Testing.synth(dfStateSetupStack);

    expect(synthedMockStack).toHaveResourceWithProperties(DynamodbTable, {
      name: 'terraform-backend-lock',
      billing_mode: 'PAY_PER_REQUEST',
      hash_key: 'LockID',
      attribute: [
        {
          name: 'LockID',
          type: 'S',
        },
      ],
    });

    expect(synthedMockStack).toHaveResourceWithProperties(IamGroup, {
      name: 'terraformers',
    });

    expect(synthedMockStack).toHaveResourceWithProperties(IamGroupMembership, {
      name: 'terraformers-members',
      users: [
        'Jake.Laverty',
        'Emeka.Nnaji',
        'Darby.Kidwell',
        'Gavin.Dale',
        'Fernando.Hudson',
      ],
    });

    expect(synthedMockStack).toHaveDataSourceWithProperties(
      DataAwsIamPolicyDocument,
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
              '*',
            ],
            effect: 'Allow',
            resources: ['*'],
          },
        ],
      }
    );

    expect(synthedMockStack).toHaveDataSourceWithProperties(
      DataAwsIamPolicyDocument,
      {
        statement: [
          {
            actions: ['s3:*', 'kms:*', 'dynamodb:*'],
            effect: 'Allow',
            resources: ['*'],
          },
        ],
      }
    );

    expect(dfStateSetupStack.bucket).toBeDefined();

    const iamPolicyDoc =
      JSON.parse(synthedMockStack)['data'][
        DataAwsIamPolicyDocument.tfResourceType
      ]['StateBucketPolicyDoc'];

    expect(iamPolicyDoc).toMatchObject({
      statement: [
        {
          actions: ['s3:*'],
          effect: 'Deny',
          principals: [
            {
              type: 'AWS',
              identifiers: ['*'],
            },
          ],
          condition: [
            {
              test: 'ArnNotLike',
              variable: 'aws:PrincipalArn',
            },
          ],
        },
      ],
    });

    expect(synthedMockStack).toHaveResource(S3BucketPolicy);
  });
});
