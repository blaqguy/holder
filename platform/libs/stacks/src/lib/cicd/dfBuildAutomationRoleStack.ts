import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DfIamRoleConstruct } from '@dragonfly/constructs';
import { Constants } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';

/**
 *
 */
export class DfBuildAutomationRoleStack extends RemoteStack {
  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   */
  constructor(stackName: string, stackConfig: StackConfig) {
    super(stackName, stackConfig);

    const policyDoc = new DataAwsIamPolicyDocument(
      this,
      `${Constants.ROLE_PROVISION_ROLE_NAME}-policy-doc`,
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['*'],
            resources: ['*'],
          },
        ],
      }
    );

    const trustDoc = new DataAwsIamPolicyDocument(
      this,
      `${Constants.ROLE_PROVISION_ROLE_NAME}-trust-assumption`,
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            principals: [
              {
                type: 'AWS',
                identifiers: [
                  Constants.ACCOUNT_NUMBER_MASTER,
                  Constants.ACCOUNT_NUMBER_TOOLS,
                ],
              },
              {
                type: 'Service',
                identifiers: [
                  'codebuild.amazonaws.com',
                  'ecs-tasks.amazonaws.com',
                ],
              },
            ],
          },
        ],
      }
    );
    new DfIamRoleConstruct(this, {
      roleName: Constants.ROLE_PROVISION_ROLE_NAME,
      permissionsDocuments: [policyDoc],
      assumptionDocument: trustDoc,
    });
  }
}
