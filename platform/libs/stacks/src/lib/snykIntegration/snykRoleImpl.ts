import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DfIamRoleConstructConfig } from '@dragonfly/constructs';
import { Construct } from 'constructs';

/**
 * Snyk role
 */
export class SnykRoleImpl implements DfIamRoleConstructConfig {
  public readonly roleName: string;
  public readonly permissionsDocuments: DataAwsIamPolicyDocument[];
  public readonly assumptionDocument: DataAwsIamPolicyDocument;

  /**
   *
   * @param {Construct} stack - Snyk Integration stack
   * @param {string} envName - Env that will own these resources
   */
  constructor(private stack: Construct, private envName: string) {
    this.roleName = `${envName}-SnykIntegrationRole`;
    this.permissionsDocuments = [
      new DataAwsIamPolicyDocument(stack, `${envName}-SnykPermissions`, {
        statement: [
          {
            actions: [
              'apigateway:GET',
              'cloudwatch:GetDashboard',
              'cloudwatch:ListDashboards',
              'cloudwatch:ListTagsForResource',
              'cognito-idp:DescribeIdentityProvider',
              'cognito-idp:DescribeResourceServer',
              'cognito-idp:DescribeUserPool',
              'cognito-idp:DescribeUserPoolClient',
              'cognito-idp:DescribeUserPoolDomain',
              'cognito-idp:GetGroup',
              'cognito-idp:GetUserPoolMfaConfig',
              'cognito-idp:ListGroups',
              'cognito-idp:ListIdentityProviders',
              'cognito-idp:ListResourceServers',
              'cognito-idp:ListUserPoolClients',
              'dynamodb:ListTagsOfResource',
              'ecr:ListTagsForResource',
              'elasticache:ListTagsForResource',
              'elasticfilesystem:DescribeLifecycleConfiguration',
              'elasticfilesystem:DescribeTags',
              'glacier:GetVaultNotifications',
              'glacier:ListTagsForVault',
              'kinesis:DescribeStreamSummary',
              'lambda:GetAlias',
              'lambda:GetEventSourceMapping',
              'lambda:GetFunction',
              'mediastore:DescribeContainer',
              'mediastore:ListTagsForResource',
              'sns:GetSubscriptionAttributes',
              'sns:ListSubscriptions',
              'sns:ListTagsForResource',
              'states:DescribeStateMachine',
              'states:ListTagsForResource',
              'waf-regional:Get*',
              'waf-regional:List*',
              'waf:Get*',
              'waf:List*',
              'wafv2:Get*',
              'wafv2:List*',
            ],
            effect: 'Allow',
            resources: ['*'],
          },
        ],
      }),
    ];

    this.assumptionDocument = new DataAwsIamPolicyDocument(
      stack,
      `${envName}-SnykAssumeRole`,
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            principals: [
              {
                type: 'AWS',
                identifiers: [
                  'arn:aws:iam::370134896156:role/generate-credentials',
                ],
              },
            ],
          },
        ],
      }
    );
  }
}
