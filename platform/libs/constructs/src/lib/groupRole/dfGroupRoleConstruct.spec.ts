import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamGroup } from '@cdktf/provider-aws/lib/iam-group';
import { IamGroupPolicyAttachment } from '@cdktf/provider-aws/lib/iam-group-policy-attachment';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfGroupRoleConstruct } from '../constructs';

describe('Group Role Construct', () => {
  it('Should create a Trust Policy Document, IamRole and permissions policy,\r\na policy document, another assumption policy and its attachment', () => {
    const id = 'id';
    const roleName = 'roleName';
    const synthedMockStack = Testing.synthScope((mockStack) => {
      // Create some object that is synth'able
      new DfGroupRoleConstruct(mockStack, id, {
        group: new IamGroup(mockStack, 'idGroup', {
          id: '',
          name: '',
          path: '',
        }),
        roleName: roleName,
        permissionsPolicyDocument: new DataAwsIamPolicyDocument(
          mockStack,
          'idPermission',
          {}
        ),
      });
    });

    const parsedJson = JSON.parse(synthedMockStack);
    const parsedJsonResource = parsedJson['data'];
    const keyJson = parsedJsonResource[DataAwsIamPolicyDocument.tfResourceType];
    // We do this line because the token of the resource is appended to the key in the JSON so we don't know that
    const keyMasterTrustDoc = Object.keys(keyJson)[2];
    expect(keyJson[keyMasterTrustDoc]).toMatchObject({
      statement: [
        {
          actions: ['sts:AssumeRole'],
          effect: 'Allow',
          principals: [
            {
              type: 'AWS',
            },
          ],
        },
      ],
    });

    expect(synthedMockStack).toHaveResourceWithProperties(IamRole, {
      name: roleName,
    });

    expect(synthedMockStack).toHaveResource(IamPolicy);

    expect(synthedMockStack).toHaveResource(IamGroupPolicyAttachment);
  });
});
