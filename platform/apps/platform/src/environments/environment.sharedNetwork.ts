import {
  DfAcmStack,
  DfBuildAutomationRoleStack,
  DfPrismaCloudIntegrationStack,
  DfVantaIntegrationStack,
  DfSharedNetworkStack,
  DfClientVpnStack,
  DfSharedNetworkResolver,
  DfSiteToSiteVpnStack,
  DfCustomerConfigs,
  SydneyWestPacStack,
  // DfNewRelicStack,
  DfProductionClientVpnStack,
  DfCrossRegionTgwPeeringStack,
  DfDirectConnect,
} from '@dragonfly/stacks';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import { App, S3BackendConfig, TerraformStack } from 'cdktf';
import MasterEnvironment from './environment.master';
import {
  AbstractSharedNetworkEnvironment,
  NetworkInstanceConfig,
} from './abstractSharedNetworkEnvironment';
import { DfGatewayVpcConstruct } from '@dragonfly/constructs';
import { PhzAttachment } from '../crossEnvironmentHelpers/phzAssociation';

/** SharedNetworkEnvironment */
export default class SharedNetworkEnvironment extends AbstractSharedNetworkEnvironment {
  private static instance: SharedNetworkEnvironment;
  private crossRegionTgwPeering: DfCrossRegionTgwPeeringStack;
  // * Prod Shared Network
  private prodSharedNetworkStackLegacy: DfSharedNetworkStack;
  private prodSharedNetworkStackPrimary: DfSharedNetworkStack;
  private prodSharedNetworkStackRecovery: DfSharedNetworkStack;
  private prodClientVpnEndpoints: DfClientVpnStack;
  private prodCrossRegionTgwPeering: DfCrossRegionTgwPeeringStack;

  /**
   * @return {[]}
   */
  protected createStacks(): TerraformStack[] {
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    // This deploys the prod sharedNetwork VPCs
    this.createSharedNetworks();
    this.createVpnEndpoints();
    this.createCrossRegionTgwPeer();

    // TODO: Unsure if this can be nuked
    new DfAcmStack('IngressAcm', this.stackConfig, {
      domainName: 'app.dragonflyft.com',
      subjectAlternativeNames: [
        '*.app.dragonflyft.com',
        '*.qe.dragonflyft.com',
        '*.ist.dragonflyft.com',
        '*.uat.dragonflyft.com',
      ],
      masterProviderAccountConfig: MasterEnvironment.accountProviderConfig,
    });

    new DfVantaIntegrationStack('Vanta', this.stackConfig);

    this.createSharedNetworkResolvers('prod-cvpn-resolver', {
      legacy: this.prodSharedNetworkStackLegacy.gatewayVpcConstruct,
      primary: this.prodSharedNetworkStackPrimary.gatewayVpcConstruct,
      recovery: this.prodSharedNetworkStackRecovery.gatewayVpcConstruct,
    });

    this.createSiteToSiteConnection();

    new SydneyWestPacStack('sydney-westpac', this.stackConfig);

    // new DfNewRelicStack('new-relic', this.stackConfig);

    new DfDirectConnect({
      stackId: 'dft-direct-connect',
      stackConfig: this.stackConfig,
      sharedNetworkInstances: {
        legacy: this.prodSharedNetworkStackLegacy,
        primary: this.prodSharedNetworkStackPrimary,
        recovery: this.prodSharedNetworkStackRecovery,
      },
      proxyLegacyRegion: {
        failOver: false,
        crossRegionTgwPeeringStack: this.prodCrossRegionTgwPeering,
      },
    });

    return this.handler;
  }

  /**
   *
   */
  private createSharedNetworks(): void {
    this.prodSharedNetworkStackLegacy = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.PROD_LEGACY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.inspection
              .legacy,
          gatewayVpcCidrs:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy,
        },
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        nonProd: false,
        inspectionRoleAssumption: SharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getProdSharedNetworkAccountDef(),
        bypassInspection: true, // TODO: Update this to false once we deploy PROD SHAREDNETWORK changes and have PAs deployed in the legacy region to forward traffic to in the inspection vpc,
        paloAlto: {
          deploy: true,
          paR53Records: ['dft-pa-legacy-01', 'dft-pa-legacy-02']
        },
        externalCustomers: DfAccounts.getExternalCustomers(),
        deployHybridNetworking: false,
      }
    );

    this.prodSharedNetworkStackPrimary = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.PROD_PRIMARY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.inspection
              .primary,
          gatewayVpcCidrs:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .primary,
        },
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        nonProd: false,
        inspectionRoleAssumption: SharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getProdSharedNetworkAccountDef(),
        bypassInspection: false, // TODO: Update this to false once we deploy PROD SHAREDNETWORK changes and have PAs deployed in the primary region to forward traffic to in the inspection vpc
        paloAlto: {
          deploy: true,
          paR53Records: ['dft-pa-primary-01', 'dft-pa-primary-02']
        },
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'PRIMARY',
        deployHybridNetworking: true,
      }
    );

    this.prodSharedNetworkStackRecovery = new DfSharedNetworkStack(
      this.stackConfig,
      Constants.PROD_RECOVERY_SHARED_NETWORK_STACK_ID,
      {
        cidrBlocks: {
          inspection:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.inspection
              .recovery,
          gatewayVpcCidrs:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery,
        },
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        tgwAsn: 64522,
        nonProd: false,
        inspectionRoleAssumption: SharedNetworkEnvironment.awsCliRoleAssumption,
        account: DfAccounts.getProdSharedNetworkAccountDef(),
        bypassInspection: true, // TODO: Update this to false once we deploy PROD SHAREDNETWORK changes and have PAs deployed in the recovery region to forward traffic to in the inspection vpc
        paloAlto: {
          deploy: true,
          paR53Records: ['dft-pa-recovery-01', 'dft-pa-recovery-02']
        },
        externalCustomers: DfAccounts.getExternalCustomers(),
        networkSuffix: 'RECOVERY',
        deployHybridNetworking: true,
      }
    );

    // * Have to explicitly create the PHZ attachments for the prod sharedNetwork VPCs
    new PhzAttachment({
      requestingStack: this.prodSharedNetworkStackLegacy,
      vpcId: this.prodSharedNetworkStackLegacy.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.prodSharedNetworkStackPrimary,
      vpcId: this.prodSharedNetworkStackPrimary.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new PhzAttachment({
      requestingStack: this.prodSharedNetworkStackRecovery,
      vpcId: this.prodSharedNetworkStackRecovery.gatewayVpcConstruct.vpcId,
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * @return {DfClientVpnStack} - The client vpn stack
   */
  private createVpnEndpoints(): DfClientVpnStack {
    this.prodClientVpnEndpoints = new DfProductionClientVpnStack(
      'client-vpn',
      this.stackConfig,
      {
        gatewayVpcs: {
          legacy: {
            vpcConstruct: this.prodSharedNetworkStackLegacy.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .legacy.gatewayVpcCidr,
          },
          primary: {
            vpcConstruct:
              this.prodSharedNetworkStackPrimary.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .primary.gatewayVpcCidr,
          },
          recovery: {
            vpcConstruct:
              this.prodSharedNetworkStackRecovery.gatewayVpcConstruct,
            vpcCidrBlock:
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .recovery.gatewayVpcCidr,
          },
        },
        cvpnCidrs: {
          legacy:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.clientVpn
              .legacy,
          primary:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.clientVpn
              .primary,
          recovery:
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.clientVpn
              .recovery,
        },
        masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
        R53Cname: 'vpn',
        account: DfAccounts.getProdSharedNetworkAccountDef(),
      }
    );
    return this.prodClientVpnEndpoints;
  }

  /**
   *
   */
  private createCrossRegionTgwPeer(): void {
    this.prodCrossRegionTgwPeering = new DfCrossRegionTgwPeeringStack(
      'ProdCrossRegionTgwPeering',
      this.stackConfig,
      {
        legacySharedNetworkTransitGateway:
          this.prodSharedNetworkStackLegacy.tgwConstruct,
        primarySharedNetworkTransitGateway:
          this.prodSharedNetworkStackPrimary.tgwConstruct,
        recoverySharedNetworkTransitGateway:
          this.prodSharedNetworkStackRecovery.tgwConstruct,
        account: DfAccounts.getProdSharedNetworkAccountDef(),
        peerGatewayVpcs: true,
      }
    );
  }

  /**
   * @description Creates the shared network resolver
   * @param {string} stackName - The stack name
   * @param {DfSharedNetworkStack} config - The shared network stack
   */
  private createSharedNetworkResolvers(
    stackName: string,
    config: {
      legacy: DfGatewayVpcConstruct;
      primary: DfGatewayVpcConstruct;
      recovery: DfGatewayVpcConstruct;
    }
  ): void {
    new DfSharedNetworkResolver(stackName, this.stackConfig, {
      vpcs: {
        legacy: config.legacy,
        primary: config.primary,
        recovery: config.recovery,
      },
    });
  }

  /**
   * Creates the VPN Gateway, customer gateways, and site to site VPN connections
   */
  private createSiteToSiteConnection(): void {
    // Deploy primary region resources
    new DfSiteToSiteVpnStack('site-to-site-vpn-primary', this.stackConfig, {
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      sharedNetworkInstance: this.prodSharedNetworkStackPrimary,
      customerConfigs: DfCustomerConfigs.primaryProdConfiguration,
      phzId: this.prodSharedNetworkStackPrimary.getPhzId(),
      proxyLegacyRegion: {
        enabled: true,
        crossRegionPeeringStack: this.prodCrossRegionTgwPeering,
        legacySharedNetworkInstance: this.prodSharedNetworkStackLegacy,
      },
    });

    new DfSiteToSiteVpnStack('site-to-site-vpn-recovery', this.stackConfig, {
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      sharedNetworkInstance: this.prodSharedNetworkStackRecovery,
      customerConfigs: DfCustomerConfigs.recoveryProdConfiguration,
      phzId: this.prodSharedNetworkStackRecovery.getPhzId(),
      proxyLegacyRegion: {
        enabled: false,
      },
    });
  }

  /**
   *
   * Singleton constructor for the SharedNetwork
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {SharedNetworkEnvironment}
   *
   */
  public static getInstance(app: App): SharedNetworkEnvironment {
    if (!SharedNetworkEnvironment.instance) {
      SharedNetworkEnvironment.instance = new SharedNetworkEnvironment(app);
      SharedNetworkEnvironment.instance.deployStacks();
    }

    return SharedNetworkEnvironment.instance;
  }

  /**
   * @return {string} - Account ID
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_SHARED_NETWORK;
  }

  /**
   * @return {string} - Environment name
   */
  public static get ENVIRONMENT_NAME(): string {
    return Constants.ENVIRONMENT_NAME_SHARED_NETWORK;
  }

  /**
   * @return {string} - Environment name
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'shared-network';
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
      --role-arn arn:aws:iam::${SharedNetworkEnvironment.ACCOUNT_ID}:role/${SharedNetworkEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name RouteAdd \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} regionAlias - The region alias
   * @return {S3BackendConfig} - Returns the s3BackendProps used in the sharedNetworkStack
   */
  public prodSharedNetworkS3BackendProps(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): S3BackendConfig {
    switch (regionAlias) {
      case Constants.AWS_REGION_ALIASES.LEGACY:
        return this.prodSharedNetworkStackLegacy.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return this.prodSharedNetworkStackPrimary.s3BackendPropsResource();
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return this.prodSharedNetworkStackRecovery.s3BackendPropsResource();
    }
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} regionAlias - The region alias
   * @return {DfGatewayVpcConstruct} - Returns the gatewayVpcConstruct used in the sharedNetworkStack
   */
  public prodSharedNetworkGatewayVpcConstructs(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): DfGatewayVpcConstruct {
    switch (regionAlias) {
      case Constants.AWS_REGION_ALIASES.LEGACY:
        return this.prodSharedNetworkStackLegacy.gatewayVpcConstruct;
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return this.prodSharedNetworkStackPrimary.gatewayVpcConstruct;
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return this.prodSharedNetworkStackRecovery.gatewayVpcConstruct;
    }
  }

  /**
   *
   * @param {Constants.AWS_REGION_ALIASES} regionAlias
   * @return {NetworkInstanceConfig}
   */
  public static regionalNetworkConfig(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): NetworkInstanceConfig {
    return {
      environmentName: SharedNetworkEnvironment.ENVIRONMENT_NAME,
      s3BackendProps: Utils.getNetworkS3BackendProps(
        regionAlias,
        'prod',
        SharedNetworkEnvironment.ENVIRONMENT_NAME
      ),
      // s3BackendProps: this.prodSharedNetworkS3BackendProps(regionAlias),
      remoteStateId: 'shared-network',
    };
  }

  /**
   *
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: SharedNetworkEnvironment.ACCOUNT_ID,
      accountName: SharedNetworkEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: SharedNetworkEnvironment.PROVIDER_ROLE_NAME,
    };
  }

  /**
   * @return {string}
   */
  public get CrossRegionTgwPeeringConfig(): S3BackendConfig {
    return this.crossRegionTgwPeering.s3BackendPropsResource();
  }

  /**
   * @return {string}
   */
  public get prodCrossRegionTgwPeeringConfig(): S3BackendConfig {
    return this.prodCrossRegionTgwPeering.s3BackendPropsResource();
  }

  /**
   * @return {DfGatewayVpcConstruct}
   */
  public get primaryNetwork(): DfGatewayVpcConstruct {
    return this.prodSharedNetworkStackPrimary.gatewayVpcConstruct;
  }
}
