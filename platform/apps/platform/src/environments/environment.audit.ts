import {
  DfBuildAutomationRoleStack,
  DfPrismaCloudIntegrationStack,
  DfVantaIntegrationStack,
} from '@dragonfly/stacks';
import { App, TerraformStack } from 'cdktf';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { AbstractEnvironment } from './abstractEnvironment';

/**
 * Audit Environment
 */
export default class AuditEnvironment extends AbstractEnvironment {
  private static instance: AuditEnvironment;
  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    this.creatEnvCoreStacks();

    return this.handler;
  }

  /**
   * Creates required stacks for the environment upon instantiation
   */
  private creatEnvCoreStacks(): void {
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    new DfVantaIntegrationStack('Vanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return DfAccounts.getAuditAccountDef().name;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'audit';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return DfAccounts.getAuditAccountDef().accountNumber;
  }

  /**
   *
   * Singleton constructor for the AuditEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {AuditEnvironment}
   *
   */
  public static getInstance(app: App): AuditEnvironment {
    if (!AuditEnvironment.instance) {
      AuditEnvironment.instance = new AuditEnvironment(app);
      AuditEnvironment.instance.deployStacks();
    }

    return AuditEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
