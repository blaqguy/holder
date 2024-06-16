import { DfIamRoleConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { Utils } from '@dragonfly/utils';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';

/**
 *
 */
export class DfVantaIntegrationStack extends RemoteStack {
  /**
   *
   * @param {string} stackId
   * @param {StackConfig} stackConfig
   */
  constructor(stackId: string, stackConfig: StackConfig) {
    super(stackId, stackConfig);
    const vantaRole = new DfIamRoleConstruct(this, {
      roleName: `${stackId}-integration-role`.toLowerCase(),
      assumptionDocument: new DataAwsIamPolicyDocument(
        this,
        Utils.createConstructResourceId('VantaAssumptionDocument'),
        {
          statement: [
            {
              effect: 'Allow',
              actions: ['sts:AssumeRole'],
              principals: [
                {
                  identifiers: ['956993596390'],
                  type: 'AWS',
                },
              ],
              condition: [
                {
                  test: 'StringEquals',
                  values: ['D8F4F629D47B978'],
                  variable: 'sts:ExternalId',
                },
              ],
            },
          ],
        }
      ),
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(
          this,
          Utils.createConstructResourceId('VantaPermissionsDocument'),
          {
            statement: [
              {
                effect: 'Deny',
                actions: [
                  'datapipeline:EvaluateExpression',
                  'datapipeline:QueryObjects',
                  'rds:DownloadDBLogFilePortion',
                ],
                resources: ['*'],
              },
            ],
          }
        ),
      ],
    });

    new IamRolePolicyAttachment(
      this,
      Utils.createStackResourceId(this.stackUuid, 'VantaSecurityPolicy'),
      {
        role: vantaRole.role.name,
        policyArn: 'arn:aws:iam::aws:policy/SecurityAudit',
      }
    );
  }
}
