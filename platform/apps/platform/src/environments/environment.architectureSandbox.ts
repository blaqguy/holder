import {
  DfBuildAutomationRoleStack,
  DfPrismaCloudIntegrationStack,
  DfSpokeVpcStack,
} from '@dragonfly/stacks';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import { PhzAttachment } from '../crossEnvironmentHelpers/phzAssociation';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { AbstractEnvironment } from './abstractEnvironment';
import { SpokeAttachment } from '../crossEnvironmentHelpers/spokeAttachment';
import NonProdSharedNetworkEnvironment from './environment.nonProdSharedNetwork';
import ToolsEnvironment from './environment.tools';

/**
 * Architecture Sandbox Environment
 */
export default class ArchitectureSandboxEnvironment extends AbstractEnvironment {
  private architectureSandboxVpcLegacy: DfSpokeVpcStack;
  private architectureSandboxVpcPrimary: DfSpokeVpcStack;
  private architectureSandboxVpcRecovery: DfSpokeVpcStack;
  private static instance: ArchitectureSandboxEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    this.createVpcs();

    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    return this.handler;
  }

  /**
   * Creates the VPCs for the environment
   */
  private createVpcs(): void {
    this.architectureSandboxVpcLegacy = new DfSpokeVpcStack(
      'architecture',
      this.stackConfig,
      {
        vpcCidrBlock: ArchitectureSandboxEnvironment.LEGACY_VPC_CIDR,
      },
      {
        envName: ArchitectureSandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      }
    );

    this.architectureSandboxVpcPrimary = new DfSpokeVpcStack(
      'architecture-primary-vpc',
      this.stackConfig,
      {
        vpcCidrBlock:
          DfAccounts.getArchitectureSandboxAccountDef().vpcCidrs.main.primary,
      },
      {
        envName: ArchitectureSandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      }
    );

    this.architectureSandboxVpcRecovery = new DfSpokeVpcStack(
      'architecture-revocery-vpc',
      this.stackConfig,
      {
        vpcCidrBlock:
          DfAccounts.getArchitectureSandboxAccountDef().vpcCidrs.main.recovery,
      },
      {
        envName: ArchitectureSandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      }
    );
    this.architectureSandboxVpcPrimary.switchRegion(
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    this.architectureSandboxVpcRecovery.switchRegion(
      Constants.AWS_REGION_ALIASES.DF_RECOVERY
    );

    new SpokeAttachment({
      spokeVpc: this.architectureSandboxVpcLegacy,
      attachmentRegion: Constants.AWS_REGION_ALIASES.LEGACY,
      sharedNetworkInstances: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_PRIMARY),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_RECOVERY),
      },
      sharedToolsS3BackendConfig: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          ToolsEnvironment.toolsLegacyVpcStackConfig(),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          ToolsEnvironment.toolsPrimaryVpcStackConfig(),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          ToolsEnvironment.toolsRecoveryVpcStackConfig(),
      },
      toolsAccountProviderConfig: ToolsEnvironment.accountProviderConfig,
      accountProviderConfig:
        Utils.getNonProdSharedNetworkAccountProviderConfig(),
      crossRegionTgw: NonProdSharedNetworkEnvironment.getInstance(this.app)
        .CrossRegionTgwPeeringConfig,
      envName: this.stackConfig.envName,
      legacyIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
      nonProd: true,
    });

    new SpokeAttachment({
      spokeVpc: this.architectureSandboxVpcPrimary,
      attachmentRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      sharedNetworkInstances: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_PRIMARY),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_RECOVERY),
      },
      sharedToolsS3BackendConfig: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          ToolsEnvironment.toolsLegacyVpcStackConfig(),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          ToolsEnvironment.toolsPrimaryVpcStackConfig(),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          ToolsEnvironment.toolsRecoveryVpcStackConfig(),
      },
      toolsAccountProviderConfig: ToolsEnvironment.accountProviderConfig,
      accountProviderConfig:
        Utils.getNonProdSharedNetworkAccountProviderConfig(),
      crossRegionTgw: NonProdSharedNetworkEnvironment.getInstance(this.app)
        .CrossRegionTgwPeeringConfig,
      envName: this.stackConfig.envName,
      legacyIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
      nonProd: true,
    });

    new SpokeAttachment({
      spokeVpc: this.architectureSandboxVpcRecovery,
      attachmentRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      sharedNetworkInstances: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_PRIMARY),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_RECOVERY),
      },
      sharedToolsS3BackendConfig: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          ToolsEnvironment.toolsLegacyVpcStackConfig(),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          ToolsEnvironment.toolsPrimaryVpcStackConfig(),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          ToolsEnvironment.toolsRecoveryVpcStackConfig(),
      },
      toolsAccountProviderConfig: ToolsEnvironment.accountProviderConfig,
      accountProviderConfig:
        Utils.getNonProdSharedNetworkAccountProviderConfig(),
      crossRegionTgw: NonProdSharedNetworkEnvironment.getInstance(this.app)
        .CrossRegionTgwPeeringConfig,
      envName: this.stackConfig.envName,
      legacyIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
      nonProd: true,
    });

    new PhzAttachment({
      requestingStack: this.architectureSandboxVpcLegacy,
      vpcId: this.architectureSandboxVpcLegacy.vpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.architectureSandboxVpcPrimary,
      vpcId: this.architectureSandboxVpcPrimary.vpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.architectureSandboxVpcRecovery,
      vpcId: this.architectureSandboxVpcRecovery.vpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'architectureSandbox';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'architecture-sandbox';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_ARCHITECTURE_SANDBOX;
  }

  /**
   * @return {string} - Returns the Legacy VPC_CIDR For the environment
   */
  protected static get LEGACY_VPC_CIDR(): string {
    return DfAccounts.getArchitectureSandboxAccountDef().vpcCidrs.main.legacy;
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
  public static getInstance(app: App): ArchitectureSandboxEnvironment {
    if (!ArchitectureSandboxEnvironment.instance) {
      ArchitectureSandboxEnvironment.instance =
        new ArchitectureSandboxEnvironment(app);
      ArchitectureSandboxEnvironment.instance.deployStacks();
    }
    return ArchitectureSandboxEnvironment.instance;
  }
}
