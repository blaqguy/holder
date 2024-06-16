import {
  DfBuildAutomationRoleStack,
  DfPrismaCloudIntegrationStack,
  DfSharedNetworkStack,
  DfVantaIntegrationStack,
  DfClientVpnStack,
  DfWindowsS1AgentStack,
  DfSharedNetworkResolver,
  DfWindowsNetworkSensorAgentAssociationStack,
  // DfNewRelicStack,
  DfNonProdClientVpnStack,
  DfCrossRegionTgwPeeringStack,
} from '@dragonfly/stacks';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, S3BackendConfig, TerraformStack } from 'cdktf';
import {
  AbstractSharedNetworkEnvironment,
  NetworkInstanceConfig,
} from './abstractSharedNetworkEnvironment';
import MasterEnvironment from './environment.master';
import { PhzAttachment } from '../crossEnvironmentHelpers/phzAssociation';
import SharedNetworkEnvironment from './environment.sharedNetwork';

/** NonProdSharedNetworkEnvironment */
export default class NonProdSharedNetworkEnvironment extends AbstractSharedNetworkEnvironment {
  private static instance: NonProdSharedNetworkEnvironment;
  private nonProdSharedNetworkStackLegacy: DfSharedNetworkStack;
  private nonProdSharedNetworkStackPrimary: DfSharedNetworkStack;
  private nonProdSharedNetworkStackRecovery: DfSharedNetworkStack;
  private clientVpnEndpoints: DfClientVpnStack;
  private crossRegionTgwPeering: DfCrossRegionTgwPeeringStack;

  /**
   * @return {[]}
   */
  protected createStacks(): TerraformStack[] {
    this.createEnvCoreStacks();
    this.createSharedNetworks();
    this.createVpnEndpoints();
    this.createCrossRegionTgwPeer();

    new DfWindowsS1AgentStack('windows-s1-agent', this.stackConfig);

    new DfWindowsNetworkSensorAgentAssociationStack(
      this.stackConfig,
      'network-sensor-windows-agent-association',
      {
        regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      }
    );

    this.createSharedNetworkResolvers();

    // new DfNewRelicStack('new-relic', this.stackConfig);

    return this.handler;
  }

  /**
   * Creates required stacks for the environment upon instantiation
   */
  private createEnvCoreStacks(): void {
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
   * @return {DfSharedNetworkStack} - The shared network stack
   */
  private createSharedNetworks(): DfSharedNetworkStack[] {
    this.nonProdSharedNetworkStackLegacy = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.NON_PROD_LEGACY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.inspection
              .legacy,
          gatewayVpcCidrs:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .legacy,
        },
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        tgwAsn: 65533,
        nonProd: true,
        inspectionRoleAssumption:
          NonProdSharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
        bypassInspection: true, // TODO: Update this to false once we deploy NONPROD SHAREDNETWORK changes and have PAs deployed in the legacy region to forward traffic to in the inspection vpc
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'LEGACY',
        deployHybridNetworking: false,
        paloAlto: {
          deploy: true,
          paR53Records: ['nonprod-dft-pa-legacy-01']
        }
      }
    );

    this.nonProdSharedNetworkStackPrimary = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.NON_PROD_PRIMARY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.inspection
              .primary,
          gatewayVpcCidrs:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .primary,
        },
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        tgwAsn: 65532,
        nonProd: true,
        inspectionRoleAssumption:
          NonProdSharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
        bypassInspection: false, // TODO: Update this to false once we deploy NONPROD SHAREDNETWORK changes and have PAs deployed in the primary region to forward traffic to in the inspection vpc
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'PRIMARY',
        deployHybridNetworking: false,
        paloAlto: {
          deploy: true,
          paR53Records: ['nonprod-dft-pa-primary-01']
        }
      }
    );

    this.nonProdSharedNetworkStackRecovery = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.NON_PROD_RECOVERY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.inspection
              .recovery,
          gatewayVpcCidrs:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery,
        },
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        tgwAsn: 65531,
        nonProd: true,
        inspectionRoleAssumption:
          NonProdSharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
        bypassInspection: true, // TODO: Update this to false once we deploy NONPROD SHAREDNETWORK changes and have PAs deployed in the recovery region to forward traffic to in the inspection vpc
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'RECOVERY',
        deployHybridNetworking: false,
        paloAlto: {
          deploy: true,
          paR53Records: ['nonprod-dft-pa-recovery-01']
        }
      }
    );

    new PhzAttachment({
      requestingStack: this.nonProdSharedNetworkStackLegacy,
      vpcId: this.nonProdSharedNetworkStackLegacy.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.nonProdSharedNetworkStackPrimary,
      vpcId: this.nonProdSharedNetworkStackPrimary.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.nonProdSharedNetworkStackRecovery,
      vpcId: this.nonProdSharedNetworkStackRecovery.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    return [
      this.nonProdSharedNetworkStackLegacy,
      this.nonProdSharedNetworkStackPrimary,
      this.nonProdSharedNetworkStackRecovery,
    ];
  }

  /**
   * @return {DfClientVpnStack} - The client vpn stack
   */
  private createVpnEndpoints(): DfClientVpnStack {
    this.clientVpnEndpoints = new DfNonProdClientVpnStack(
      'client-vpn',
      this.stackConfig,
      {
        gatewayVpcs: {
          legacy: {
            vpcConstruct:
              this.nonProdSharedNetworkStackLegacy.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
                .legacy.gatewayVpcCidr,
          },
          primary: {
            vpcConstruct:
              this.nonProdSharedNetworkStackPrimary.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
                .primary.gatewayVpcCidr,
          },
          recovery: {
            vpcConstruct:
              this.nonProdSharedNetworkStackRecovery.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
                .recovery.gatewayVpcCidr,
          },
        },
        cvpnCidrs: {
          legacy:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.clientVpn
              .legacy,
          primary:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.clientVpn
              .primary,
          recovery:
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.clientVpn
              .recovery,
        },
        masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
        R53Cname: 'non-prod-vpn',
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
      }
    );
    return this.clientVpnEndpoints;
  }

  /**
   * @return {DfCrossRegionTgwPeeringStack} - The cross region tgw peering stack
   */
  private createCrossRegionTgwPeer(): DfCrossRegionTgwPeeringStack {
    this.crossRegionTgwPeering = new DfCrossRegionTgwPeeringStack(
      'CrossRegionTgwPeering',
      this.stackConfig,
      {
        legacySharedNetworkTransitGateway:
          this.nonProdSharedNetworkStackLegacy.tgwConstruct,
        primarySharedNetworkTransitGateway:
          this.nonProdSharedNetworkStackPrimary.tgwConstruct,
        recoverySharedNetworkTransitGateway:
          this.nonProdSharedNetworkStackRecovery.tgwConstruct,
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
        peerGatewayVpcs: true,
      }
    );

    return this.crossRegionTgwPeering;
  }

  /**
   * @description Creates the shared network resolver
   */
  private createSharedNetworkResolvers(): void {
    new DfSharedNetworkResolver('cvpn-resolver', this.stackConfig, {
      vpcs: {
        legacy: this.nonProdSharedNetworkStackLegacy.gatewayVpcConstruct,
        primary: this.nonProdSharedNetworkStackPrimary.gatewayVpcConstruct,
        recovery: this.nonProdSharedNetworkStackRecovery.gatewayVpcConstruct,
      },
    });
  }

  /**
   *
   * Singleton constructor for the SharedNetwork
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {NonProdSharedNetworkEnvironment}
   *
   */
  public static getInstance(app: App): NonProdSharedNetworkEnvironment {
    if (!NonProdSharedNetworkEnvironment.instance) {
      NonProdSharedNetworkEnvironment.instance =
        new NonProdSharedNetworkEnvironment(app);
      NonProdSharedNetworkEnvironment.instance.deployStacks();
    }

    return NonProdSharedNetworkEnvironment.instance;
  }

  /**
   * @return {string} - Account ID
   */
  protected static get ACCOUNT_ID(): string {
    return DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber;
  }

  /**
   * @return {string} - Environment name
   */
  public static get ENVIRONMENT_NAME(): string {
    return DfAccounts.getNonProdSharedNetworkAccountDef().name;
  }

  /**
   * @return {string} - Environment name
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'non-prod-shared-network'; // ! Is this relevant for SharedNetwork?
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @return {string}
   */
  private static get awsCliRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${
        DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber
      }:role/${NonProdSharedNetworkEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name RouteAdd \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   * @return {string}
   */
  public get CrossRegionTgwPeeringConfig(): S3BackendConfig {
    return this.crossRegionTgwPeering.s3BackendPropsResource();
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} regionAlias - The region alias
   * @return {S3BackendConfig} - Returns the s3BackendProps used in the sharedNetworkStack
   */
  public nonProdSharedNetworkS3BackendProps(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): S3BackendConfig {
    switch (regionAlias) {
      case Constants.AWS_REGION_ALIASES.LEGACY:
        return this.nonProdSharedNetworkStackLegacy.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return this.nonProdSharedNetworkStackPrimary.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return this.nonProdSharedNetworkStackRecovery.s3BackendPropsResource();
    }
  }

  /**
   *
   * @param {Constants.AWS_REGION_ALIASES} regionAlias
   * @return {NetworkInstanceConfig}
   */
  public regionalNetworkConfig(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): NetworkInstanceConfig {
    return {
      environmentName: NonProdSharedNetworkEnvironment.ENVIRONMENT_NAME,
      s3BackendProps: this.nonProdSharedNetworkS3BackendProps(regionAlias),
      remoteStateId: 'non-prod-shared-network',
    };
  }

  /**
   * @return {string}
   */
  public get cvpnEndpointConfig(): S3BackendConfig {
    return this.clientVpnEndpoints.s3BackendPropsResource();
  }
}
