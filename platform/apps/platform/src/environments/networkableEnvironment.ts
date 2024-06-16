import { App, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';
// import { DfNewRelicStack, DfSpokeVpcStack } from '@dragonfly/stacks';
import { DfSpokeVpcStack } from '@dragonfly/stacks';
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
import ToolsEnvironment from './environment.tools';

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
export abstract class NetworkableEnvironment extends AbstractEnvironment {
  protected vpcPrimary: DfSpokeVpcStack;
  protected vpcRecovery: DfSpokeVpcStack;
  protected vpcCidrPrimary: string;
  protected vpcCidrRecovery: string;
  protected envName: string;
  protected envTier: 'uat' | 'prod' | 'dev' | 'tools';
  protected sharedSpoke: boolean;
  protected vpcMap: {
    [x: string]: DfSpokeVpcStack;
  };
  protected authorizedGroupConfigs?: AuthorizedGroupConfig[];
  protected spokeVpcStackPrefix: string;
  protected recoverySpokeVpcStackPrefix: string;
  protected isRecoverySpelledWrong: boolean;
  protected vpcLegacy: DfSpokeVpcStack;
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

    if (this.config.vpcCidrPrimary && this.config.vpcCidrRecovery) {
      this.vpcPrimary = new DfSpokeVpcStack(
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

      this.vpcRecovery = new DfSpokeVpcStack(
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

      if (this.config.vpcCidrLegacy) {
        this.vpcLegacy = new DfSpokeVpcStack(
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
      }

      if (this.stackConfig.accountDefinition.networkType === 'nonProd') {
        // * Legacy Attachment
        if (this.config.vpcCidrLegacy) {
          new SpokeAttachment({
            spokeVpc: this.vpcLegacy,
            attachmentRegion: Constants.AWS_REGION_ALIASES.LEGACY,
            sharedNetworkInstances: {
              [Constants.AWS_REGION_ALIASES.LEGACY]:
                NonProdSharedNetworkEnvironment.getInstance(
                  this.app
                ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
              [Constants.AWS_REGION_ALIASES.DF_PRIMARY]:
                NonProdSharedNetworkEnvironment.getInstance(
                  this.app
                ).regionalNetworkConfig(
                  Constants.AWS_REGION_ALIASES.DF_PRIMARY
                ),
              [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
                NonProdSharedNetworkEnvironment.getInstance(
                  this.app
                ).regionalNetworkConfig(
                  Constants.AWS_REGION_ALIASES.DF_RECOVERY
                ),
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
            crossRegionTgw: NonProdSharedNetworkEnvironment.getInstance(
              this.app
            ).CrossRegionTgwPeeringConfig,
            envName: this.stackConfig.envName,
            legacyIngressCidrBlock:
              DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
                .legacy.gatewayVpcCidr,
            primaryIngressCidrBlock:
              DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
                .primary.gatewayVpcCidr,
            recoveryIngressCidrBlock:
              DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
                .recovery.gatewayVpcCidr,
            nonProd: true,
          });
        }
        /**
         * * Primary Attachment
         */

        new SpokeAttachment({
          spokeVpc: this.vpcPrimary,
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
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .legacy.gatewayVpcCidr,
          primaryIngressCidrBlock:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .primary.gatewayVpcCidr,
          recoveryIngressCidrBlock:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
          nonProd: true,
        });

        /**
         * * Recovery
         */

        new SpokeAttachment({
          spokeVpc: this.vpcRecovery,
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
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .legacy.gatewayVpcCidr,
          primaryIngressCidrBlock:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .primary.gatewayVpcCidr,
          recoveryIngressCidrBlock:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
          nonProd: true,
        });
      } else if (this.stackConfig.accountDefinition.networkType === 'prod') {
        // * Legacy Attachment
        if (this.config.vpcCidrLegacy) {
          new SpokeAttachment({
            spokeVpc: this.vpcLegacy,
            attachmentRegion: Constants.AWS_REGION_ALIASES.LEGACY,
            sharedNetworkInstances: {
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
              Utils.getSharedNetworkAccountProviderConfig(),
            crossRegionTgw: SharedNetworkEnvironment.getInstance(this.app)
              .prodCrossRegionTgwPeeringConfig,
            envName: this.stackConfig.envName,
            legacyIngressCidrBlock:
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .legacy.gatewayVpcCidr,
            primaryIngressCidrBlock:
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .primary.gatewayVpcCidr,
            recoveryIngressCidrBlock:
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .recovery.gatewayVpcCidr,
            nonProd: false,
          });
        }
        /**
         * * Primary Attachment
         */

        new SpokeAttachment({
          spokeVpc: this.vpcPrimary,
          attachmentRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          sharedNetworkInstances: {
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
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
          nonProd: false,
        });

        /**
         * * Recovery
         */

        new SpokeAttachment({
          spokeVpc: this.vpcRecovery,
          attachmentRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          sharedNetworkInstances: {
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
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
          nonProd: false,
        });
      }

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

      if (this.config.vpcCidrLegacy) {
        new PhzAttachment({
          requestingStack: this.vpcLegacy,
          vpcId: this.vpcLegacy.vpcConstruct.vpcId,
          networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
            Constants.AWS_REGION_ALIASES.LEGACY
          ),
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        });
      }
    }
    return this.handler;
  }
}
