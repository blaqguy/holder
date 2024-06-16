import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { DfIamRoleConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { SnykRoleImpl } from './snykRoleImpl';

/**
 * Snyk integration stack
 */
export class DfSnykIntegrationStack extends RemoteStack {
  private static readonly STACK_ID = 'SnykIntegration';
  private dragonflySnykIamRole: DfIamRoleConstruct;

  /**
   *
   * @param {StackConfig} stackConfig - Stack config to take in
   * @param {string} federatedAccountId - Aws account id resources will be deployed to
   */
  constructor(protected stackConfig: StackConfig) {
    super(DfSnykIntegrationStack.STACK_ID, stackConfig);

    this.dragonflySnykIamRole = new DfIamRoleConstruct(
      this,
      new SnykRoleImpl(this, this.stackConfig.envName)
    );

    new IamRolePolicyAttachment(this, 'ManagedSecurityAuditSnyk', {
      role: this.dragonflySnykIamRole.role.id,
      policyArn: 'arn:aws:iam::aws:policy/SecurityAudit',
    });
  }

  /**
   * @return {DfIamRoleConstruct}
   */
  public get dfSnykIamRole(): DfIamRoleConstruct {
    return this.dragonflySnykIamRole;
  }
}
