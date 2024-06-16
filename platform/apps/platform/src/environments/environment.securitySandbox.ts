import { DfPrismaCloudIntegrationStack } from '@dragonfly/stacks';
import { App, TerraformStack } from 'cdktf';
import { default as SharedNetworkEnvironment } from './environment.sharedNetwork';
import { NetworkableEnvironment } from './networkableEnvironment';
import { AccountProviderConfig, Constants, DfAccounts } from '@dragonfly/utils';

/** Security Sandbox Environment */
export default class SecuritySandboxEnvironment extends NetworkableEnvironment {
  private static instance: SecuritySandboxEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();

    SharedNetworkEnvironment.regionalNetworkConfig(
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    return this.handler;
  }

  /**
   * @return {string}
   */
  public static get ACCOUNT_ID(): string {
    return DfAccounts.getSecuritySandboxAccountDef().accountNumber;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return DfAccounts.getSecuritySandboxAccountDef().name;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'sand';
  }

  /**
   * @return {string} - Returns the Legacy VPC_CIDR For the environment
   */
  protected static get LEGACY_VPC_CIDR(): string {
    return DfAccounts.getSecuritySandboxAccountDef().vpcCidrs.main.legacy;
  }

  /**
   * @return {string}
   */
  public static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @constructor
   * @param {App} app - The CDK App
   * @return {SecuritySandboxEnvironment} - An instance of the SecuritySanboxEnvironment
   */
  public static getInstance(app: App): SecuritySandboxEnvironment {
    if (!SecuritySandboxEnvironment.instance) {
      SecuritySandboxEnvironment.instance = new SecuritySandboxEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getSecuritySandboxAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getSecuritySandboxAccountDef().vpcCidrs.main.recovery,
        envName: SecuritySandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      });
      SecuritySandboxEnvironment.instance.deployStacks();
    }
    return SecuritySandboxEnvironment.instance;
  }

  /**
   *
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: SecuritySandboxEnvironment.ACCOUNT_ID,
      accountName: SecuritySandboxEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: SecuritySandboxEnvironment.PROVIDER_ROLE_NAME,
    };
  }
}
