import {
  DfStateSetupStack,
  DfAccountFactoryStack,
  DfOrgStructureStack,
  DfSnykIntegrationStack,
  OrgMap,
  DfBuildAutomationRoleStack,
  DfPrismaCloudIntegrationStack,
  DfBackupPoliciesStack,
  DfAccessAnalyzerStack,
} from '@dragonfly/stacks';
import { AccountProviderConfig, Constants } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';

/** Master Environment */
export default class MasterEnvironment extends AbstractEnvironment {
  private static instance: MasterEnvironment;
  private static ORG_MAP: OrgMap = {
    Root: {
      Sandbox: null,
      Network: null,
      Tools: null,
      Dev: null,
      Performance: null,
      QE: null,
      IST: null,
      UAT: null,
      Prod: null,
    },
  };

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    new DfStateSetupStack(this.stackConfig);
    new DfAccountFactoryStack(this.stackConfig);

    new DfOrgStructureStack(this.stackConfig, {
      orgMap: MasterEnvironment.ORG_MAP,
    });
    new DfSnykIntegrationStack(this.stackConfig);
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: true,
    });

    new DfBackupPoliciesStack('backup-policies', this.stackConfig);
    
    new DfAccessAnalyzerStack('org-wide-access-analyzer', this.stackConfig);

    return this.handler;
  }

  /**
   * @return {string}
   */
  public static get ENVIRONMENT_NAME(): string {
    return Constants.ENVIRONMENT_NAME_MASTER;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'master';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_MASTER;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // Can use 'dragonflyft-terraform-provisioner' role as backup
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   *
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: MasterEnvironment.ACCOUNT_ID,
      accountName: MasterEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: MasterEnvironment.PROVIDER_ROLE_NAME,
    };
  }

  /**
   *
   * Singleton constructor for the MasterEnvironment
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {MasterEnvironment}
   *
   */
  public static getInstance(app: App): MasterEnvironment {
    if (!MasterEnvironment.instance) {
      MasterEnvironment.instance = new MasterEnvironment(app);
      MasterEnvironment.instance.deployStacks();
    }

    return MasterEnvironment.instance;
  }
}
