import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import {
  DfIamRoleConstruct,
  DfIamRoleConstructConfig,
} from './dfIamRoleConstruct';

describe('IAM Role', () => {
  it('Should have a resource with name property', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      const props: DfIamRoleConstructConfig = {
        roleName: 'testRole',
        permissionsDocuments: [
          new DataAwsIamPolicyDocument(mockStack, 'mockPerms', {}),
        ],
        assumptionDocument: new DataAwsIamPolicyDocument(
          mockStack,
          'mockAssume',
          {}
        ),
      };
      new DfIamRoleConstruct(mockStack, props);
    });

    expect(synthedMockStack).toHaveResourceWithProperties(IamRole, {
      name: 'testRole',
    });

    expect(synthedMockStack).toHaveResource(IamPolicy);

    expect(synthedMockStack).toHaveResource(IamRolePolicyAttachment);
  });
});
