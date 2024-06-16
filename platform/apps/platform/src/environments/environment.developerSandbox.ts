import { DfBuildAutomationRoleStack } from '@dragonfly/stacks';
import { Constants } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';

/** Developer Sandbox Env */
export default class DeveloperSandboxEnvironment extends AbstractEnvironment {
  protected static instance: DeveloperSandboxEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    return this.handler;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'developerSandbox';
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'sand';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_DEVELOPER_SANDBOX;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   *
   * Singleton constructor for the QeEnvironment
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {QeEnvironment}
   *
   */
  public static getInstance(app: App): DeveloperSandboxEnvironment {
    if (!DeveloperSandboxEnvironment.instance) {
      DeveloperSandboxEnvironment.instance = new DeveloperSandboxEnvironment(
        app
      );
      DeveloperSandboxEnvironment.instance.deployStacks();
    }

    return DeveloperSandboxEnvironment.instance;
  }
}
