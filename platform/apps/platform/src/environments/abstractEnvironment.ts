import { RemoteStack, StackConfig } from '@dragonfly/stacks';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  DfTagsAspect,
  AccountDefinition,
  Utils,
} from '@dragonfly/utils';
import { App, Aspects, TerraformStack } from 'cdktf';

/**
 * Abstract env class
 */
export abstract class AbstractEnvironment {
  protected handler: RemoteStack[];
  protected abstract createStacks(): TerraformStack[];
  protected stackConfig: StackConfig;

  /**
   *
   * @param {App} app - Root CDK app
   */
  constructor(protected app: App) {
    this.handler = [];
    const staticKlass = <typeof AbstractEnvironment>this.constructor;

    let account: AccountDefinition;
    for (const value of Object.values(DfAccounts.getAccounts())) {
      if (value.accountNumber == staticKlass.ACCOUNT_ID) {
        account = value;
      }
    }

    this.stackConfig = {
      envName: staticKlass.ENVIRONMENT_NAME,
      envSubdomain: staticKlass.ENVIRONMENT_SUBDOMAIN,
      federatedAccountId: staticKlass.ACCOUNT_ID,
      scope: this.app,
      handler: this.handler,
      providerRoleName: staticKlass.PROVIDER_ROLE_NAME,
      accountDefinition: account,
      customerDefinition: DfAccounts.getCustomerByAccountDefinition(account),
    };
  }

  /**
   * Returns sopsData for the environments
   * @return {PlatformSecrets}
   */
  protected get sopsData() {
    return Utils.getSecretsForNode(this.app.node);
  }

  /**
   *
   * @param {TerraformStack} stack
   * @return {TerraformStack}
   */
  private applyAspects(stack: TerraformStack): TerraformStack {
    Aspects.of(stack).add(
      new DfTagsAspect({
        Environment:
          this.stackConfig.federatedAccountId ===
          Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX
            ? 'platform-sandbox'
            : this.stackConfig.envName,
        'map-migrated': 'mig42318',
        'compliance-scope': Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
          this.stackConfig.federatedAccountId
        )
          ? 'prod'
          : 'non-prod',
      })
    );

    return stack;
  }

  /**
   * Environment name
   */
  protected static get ENVIRONMENT_NAME(): string {
    throw new Error('Not implemented');
  }

  /**
   * Environment name
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    throw new Error('Not implemented');
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return 'AWSControlTowerExecution';
  }

  /**
   * Account id
   */
  protected static get ACCOUNT_ID(): string {
    throw new Error('Not implemented');
  }

  /**
   *
   */
  public get accountProviderConfig(): AccountProviderConfig {
    throw new Error('Not implemented');
  }

  /**
   *
   */
  public deployStacks() {
    this.createStacks().forEach((stack: TerraformStack) => {
      this.applyAspects(stack);
    });
  }
}
