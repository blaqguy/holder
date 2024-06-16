import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import {
  DataAwsIamPolicyDocument,
  DataAwsIamPolicyDocumentStatement,
} from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamGroup } from '@cdktf/provider-aws/lib/iam-group';
import { IamGroupPolicyAttachment } from '@cdktf/provider-aws/lib/iam-group-policy-attachment';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { Construct } from 'constructs';

interface DfGroupRoleConfig {
  group: IamGroup;
  roleName: string;
  permissionsPolicyDocument: DataAwsIamPolicyDocument;
  additionalTrustPolicy?: DataAwsIamPolicyDocumentStatement;
}

/**
 * Dragonfly Group Role
 */
export class DfGroupRoleConstruct extends Construct {
  private readonly TF_CALLER_IDENTITY: DataAwsCallerIdentity;
  public readonly role: IamRole;
  private trustPolicyDoc: DataAwsIamPolicyDocument;

  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {string} id - A logical identifier for the construct
   * @param {DfGroupRoleConfig} config - Properties for the role
   */
  constructor(scope: Construct, id: string, config: DfGroupRoleConfig) {
    super(scope, id);
    this.TF_CALLER_IDENTITY = new DataAwsCallerIdentity(
      this,
      `${id}CallerData`
    );

    // Create the default policy that allows the role to be assumed by anyone in the account
    // The user will still need specific permissions to assume this role which comes from the group.
    this.trustPolicyDoc = new DataAwsIamPolicyDocument(this, 'MasterTrustDoc', {
      statement: [
        {
          actions: ['sts:AssumeRole'],
          effect: 'Allow',
          principals: [
            {
              type: 'AWS',
              identifiers: [this.TF_CALLER_IDENTITY.accountId],
            },
          ],
        },
        config.additionalTrustPolicy,
      ],
    });

    this.role = new IamRole(this, 'GroupRole', {
      name: config.roleName,
      assumeRolePolicy: this.trustPolicyDoc.json,
      tags: { Name: 'group-role' },
    });

    const rolePerms = new IamPolicy(this, 'PermissionsPolicy', {
      name: `${config.roleName}-permissions-policy`,
      policy: config.permissionsPolicyDocument.json,
      tags: { Name: 'permissions-policy' },
    });

    new IamRolePolicyAttachment(this, 'PermissionsAtt', {
      role: this.role.id,
      policyArn: rolePerms.arn,
    });

    const groupPolicyDoc = new DataAwsIamPolicyDocument(
      this,
      'GroupPolicyDocument',
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            resources: [this.role.arn],
          },
        ],
      }
    );

    const groupRoleAssumptionPolicy = new IamPolicy(this, 'GroupPolicy', {
      name: `${config.roleName}GroupAssumption`,
      policy: groupPolicyDoc.json,
      tags: { Name: `${config.roleName}-group-assumption` },
    });

    new IamGroupPolicyAttachment(this, 'GroupPolicyAtt', {
      group: config.group.id,
      policyArn: groupRoleAssumptionPolicy.arn,
    });
  }

  /**
   * @return {DataAwsIamPolicyDocument} - The trust policy for the group
   */
  public get trustPolicyDocResource() {
    return this.trustPolicyDoc;
  }
}
