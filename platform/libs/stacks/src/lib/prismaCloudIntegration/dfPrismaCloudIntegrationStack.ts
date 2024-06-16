import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DfIamRoleConstruct } from '@dragonfly/constructs';
import { Constants } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';

interface PrismaCloudIntegrationParams {
  adminIntegration: boolean;
}

/**
 *
 */
export class DfPrismaCloudIntegrationStack extends RemoteStack {
  private static readonly STACK_ID = 'PrismaCloudIntegration';

  /**
   *
   */
  constructor(
    protected stackConfig: StackConfig,
    private stackParams: PrismaCloudIntegrationParams
  ) {
    super(DfPrismaCloudIntegrationStack.STACK_ID, stackConfig);

    if (this.stackParams.adminIntegration) {
      this.createAdminResources();
    } else {
      this.createChildResources();
    }
  }

  /**
   *
   */
  private createAdminResources() {
    new DfIamRoleConstruct(this, {
      roleName: 'AWSCloudFormationStackSetAdministrationRole',
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(this, 'PrismaCloudStackSetAdminRole', {
          statement: [
            {
              actions: ['sts:AssumeRole'],
              effect: 'Allow',
              resources: [
                'arn:aws:iam::*:role/AWSCloudFormationStackSetExecutionRole',
              ],
            },
          ],
        }),
      ],
      assumptionDocument: new DataAwsIamPolicyDocument(
        this,
        'PrismaCloudStackSetAssumption',
        {
          statement: [
            {
              actions: ['sts:AssumeRole'],
              effect: 'Allow',
              principals: [
                {
                  type: 'Service',
                  identifiers: ['cloudformation.amazonaws.com'],
                },
              ],
            },
          ],
        }
      ),
    });
  }

  /**
   *
   */
  private createChildResources() {
    new DfIamRoleConstruct(this, {
      roleName: 'AWSCloudFormationStackSetExecutionRole',
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(this, 'PrismaCloudStackSetAdminRole', {
          statement: [
            {
              effect: 'Allow',
              actions: ['*'],
              resources: ['*'],
            },
          ],
        }),
      ],
      assumptionDocument: new DataAwsIamPolicyDocument(
        this,
        'PrismaCloudStackSetAssumption',
        {
          statement: [
            {
              actions: ['sts:AssumeRole'],
              effect: 'Allow',
              principals: [
                {
                  type: 'AWS',
                  identifiers: [
                    `arn:aws:iam::${Constants.ACCOUNT_NUMBER_MASTER}:root`,
                  ],
                },
              ],
            },
          ],
        }
      ),
    });
  }
}
