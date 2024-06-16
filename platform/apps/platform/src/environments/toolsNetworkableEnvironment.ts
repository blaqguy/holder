import { App, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';
// import { DfNewRelicStack, DfToolsVpcStack } from '@dragonfly/stacks';
import { DfToolsVpcStack } from '@dragonfly/stacks';
import {
  AuthorizedGroupConfig,
  Constants,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { PhzAttachment } from '../crossEnvironmentHelpers/phzAssociation';
import NonProdSharedNetworkEnvironment from './environment.nonProdSharedNetwork';
import { SpokeAttachment } from '../crossEnvironmentHelpers/spokeAttachment';

export interface EnvironmentConfig {
  app: App;
  vpcCidrPrimary: string;
  vpcCidrRecovery: string;
  envName: string;
  envTier: 'uat' | 'prod' | 'dev' | 'tools';
  sharedSpoke: boolean;
  spokeVpcStackPrefix?: string;
  recoverySpokeVpcStackPrefix?: string;
  isRecoverySpelledWrong?: boolean;
  vpcCidrLegacy?: string;
  vpcLegacyStackPrefix?: string;
  skipLegacyVpnAuth?: boolean;
}

/**
 *
 */
export abstract class ToolsNetworkableEnvironment extends AbstractEnvironment {
  protected vpcPrimary: DfToolsVpcStack;
  protected vpcRecovery: DfToolsVpcStack;
  protected vpcCidrPrimary: string;
  protected vpcCidrRecovery: string;
  protected envName: string;
  protected envTier: 'uat' | 'prod' | 'dev' | 'tools';
  protected sharedSpoke: boolean;
  protected vpcMap: {
    [x: string]: DfToolsVpcStack;
  };
  protected authorizedGroupConfigs?: AuthorizedGroupConfig[];
  protected spokeVpcStackPrefix: string;
  protected recoverySpokeVpcStackPrefix: string;
  protected isRecoverySpelledWrong: boolean;
  protected vpcLegacy: DfToolsVpcStack;
  protected vpcCidrLegacy: string;
  protected vpcLegacyStackPrefix: string;
  protected skipLegacyVpnAuth: boolean;
  protected config: EnvironmentConfig;

  /**
   * @param {EnvironmentConfig} environmentConfig
   */
  constructor(environmentConfig: EnvironmentConfig) {
    super(environmentConfig.app);
    this.config = environmentConfig;
    this.config.vpcCidrPrimary = environmentConfig.vpcCidrPrimary;
    this.config.vpcCidrRecovery = environmentConfig.vpcCidrRecovery;
    this.config.envName = environmentConfig.envName;
    this.config.envTier = environmentConfig.envTier;
    this.config.sharedSpoke = environmentConfig.sharedSpoke;
    this.config.spokeVpcStackPrefix = environmentConfig.spokeVpcStackPrefix;
    this.config.recoverySpokeVpcStackPrefix =
      environmentConfig.recoverySpokeVpcStackPrefix;
    this.config.isRecoverySpelledWrong =
      environmentConfig.isRecoverySpelledWrong ?? false;
    this.config.vpcCidrLegacy = environmentConfig.vpcCidrLegacy;
    this.config.vpcLegacyStackPrefix = environmentConfig.vpcLegacyStackPrefix;
    this.config.skipLegacyVpnAuth = environmentConfig.skipLegacyVpnAuth;
  }

  /**
   * VPC CIDR
   */
  protected static get VPC_CIDR(): string {
    throw new Error('Not implemented');
  }

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createNetworkStacks(): TerraformStack[] {
    // * Create the New Relic stack
    // new DfNewRelicStack('new-relic', this.stackConfig);

    this.vpcPrimary = new DfToolsVpcStack(
      `${this.config.spokeVpcStackPrefix ?? this.config.envName}-primary-vpc`,
      this.stackConfig,
      {
        vpcCidrBlock: this.config.vpcCidrPrimary,
      },
      {
        envName: this.config.envName,
        envTier: this.config.envTier,
        sharedSpoke: this.config.sharedSpoke,
      }
    );

    this.vpcRecovery = new DfToolsVpcStack(
      `${
        this.config.recoverySpokeVpcStackPrefix ??
        this.config.spokeVpcStackPrefix ??
        this.config.envName
      }-${this.config.isRecoverySpelledWrong ? 'revocery' : 'recovery'}-vpc`,
      this.stackConfig,
      {
        vpcCidrBlock: this.config.vpcCidrRecovery,
      },
      {
        envName: this.config.envName,
        envTier: this.config.envTier,
        sharedSpoke: this.config.sharedSpoke,
      }
    );

    this.vpcPrimary.switchRegion(Constants.AWS_REGION_ALIASES.DF_PRIMARY);

    this.vpcRecovery.switchRegion(Constants.AWS_REGION_ALIASES.DF_RECOVERY);

    this.vpcLegacy = new DfToolsVpcStack(
      `${
        this.config.vpcLegacyStackPrefix ??
        this.config.spokeVpcStackPrefix ??
        this.config.envName
      }`,
      this.stackConfig,
      {
        vpcCidrBlock: this.config.vpcCidrLegacy,
      },
      {
        envName: this.config.envName,
        envTier: this.config.envTier,
        sharedSpoke: this.config.sharedSpoke,
      }
    );

    // * Spoke Attachment configs
    const sharedNetworkConfig = {
      [Constants.AWS_REGION_ALIASES.LEGACY]:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
      [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
      [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_RECOVERY
        ),
    };

    // * Spoke Attachment configs for Non Prod
    const nonProdSharedNetworkConfig = {
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
    };

    const nonProdCommonConfig = {
      nonProd: true,
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
    };

    const nonProdConfigs = {
      nonProdPrimaryAttachment: {
        spokeVpc: this.vpcPrimary,
        attachmentRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        sharedNetworkInstances: nonProdSharedNetworkConfig,
        ...nonProdCommonConfig,
      },
      nonProdRecoveryAttachment: {
        spokeVpc: this.vpcRecovery,
        attachmentRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        sharedNetworkInstances: nonProdSharedNetworkConfig,
        ...nonProdCommonConfig,
      },
      nonProdLegacyAttachment: {
        spokeVpc: this.vpcLegacy,
        attachmentRegion: Constants.AWS_REGION_ALIASES.LEGACY,
        sharedNetworkInstances: nonProdSharedNetworkConfig,
        ...nonProdCommonConfig,
      },
    };

    // * Loop through the configs and create a SpokeAttachment for each one that's defined
    Object.values(nonProdConfigs).forEach((config) => {
      new SpokeAttachment(config);
    });

    // * Spoke Attachment configs for Prod
    const prodSharedNetworkConfig = {
      [Constants.AWS_REGION_ALIASES.LEGACY]:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
      [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
      [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_RECOVERY
        ),
    };

    const prodCommonConfig = {
      nonProd: false,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      crossRegionTgw: SharedNetworkEnvironment.getInstance(this.app)
        .prodCrossRegionTgwPeeringConfig,
      envName: this.stackConfig.envName,
      legacyIngressCidrBlock:
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      primaryIngressCidrBlock:
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr,
      recoveryIngressCidrBlock:
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
    };

    const prodConfigs = {
      prodPrimaryAttachment: {
        spokeVpc: this.vpcPrimary,
        attachmentRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        sharedNetworkInstances: prodSharedNetworkConfig,
        ...prodCommonConfig,
      },
      prodRecoveryAttachment: {
        spokeVpc: this.vpcRecovery,
        attachmentRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        sharedNetworkInstances: prodSharedNetworkConfig,
        ...prodCommonConfig,
      },
      prodLegacyAttachment: {
        spokeVpc: this.vpcLegacy,
        attachmentRegion: Constants.AWS_REGION_ALIASES.LEGACY,
        sharedNetworkInstances: prodSharedNetworkConfig,
        ...prodCommonConfig,
      },
    };

    // * Loop through the configs and create a SpokeAttachment for each one that's defined
    Object.values(prodConfigs).forEach((config) => {
      new SpokeAttachment(config);
    });

    // * PHZ Attachment configs
    const phzAttachmentConfig = {
      primary: {
        requestingStack: this.vpcPrimary,
        vpcId: this.vpcPrimary.vpcConstruct.vpcId,
        networkInstance:
          sharedNetworkConfig[Constants.AWS_REGION_ALIASES.DF_PRIMARY],
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      },
      recovery: {
        requestingStack: this.vpcRecovery,
        vpcId: this.vpcRecovery.vpcConstruct.vpcId,
        networkInstance:
          sharedNetworkConfig[Constants.AWS_REGION_ALIASES.DF_RECOVERY],
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      },
      legacy: {
        requestingStack: this.vpcLegacy,
        vpcId: this.vpcLegacy.vpcConstruct.vpcId,
        networkInstance:
          sharedNetworkConfig[Constants.AWS_REGION_ALIASES.LEGACY],
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      },
    };

    Object.values(phzAttachmentConfig).forEach((config) => {
      new PhzAttachment(config);
    });

    return this.handler;
  }
}
