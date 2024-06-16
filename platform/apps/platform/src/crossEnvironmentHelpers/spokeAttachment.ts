import { DfSpokeVpcStack, DfToolsVpcStack } from '@dragonfly/stacks';
import { Constants, AccountProviderConfig, DfAccounts } from '@dragonfly/utils';
import { DataTerraformRemoteStateS3, S3BackendConfig } from 'cdktf';
import { NetworkInstanceConfig } from '../environments/abstractSharedNetworkEnvironment';
import { Ec2TransitGatewayVpcAttachment } from '@cdktf/provider-aws/lib/ec2-transit-gateway-vpc-attachment';
import { Route } from '@cdktf/provider-aws/lib/route';
import { Ec2TransitGatewayRouteTableAssociation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-association';
import { Ec2TransitGatewayRouteTablePropagation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-propagation';
import { Ec2TransitGatewayRoute } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

/**
 * Spoke Attachment Configuration options
 * @property {DfSpokeVpcStack | DfToolsVpcStack} spokeVpc - The Spoke VPC instance type to attach to the Shared Network
 * @property {Constants.AWS_REGION_ALIASES} attachmentRegion - The region of the Shared Network to attach to
 * @property {NetworkInstanceConfig} sharedNetworkInstances - The Shared Network Instances
 * @property {AccountProviderConfig} accountProviderConfig - The Account Provider Config of the Shared Network
 * @property {S3BackendConfig} crossRegionTgw - The S3 Backend Config of the Cross Region Transit Gateway Stack in the Shared Network
 * @property {string} envName - The environment name of the Spoke VPC
 * @property {string} primaryIngressCidrBlock - The CIDR Block of the Primary Ingress VPC
 * @property {string} recoveryIngressCidrBlock - The CIDR Block of the Recovery Ingress VPC
 * @property {string} legacyIngressCidrBlock - The CIDR Block of the Legacy Ingress VPC
 * @prop {S3BackendConfig} sharedToolsS3BackendConfig - The S3 Backend Config of the Shared Tools VPC
 * @prop {AccountProviderConfig} toolsAccountProviderConfig - The Account Provider Config of the Shared Tools account
 * @prop {AccountProviderConfig} sharedNetworkAccountProviderConfig - The Account Provider Config of the Shared Network account
 * @property {boolean} nonProd - The Non Prod flag
 */
interface SpokeAttachmentConfig {
  spokeVpc: DfSpokeVpcStack | DfToolsVpcStack;
  attachmentRegion: Constants.AWS_REGION_ALIASES;
  sharedNetworkInstances: {
    [key in Constants.AWS_REGION_ALIASES]?: NetworkInstanceConfig;
  };
  accountProviderConfig: AccountProviderConfig;
  crossRegionTgw: S3BackendConfig;
  envName: string;
  primaryIngressCidrBlock: string;
  recoveryIngressCidrBlock: string;
  legacyIngressCidrBlock: string;
  sharedToolsS3BackendConfig?: {
    [key in Constants.AWS_REGION_ALIASES]?: S3BackendConfig;
  };
  toolsAccountProviderConfig?: AccountProviderConfig;
  // sharedNetworkAccountProviderConfig?: AccountProviderConfig;
  nonProd: boolean;
}

/**
 * * Spoke Attachment
 */
export class SpokeAttachment {
  /**
   *
   * @param {SpokeAttachmentConfig} config
   */
  constructor(config: SpokeAttachmentConfig) {
    const networkType = config.nonProd ? 'non-prod' : 'prod';

    const localNetworkInstance =
      config.sharedNetworkInstances[config.attachmentRegion];

    const remoteStateSharedNetwork = new DataTerraformRemoteStateS3(
      config.spokeVpc,
      `remote-state-${networkType}-spoke-attachment-to-${localNetworkInstance.remoteStateId}`,
      localNetworkInstance.s3BackendProps
    );

    const remoteCrossRegionTgw = new DataTerraformRemoteStateS3(
      config.spokeVpc,
      `remote-state-${networkType}-cross-region-tgw-${config.attachmentRegion}`,
      config.crossRegionTgw
    );

    const sharedNetworkProvider = config.spokeVpc.createAwsProvider({
      supportedRegion: config.attachmentRegion,
      forAccount: config.accountProviderConfig,
    });

    /**
     * * Select the Spoke VPC Subnets to create the TGW Attachment in
     * * Default to the Spoke VPC's Transit Subnets
     */
    let subnetIds = config.spokeVpc.vpcConstruct.transitSubnetIds;
    if (
      /**
       * * If The Spoke VPC is in the tools account, the Non Prod flag is set to true,
       * * And the Spoke VPC instance is a DfToolsVpcStack, use the Non Prod Transit Subnets
       */
      config.spokeVpc.environmentTier === 'tools' &&
      config.nonProd &&
      config.spokeVpc instanceof DfToolsVpcStack
    ) {
      subnetIds = config.spokeVpc.vpcConstruct.nonProdTransitSubnetIds;
    } else if (
      /**
       * * If The Spoke VPC is in the tools account, the Non Prod flag is set to false,
       * * And the Spoke VPC instance is a DfToolsVpcStack, use the Prod Transit Subnets
       */
      config.spokeVpc.environmentTier === 'tools' &&
      !config.nonProd &&
      config.spokeVpc instanceof DfToolsVpcStack
    ) {
      subnetIds = config.spokeVpc.vpcConstruct.prodTransitSubnetIds;
    }

    /**
     * * Create the TGW Attachment for the Spoke VPC
     */
    const spokeVpcAttachment = new Ec2TransitGatewayVpcAttachment(
      config.spokeVpc,
      // * If the env is tools account AND the vpc is being attached to Prod, use the Prod TGW Attachment name | Else use the Non Prod TGW Attachment name
      config.spokeVpc.environmentTier === 'tools' && !config.nonProd
        ? `${localNetworkInstance.remoteStateId}-SpokeVPCHubAttachmentProd`
        : `${localNetworkInstance.remoteStateId}-SpokeVPCHubAttachment`,
      {
        transitGatewayId: remoteStateSharedNetwork.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
        ),
        vpcId: config.spokeVpc.vpcConstruct.vpcId,
        subnetIds: subnetIds,
        tags: {
          Name: `${config.envName}-tgw-spoke-attachment`,
        },
      }
    );

    /**
     * *Route All traffic from Private subnet to TGW using Private route table
     * * If the environment is tools and Non Prod Flag is set to true, route all traffic to the Non Prod TGW in the Non Prod TGW RTB
     * * If tools and Prod, route all to Prod TGW using Prod TGW RTB
     */
    /**
     * * Route default route (0.0.0.0/0) to the TGW in the Spoke VPC's Private Route Table
     */
    if (
      /**
       * * If The Spoke VPC is in the tools account, the Non Prod flag is set to true,
       * * And the Spoke VPC instance is a DfToolsVpcStack, Update the Non Prod Transit Route Table Instead
       */
      config.spokeVpc.environmentTier === 'tools' &&
      config.nonProd &&
      config.spokeVpc instanceof DfToolsVpcStack
    ) {
      new Route(
        config.spokeVpc,
        `${localNetworkInstance.remoteStateId}-defaultRouteNonProdTransitRtb`,
        {
          transitGatewayId: remoteStateSharedNetwork.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
          ),
          routeTableId: config.spokeVpc.vpcConstruct.nonProdTransitRouteTableId,
          destinationCidrBlock: '0.0.0.0/0',
        }
      );
    } else if (
      config.spokeVpc.environmentTier === 'tools' &&
      !config.nonProd &&
      config.spokeVpc instanceof DfToolsVpcStack
    ) {
      /**
       * * If The Spoke VPC is in the tools account, the Non Prod flag is set to false,
       * * And the Spoke VPC instance is a DfToolsVpcStack, Update the Prod Transit Route Table Instead
       */
      new Route(
        config.spokeVpc,
        `${localNetworkInstance.remoteStateId}-defaultRouteProdTransitRtb`,
        {
          transitGatewayId: remoteStateSharedNetwork.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
          ),
          routeTableId: config.spokeVpc.vpcConstruct.prodTransitRouteTableId,
          destinationCidrBlock: '0.0.0.0/0',
        }
      );

      // * Tools to egress all internet traffic through the prod TGW
      new Route(
        config.spokeVpc,
        `${localNetworkInstance.remoteStateId}-defaultRoutePrivateRtb`,
        {
          transitGatewayId: remoteStateSharedNetwork.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
          ),
          routeTableId: config.spokeVpc.vpcConstruct.privateRouteTableId,
          destinationCidrBlock: '0.0.0.0/0',
        }
      );
    } else {
      // * Update the Spoke VPC's Private Route Table
      new Route(
        config.spokeVpc,
        config.nonProd
          ? `${localNetworkInstance.remoteStateId}-PrivateSubnetDefaultRoute`
          : `${localNetworkInstance.remoteStateId}-PrivateSubnetDefaultRouteProd`,
        {
          transitGatewayId: remoteStateSharedNetwork.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
          ),
          routeTableId: config.spokeVpc.vpcConstruct.privateRouteTableId,
          destinationCidrBlock: '0.0.0.0/0',
        }
      );
    }

    /**
     * * If the Vpc to attach is tools, add routes to the private route table for all 3 ingress and inspection vpc cidr blocks across the 3 regions
     * * To the TGW. This is to allow return traffic from the Tools VPC to the Non Prod and Prod Shared Network VPCs
     */
    if (config.spokeVpc.environmentTier === 'tools') {
      const sharedNetworkVpcCidrs = config.nonProd
        ? [
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .legacy.gatewayVpcCidr,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .primary.gatewayVpcCidr,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.inspection
              .legacy,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.inspection
              .primary,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.inspection
              .recovery,
          ]
        : [
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
              .gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
              .gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.inspection
              .legacy,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.inspection
              .primary,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.inspection
              .recovery,
          ];

      sharedNetworkVpcCidrs.forEach((ingressVpcCidr, index) => {
        new Route(
          config.spokeVpc,
          config.nonProd
            ? `${localNetworkInstance.remoteStateId}-ToolsNonProdTransitRoute${index}`
            : `${localNetworkInstance.remoteStateId}-ToolsProdTransitRoute${index}`,
          {
            transitGatewayId: remoteStateSharedNetwork.getString(
              Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
            ),
            routeTableId: config.spokeVpc.vpcConstruct.privateRouteTableId,
            destinationCidrBlock: ingressVpcCidr,
          }
        );
      });
    }

    // * Associate Spoke Attachment with Spoke Traffic TGW Route Table
    new Ec2TransitGatewayRouteTableAssociation(
      config.spokeVpc,
      config.nonProd
        ? `${localNetworkInstance.remoteStateId}-preInspectionRTAssociationToSpokeVPCAttach`
        : `${localNetworkInstance.remoteStateId}-preInspectionRTAssociationToSpokeVPCAttachProd`,
      {
        provider: sharedNetworkProvider,
        transitGatewayAttachmentId: spokeVpcAttachment.id,
        transitGatewayRouteTableId: remoteStateSharedNetwork.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_SPOKE_TRAFFIC_TGW_ROUTE_TABLE_ID
        ),
      }
    );

    /**
     * * Propagate Spoke CIDR in Post Inspection TGW Route Table
     * * To tell our Inspection VPC TGW Attachment where to send traffic
     */
    new Ec2TransitGatewayRouteTablePropagation(
      config.spokeVpc,
      config.nonProd
        ? `${localNetworkInstance.remoteStateId}-SpokeVPCPropagation`
        : `${localNetworkInstance.remoteStateId}-SpokeVPCPropagationProd`,
      {
        provider: sharedNetworkProvider,
        transitGatewayAttachmentId: spokeVpcAttachment.id,
        transitGatewayRouteTableId: remoteStateSharedNetwork.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_POST_INSPECTION_TRAFFIC_ROUTE_TABLE_ID
        ),
      }
    );

    /**
     * * Update Tool's VPC Private Route Table to send traffic to Spoke VPC using the correct TGW
     */
    /**
     * * If the Spoke VPC we're attaching to the Shared Network isn't tools, add a route in the Tools VPC's Private Route Table
     * * For the Spoke VPC CIDR we're attaching to either the Non Prod or Prod TGW
     */
    if (config.spokeVpc.environmentName != 'tools') {
      const supportedRegions = [
        Constants.AWS_REGION_ALIASES.LEGACY,
        Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      ];

      const toolsProviders: AwsProvider[] = [];
      const toolsRouteTableIds = [];
      const tgwIds = [];

      supportedRegions.forEach((region) => {
        const provider = config.spokeVpc.createAwsProvider({
          supportedRegion: region,
          forAccount: config.toolsAccountProviderConfig,
        });
        toolsProviders.push(provider);

        const networkInstance = config.sharedNetworkInstances[region];

        const toolsInstance = config.sharedToolsS3BackendConfig[region];

        const toolsRemoteState = new DataTerraformRemoteStateS3(
          config.spokeVpc,
          `remote-state-tools-${networkType}-tgw-vpc-rtb-${region}`,
          toolsInstance
        );
        const remoteState = new DataTerraformRemoteStateS3(
          config.spokeVpc,
          `remote-state-${networkType}-tgw-vpc-rtb-${region}`,
          networkInstance.s3BackendProps
        );

        const toolsRouteTableId = toolsRemoteState.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_TOOLS_VPC_PRIVATE_RTB_ID
        );
        toolsRouteTableIds.push(toolsRouteTableId);

        const nonProdTgwId = remoteState.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID
        );
        tgwIds.push(nonProdTgwId);
      });

      if (
        config.spokeVpc.environmentName !=
        DfAccounts.getPlatformSandboxAccountDef().name
      )
        toolsProviders.forEach((provider, index) => {
          new Route(
            config.spokeVpc,
            config.nonProd
              ? `${localNetworkInstance.remoteStateId}-ToolsNonProdTransitRoute-${supportedRegions[index]}`
              : `${localNetworkInstance.remoteStateId}-ToolsProdTransitRoute-${supportedRegions[index]}`,
            {
              provider: provider,
              transitGatewayId: tgwIds[index],
              routeTableId: toolsRouteTableIds[index],
              destinationCidrBlock: config.spokeVpc.cidr,
            }
          );
        });
    }

    /**
     * * Cross Region Transit Gateway Routing
     */
    const sharedNetworkProviderLegacy = config.spokeVpc.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.LEGACY,
      forAccount: config.accountProviderConfig,
    });

    const sharedNetworkProviderPrimary = config.spokeVpc.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      forAccount: config.accountProviderConfig,
    });

    const sharedNetworkProviderRecovery = config.spokeVpc.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      forAccount: config.accountProviderConfig,
    });

    let crossRegionalMap;
    let resourceSuffix;
    if (config.attachmentRegion === Constants.AWS_REGION_ALIASES.DF_PRIMARY) {
      // * If Spoke VPC deploy to Primary Region, add Spoke CIDR to the Post Inspection TGW Route Table in the legacy and recovery regions
      //* UAT and Prod won't have a Spoke VPC in the legacy region

      const legacyRemoteStateSharedNetwork = new DataTerraformRemoteStateS3(
        config.spokeVpc,
        `remote-state-${networkType}-legacy-tgw-peering-attachment`,
        config.sharedNetworkInstances.LEGACY.s3BackendProps
      );

      const recoveryRemoteStateSharedNetwork = new DataTerraformRemoteStateS3(
        config.spokeVpc,
        `remote-state-${networkType}-recovery-tgw-peering-attachment`,
        config.sharedNetworkInstances.DFRECOVERY.s3BackendProps
      );

      crossRegionalMap = [
        {
          provider: sharedNetworkProviderRecovery,
          remoteStateSharedNetwork: recoveryRemoteStateSharedNetwork,
          tgwAttachmentId: remoteCrossRegionTgw.getString(
            Constants.CROSS_STACK_OUTPUT_RECOVERY_TO_PRIMARY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID
          ),
          ingressCidrBlock: config.recoveryIngressCidrBlock,
        },
        {
          provider: sharedNetworkProviderLegacy,
          remoteStateSharedNetwork: legacyRemoteStateSharedNetwork,
          tgwAttachmentId: remoteCrossRegionTgw.getString(
            Constants.CROSS_STACK_OUTPUT_PRIMARY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID
          ),
          ingressCidrBlock: config.legacyIngressCidrBlock,
        },
      ];
      resourceSuffix = 'Primary';
    } else if (
      config.attachmentRegion === Constants.AWS_REGION_ALIASES.DF_RECOVERY
    ) {
      // * Add Spoke CIDR to the Post Inspection TGW Route Table in the primary and legacy regions
      // * UAT and Prod won't have a Spoke VPC in the legacy region
      const legacyRemoteStateSharedNetwork = new DataTerraformRemoteStateS3(
        config.spokeVpc,
        `remote-state-${networkType}-legacy-tgw-peering-attachment`,
        config.sharedNetworkInstances.LEGACY.s3BackendProps
      );

      const primaryRemoteStateSharedNetwork = new DataTerraformRemoteStateS3(
        config.spokeVpc,
        `remote-state-${networkType}-primary-tgw-peering-attachment`,
        config.sharedNetworkInstances.DFPRIMARY.s3BackendProps
      );
      crossRegionalMap = [
        {
          provider: sharedNetworkProviderPrimary,
          remoteStateSharedNetwork: primaryRemoteStateSharedNetwork,
          tgwAttachmentId: remoteCrossRegionTgw.getString(
            Constants.CROSS_STACK_OUTPUT_RECOVERY_TO_PRIMARY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID
          ),
          ingressCidrBlock: config.primaryIngressCidrBlock,
        },
        {
          provider: sharedNetworkProviderLegacy,
          remoteStateSharedNetwork: legacyRemoteStateSharedNetwork,
          tgwAttachmentId: remoteCrossRegionTgw.getString(
            Constants.CROSS_STACK_OUTPUT_RECOVERY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID
          ),
          ingressCidrBlock: config.legacyIngressCidrBlock,
        },
      ];
      resourceSuffix = 'Recovery';
    } else if (
      config.attachmentRegion === Constants.AWS_REGION_ALIASES.LEGACY
    ) {
      // Add Spoke CIDR to the Post Inspection TGW Route Table in the primary and recovery regions
      const primaryRemoteStateSharedNetwork = new DataTerraformRemoteStateS3(
        config.spokeVpc,
        `remote-state-${networkType}-primary-tgw-peering-attachment`,
        config.sharedNetworkInstances.DFPRIMARY.s3BackendProps
      );
      const recoveryRemoteStateSharedNetwork = new DataTerraformRemoteStateS3(
        config.spokeVpc,
        `remote-state-${networkType}-recovery-tgw-peering-attachment`,
        config.sharedNetworkInstances.DFRECOVERY.s3BackendProps
      );

      crossRegionalMap = [
        {
          provider: sharedNetworkProviderPrimary,
          remoteStateSharedNetwork: primaryRemoteStateSharedNetwork,
          tgwAttachmentId: remoteCrossRegionTgw.getString(
            Constants.CROSS_STACK_OUTPUT_PRIMARY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID
          ),
          ingressCidrBlock: config.primaryIngressCidrBlock,
        },
        {
          provider: sharedNetworkProviderRecovery,
          remoteStateSharedNetwork: recoveryRemoteStateSharedNetwork,
          tgwAttachmentId: remoteCrossRegionTgw.getString(
            Constants.CROSS_STACK_OUTPUT_RECOVERY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID
          ),
          ingressCidrBlock: config.recoveryIngressCidrBlock,
        },
      ];
      resourceSuffix = 'Legacy';
    }

    crossRegionalMap.forEach((obj, index) => {
      new Ec2TransitGatewayRoute(
        config.spokeVpc,
        config.nonProd
          ? `NonProdSpokeVPCRouteToTgwPeering${resourceSuffix}${index}`
          : !config.nonProd
          ? `ProdSpokeVPCRouteToTgwPeering${resourceSuffix}${index}`
          : `SpokeVPCRouteToTgwPeering${resourceSuffix}${index}`,
        {
          provider: obj.provider,
          transitGatewayRouteTableId: obj.remoteStateSharedNetwork.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_POST_INSPECTION_TRAFFIC_ROUTE_TABLE_ID
          ),
          destinationCidrBlock: config.spokeVpc.cidr,
          transitGatewayAttachmentId: obj.tgwAttachmentId,
        }
      );
    });
  }
}
