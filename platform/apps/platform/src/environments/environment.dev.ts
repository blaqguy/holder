import { DfPrismaCloudIntegrationStack } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import { NetworkableEnvironment } from './networkableEnvironment';

/**
 * Dev Environment
 */
export default class DevEnvironment extends NetworkableEnvironment {
  private static instance: DevEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    return this.handler;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'dev';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'dev';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_DEV;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @constructor
   * @param {App} app - The CDK App
   * @return {ToolsEnvironment} - An instance of the ToolsEnvironment
   */
  public static getInstance(app: App): DevEnvironment {
    if (!DevEnvironment.instance) {
      DevEnvironment.instance = new DevEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getDevAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getDevAccountDef().vpcCidrs.main.recovery,
        envName: DevEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'uob',
        vpcCidrLegacy: DfAccounts.getDevAccountDef().vpcCidrs.main.legacy,
        vpcLegacyStackPrefix: 'uob',
        skipLegacyVpnAuth: true,
      });
      DevEnvironment.instance.deployStacks();
    }
    return DevEnvironment.instance;
  }
}
