import {
  DfBuildAutomationRoleStack,
  DfClientVpnStack,
  DfProductionClientVpnStack,
  DfSharedNetworkStack,
  DfCrossRegionTgwPeeringStack,
} from '@dragonfly/stacks';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import { App, S3BackendConfig, TerraformStack } from 'cdktf';
import {
  AbstractSharedNetworkEnvironment,
  NetworkInstanceConfig,
} from './abstractSharedNetworkEnvironment';
import { PhzAttachment } from '../crossEnvironmentHelpers/phzAssociation';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import MasterEnvironment from './environment.master';

/** PlatformSandboxSharedNetworkEnvironment */
export default class PlatformSandboxSharedNetworkEnvironment extends AbstractSharedNetworkEnvironment {
  private static instance: PlatformSandboxSharedNetworkEnvironment;
  private platformSandboxSharedNetworkStackLegacy: DfSharedNetworkStack;
  private platformSandboxSharedNetworkStackRecovery: DfSharedNetworkStack;
  private platformSandboxSharedNetworkStackPrimary: DfSharedNetworkStack;
  private crossRegionTgwPeering: DfCrossRegionTgwPeeringStack;
  private clientVpnEndpoints: DfClientVpnStack;
  /**
   * @return {[]}
   */
  protected createStacks(): TerraformStack[] {
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    this.createSharedNetworks();
    this.createCrossRegionTgwPeer();
    this.createVpnEndpoints();

    return this.handler;
  }

  /**
   *
   * @return {DfSharedNetworkStack} - The shared network stack
   */
  private createSharedNetworks(): DfSharedNetworkStack[] {
    this.platformSandboxSharedNetworkStackLegacy = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.PS_LEGACY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .inspection.legacy,
          gatewayVpcCidrs:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .gateway.legacy,
        },
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        tgwAsn: 65533,
        nonProd: true,
        inspectionRoleAssumption:
          PlatformSandboxSharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getPlatformSandboxSharedNetworkAccountDef(),
        bypassInspection: true, // TODO: Update this to false ONLY IF we have PAs deployed in the LEGACY region to forward traffic to in the inspection vpc
        externalCustomers: DfAccounts.getExternalCustomers(),
        deployHybridNetworking: false,
        paloAlto: {
          deploy: false
        }
      }
    );

    this.platformSandboxSharedNetworkStackPrimary = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.PS_PRIMARY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .inspection.primary,
          gatewayVpcCidrs:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .gateway.primary,
        },
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        tgwAsn: 65532,
        nonProd: true,
        inspectionRoleAssumption:
          PlatformSandboxSharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getPlatformSandboxSharedNetworkAccountDef(),
        bypassInspection: true,
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'PRIMARY',
        paloAlto: {
          deploy: false
        },
        deployHybridNetworking: false,
      }
    );

    this.platformSandboxSharedNetworkStackRecovery = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.PS_RECOVERY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .inspection.recovery,
          gatewayVpcCidrs:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .gateway.recovery,
        },
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        tgwAsn: 65531,
        nonProd: true,
        inspectionRoleAssumption:
          PlatformSandboxSharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getPlatformSandboxSharedNetworkAccountDef(),
        bypassInspection: true, // TODO: Update this to false once we have PAs deployed in the recovery region to forward traffic to in the inspection vpc
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'RECOVERY',
        deployHybridNetworking: false,
        paloAlto: {
          deploy: false
        }
      }
    );

    new PhzAttachment({
      requestingStack: this.platformSandboxSharedNetworkStackLegacy,
      vpcId:
        this.platformSandboxSharedNetworkStackLegacy.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.platformSandboxSharedNetworkStackPrimary,
      vpcId:
        this.platformSandboxSharedNetworkStackPrimary.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.platformSandboxSharedNetworkStackRecovery,
      vpcId:
        this.platformSandboxSharedNetworkStackRecovery.gatewayVpcConstruct
          .vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    return [
      this.platformSandboxSharedNetworkStackLegacy,
      this.platformSandboxSharedNetworkStackPrimary,
      this.platformSandboxSharedNetworkStackRecovery,
    ];
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
          this.platformSandboxSharedNetworkStackLegacy.tgwConstruct,
        primarySharedNetworkTransitGateway:
          this.platformSandboxSharedNetworkStackPrimary.tgwConstruct,
        recoverySharedNetworkTransitGateway:
          this.platformSandboxSharedNetworkStackRecovery.tgwConstruct,
        account: DfAccounts.getPlatformSandboxSharedNetworkAccountDef(),
        peerGatewayVpcs: true,
      }
    );

    return this.crossRegionTgwPeering;
  }

  /**
   * @return {DfClientVpnStack} - The client vpn stack
   */
  private createVpnEndpoints(): DfClientVpnStack {
    this.clientVpnEndpoints = new DfProductionClientVpnStack(
      'client-vpn',
      this.stackConfig,
      {
        gatewayVpcs: {
          legacy: {
            vpcConstruct:
              this.platformSandboxSharedNetworkStackLegacy.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
                .gateway.legacy.gatewayVpcCidr,
          },
          primary: {
            vpcConstruct:
              this.platformSandboxSharedNetworkStackPrimary.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
                .gateway.primary.gatewayVpcCidr,
          },
          recovery: {
            vpcConstruct:
              this.platformSandboxSharedNetworkStackRecovery
                .gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
                .gateway.recovery.gatewayVpcCidr,
          },
        },
        cvpnCidrs: {
          legacy:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .clientVpn.legacy,
          primary:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .clientVpn.primary,
          recovery:
            DfAccounts.getPlatformSandboxSharedNetworkAccountDef().vpcCidrs
              .clientVpn.recovery,
        },
        masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
        R53Cname: 'roadkill',
        account: DfAccounts.getPlatformSandboxSharedNetworkAccountDef(),
      }
    );
    return this.clientVpnEndpoints;
  }

  /**
   *
   * Singleton constructor for the PlatformSandboxSharedNetwork
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {PlatformSandboxSharedNetworkEnvironment}
   *
   */
  public static getInstance(app: App): PlatformSandboxSharedNetworkEnvironment {
    if (!PlatformSandboxSharedNetworkEnvironment.instance) {
      PlatformSandboxSharedNetworkEnvironment.instance =
        new PlatformSandboxSharedNetworkEnvironment(app);
      PlatformSandboxSharedNetworkEnvironment.instance.deployStacks();
    }

    return PlatformSandboxSharedNetworkEnvironment.instance;
  }

  /**
   * @return {string} - Account ID
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX_SHARED_NETWORK;
  }

  /**
   * @return {string} - Environment name
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'platformSandboxSharedNetwork';
  }

  /**
   * @return {string} - Environment prefix
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'platform-sandbox-shared-network';
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
      --role-arn arn:aws:iam::${PlatformSandboxSharedNetworkEnvironment.ACCOUNT_ID}:role/${PlatformSandboxSharedNetworkEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name RouteAdd \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
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
      environmentName: PlatformSandboxSharedNetworkEnvironment.ENVIRONMENT_NAME,
      s3BackendProps:
        this.platformSandboxSharedNetworkS3BackendProps(regionAlias),
      remoteStateId: 'platform-shared-network',
    };
  }

  /**
   * @return {string}
   */
  public get crossRegionTgwPeeringConfig(): S3BackendConfig {
    return this.crossRegionTgwPeering.s3BackendPropsResource();
  }

  /**
   *
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: PlatformSandboxSharedNetworkEnvironment.ACCOUNT_ID,
      accountName: PlatformSandboxSharedNetworkEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole:
        PlatformSandboxSharedNetworkEnvironment.PROVIDER_ROLE_NAME,
    };
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
        return this.platformSandboxSharedNetworkStackLegacy.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return this.platformSandboxSharedNetworkStackRecovery.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return this.platformSandboxSharedNetworkStackPrimary.s3BackendPropsResource();
    }
  }
}
