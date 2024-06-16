import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Construct } from 'constructs';

export interface DfIamRoleConstructConfig {
  roleName: string;
  permissionsDocuments: DataAwsIamPolicyDocument[];
  assumptionDocument: DataAwsIamPolicyDocument;
  provider?: AwsProvider;
}

/**
 * Iam role construct
 */
export class DfIamRoleConstruct extends Construct {
  public role: IamRole;

  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {RoleProps} config - Properties of the iam role
   */
  constructor(
    private scope: Construct,
    private config: DfIamRoleConstructConfig
  ) {
    super(scope, config.roleName);

    this.role = new IamRole(this, 'IamRole', {
      provider: config.provider,
      name: config.roleName,
      assumeRolePolicy: config.assumptionDocument.json,
      tags: { Name: config.roleName },
    });

    config.permissionsDocuments.forEach((permissionDoc, index) => {
      const permissions = new IamPolicy(
        this,
        `${config.roleName}-PermissionsPolicy${index}`,
        {
          provider: config.provider,
          name: `${config.roleName}-permissions-policy-${index}`,
          policy: permissionDoc.json,
          tags: { Name: `${config.roleName}-permissions-policy-${index}` },
        }
      );

      new IamRolePolicyAttachment(
        this,
        `${config.roleName}-PermissionsAttachement${index}`,
        {
          provider: config.provider,
          role: this.role.id,
          policyArn: permissions.arn,
        }
      );
    });
  }
}
