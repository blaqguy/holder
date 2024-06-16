import {
  DfAnsibleStateManagerAssociation,
  DfSpokeVpcStack,
  UobCluster,
  UobHelperStack,
  UobStack,
} from '@dragonfly/stacks';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, S3BackendConfig, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';
import { SpokeAttachment } from '../crossEnvironmentHelpers/spokeAttachment';
import PlatformSandboxSharedNetworkEnvironment from './environment.platformSandboxSharedNetwork';
import ToolsEnvironment from './environment.tools';
import { PhzAttachment } from '../crossEnvironmentHelpers/phzAssociation';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { UobPlatformSandboxEnvConfiguration } from '../uobEnvConfigurations/uobPlatformSandboxEnvConfiguration';

/**
 * Platform Sandbox Environment
 */
export default class PlatformSandboxEnvironment extends AbstractEnvironment {
  private static instance: PlatformSandboxEnvironment;
  private vpcLegacy: DfSpokeVpcStack;
  private vpcPrimary: DfSpokeVpcStack;
  private vpcRecovery: DfSpokeVpcStack;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    this.createStandardStacks();
    this.overrideStackConfig();

    return this.handler;
  }

  /**
   * This method creates the spoke networking stacks
   */
  private createNetworkStacks() {
    /** SPOKE VPC STACK */
    this.vpcLegacy = new DfSpokeVpcStack(
      'legacy',
      this.stackConfig,
      {
        vpcCidrBlock:
          DfAccounts.getPlatformSandboxAccountDef().vpcCidrs.main.legacy,
      },
      {
        envName: PlatformSandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      }
    );

    this.vpcPrimary = new DfSpokeVpcStack(
      'primary',
      this.stackConfig,
      {
        vpcCidrBlock:
          DfAccounts.getPlatformSandboxAccountDef().vpcCidrs.main.primary,
      },
      {
        envName: PlatformSandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      }
    );

    this.vpcRecovery = new DfSpokeVpcStack(
      'recovery',
      this.stackConfig,
      {
        vpcCidrBlock:
          DfAccounts.getPlatformSandboxAccountDef().vpcCidrs.main.recovery,
      },
      {
        envName: PlatformSandboxEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
      }
    );

    this.vpcPrimary.switchRegion(Constants.AWS_REGION_ALIASES.DF_PRIMARY);

    this.vpcRecovery.switchRegion(Constants.AWS_REGION_ALIASES.DF_RECOVERY);

    /** SPOKE VPC ATTACHMENTS */
    // LEGACY
    new SpokeAttachment({
      spokeVpc: this.vpcLegacy,
      attachmentRegion: Constants.AWS_REGION_ALIASES.LEGACY,
      sharedNetworkInstances: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_PRIMARY),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
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
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(true),
      crossRegionTgw: PlatformSandboxSharedNetworkEnvironment.getInstance(
        this.app
      ).crossRegionTgwPeeringConfig,
      envName: PlatformSandboxEnvironment.ENVIRONMENT_NAME,
      legacyIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .legacy.gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .primary.gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .recovery.gatewayVpcCidr,
      nonProd: true,
    });

    // PRIMARY
    new SpokeAttachment({
      spokeVpc: this.vpcPrimary,
      attachmentRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      sharedNetworkInstances: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_PRIMARY),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
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
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(true), // setting to true for isPlatformSandbox
      crossRegionTgw: PlatformSandboxSharedNetworkEnvironment.getInstance(
        this.app
      ).crossRegionTgwPeeringConfig,
      envName: PlatformSandboxEnvironment.ENVIRONMENT_NAME,
      legacyIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .legacy.gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .primary.gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .recovery.gatewayVpcCidr,
      nonProd: true,
    });

    // RECOVERY
    new SpokeAttachment({
      spokeVpc: this.vpcRecovery,
      attachmentRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      sharedNetworkInstances: {
        [Constants.AWS_REGION_ALIASES.LEGACY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
            this.app
          ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.DF_PRIMARY),
        [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
          PlatformSandboxSharedNetworkEnvironment.getInstance(
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
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(true), // setting to true for isPlatformSandbox
      crossRegionTgw: PlatformSandboxSharedNetworkEnvironment.getInstance(
        this.app
      ).crossRegionTgwPeeringConfig,
      envName: PlatformSandboxEnvironment.ENVIRONMENT_NAME,
      legacyIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .legacy.gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .primary.gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs.gateway
          .recovery.gatewayVpcCidr,
      nonProd: true,
    });

    /** PHZ ATTACHMENTS */
    new PhzAttachment({
      requestingStack: this.vpcLegacy,
      vpcId: this.vpcLegacy.vpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.vpcPrimary,
      vpcId: this.vpcPrimary.vpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.vpcRecovery,
      vpcId: this.vpcRecovery.vpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * Basic resources for account
   */
  private createStandardStacks(): void {
    this.createNetworkStacks();
    const uobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      secretKeyConfgs: [
        {
          name: 'FNBO',
          numberOfPrivateKeys: 1,
          numberOfPublicKeys: 2,
        },
        {
          name: 'SVB',
          numberOfPrivateKeys: 2,
          numberOfPublicKeys: 3,
        },
        {
          name: 'Mizuho',
          numberOfPrivateKeys: 0,
          numberOfPublicKeys: 1,
        },
      ],
      ansibleVars: {
        prodServiceAccounts: false,
      },
      keyProps: {
        keyName: 'uobKeyPair',
        constructName: 'platformSandbox-uobKeyPair',
      },
    });

    uobHelper.createUobEfs({
      constructName: 'model-bank',
      vpc: this.vpcLegacy.vpcConstruct,
      backupPolicy: 'none',
    });

    uobHelper.createUobInstanceRole({
      envName: this.stackConfig.envName,
      resourceName: 'model-bank-instance-role',
    });

    new UobCluster({
      helper: uobHelper,
      uobStack: new UobStack('model-bank-cluster', this.stackConfig, {
        vpc: this.vpcLegacy.vpcConstruct,
      }),
      sopsData: this.sopsData,
      clusterConfiguration:
        UobPlatformSandboxEnvConfiguration.configuration.modelBank,
      networkInstanceBackend: PlatformSandboxEnvironment.getInstance(
        this.app
      ).platformSandboxSharedNetworkS3BackendProps(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      recoveryNetworkInstanceBackend: PlatformSandboxEnvironment.getInstance(
        this.app
      ).platformSandboxSharedNetworkS3BackendProps(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      customerDefinition: DfAccounts.customers.dragonfly,
    });

    new DfAnsibleStateManagerAssociation({
      stackName: 'ansible-state-manager-association',
      stackConfig: this.stackConfig,
      disableNewRelic: 'false',
    });
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'platformSandbox';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'platform-sandbox';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return DfAccounts.getPlatformSandboxAccountDef().accountNumber;
  }

  /**
   * @return {string} - Returns the Legacy VPC_CIDR For the environment
   */
  protected static get VPC_CIDR(): string {
    return DfAccounts.getPlatformSandboxAccountDef().vpcCidrs.main.legacy;
  }

  /**
   * @return {string}
   */
  private static get dockerPushRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${PlatformSandboxEnvironment.ACCOUNT_ID}:role/${PlatformSandboxEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name DockerPush \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   * This method updates the envName
   */
  private overrideStackConfig() {
    this.stackConfig.envName = process.env.DRAGONFLY_DEVELOPMENT_PREFIX;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} regionAlias - The region alias
   * @return {S3BackendConfig} - Returns the s3BackendProps used in the sharedNetworkStack
   */
  public platformSandboxSharedNetworkS3BackendProps(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): S3BackendConfig {
    switch (regionAlias) {
      case Constants.AWS_REGION_ALIASES.LEGACY:
        return this.vpcLegacy.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return this.vpcPrimary.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return this.vpcRecovery.s3BackendPropsResource();
    }
  }

  /**
   *
   * Singleton constructor for the PlatformSandbox class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {PlatformSandboxEnvironment}
   *
   */
  public static getInstance(app: App): PlatformSandboxEnvironment {
    if (!PlatformSandboxEnvironment.instance) {
      PlatformSandboxEnvironment.instance = new PlatformSandboxEnvironment(app);
      PlatformSandboxEnvironment.instance.deployStacks();
    }

    return PlatformSandboxEnvironment.instance;
  }
}
