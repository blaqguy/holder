import { Ec2TransitGatewayPeeringAttachment } from '@cdktf/provider-aws/lib/ec2-transit-gateway-peering-attachment';
import { Ec2TransitGatewayPeeringAttachmentAccepter } from '@cdktf/provider-aws/lib/ec2-transit-gateway-peering-attachment-accepter';
import { Ec2TransitGatewayRoute } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route';
import { Ec2TransitGatewayRouteTable } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table';
import { Ec2TransitGatewayRouteTableAssociation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-association';
import { DfSharedTransitGatewayConstruct } from '@dragonfly/constructs';
import { AccountDefinition, Constants } from '@dragonfly/utils';
import { TerraformOutput } from 'cdktf';
import { RemoteStack, StackConfig } from '../stacks';

/**
 * Represents configuration options for creating a cross region TGW peering connection.
 * @property {sharedNetwork} legacySharedNetwork - An instance of the Legacy Shared Network.
 * @property {sharedNetwork} primarySharedNetworkTransitGateway - An instance of the Primary Shared Network.
 * @property {sharedNetwork} recoverySharedNetwork - An instance of the Recovery Shared Network.
 * @property {AccountDefinition} account - The account definition of the target account.
 * @property {boolean} [peerGatewayVpcs] - Whether or not to peer the gateway VPCs.
 */
interface CrossRegionTgwPeeringConfig {
  /**
   * An instance of the Legacy Shared Network.
   */
  legacySharedNetworkTransitGateway: DfSharedTransitGatewayConstruct;
  /**
   * An instance of the Primary Shared Network.
   */
  primarySharedNetworkTransitGateway: DfSharedTransitGatewayConstruct;
  /**
   * An instance of the Recovery Shared Network.
   */
  recoverySharedNetworkTransitGateway: DfSharedTransitGatewayConstruct;
  /**
   * The account definition of the target account.
   */
  account: AccountDefinition;
  /**
   * Whether or not to peer the gateway VPCs.
   */
  peerGatewayVpcs?: boolean;
}

/**
 * This stack is used to create a peering connection between two TGWs in different regions.
 */
export class DfCrossRegionTgwPeeringStack extends RemoteStack {
  public readonly primaryTgwPeerToRecoveryRequester: Ec2TransitGatewayPeeringAttachment;
  public readonly recoveryTgwPeerToPrimaryAccepter: Ec2TransitGatewayPeeringAttachmentAccepter;

  public readonly legacyTgwPeerToPrimaryRequester: Ec2TransitGatewayPeeringAttachment;
  public readonly primaryTgwPeerToLegacyAccepter: Ec2TransitGatewayPeeringAttachmentAccepter;

  public readonly legacyTgwPeerToRecoveryRequester: Ec2TransitGatewayPeeringAttachment;
  public readonly recoveryTgwPeerToLegacyAccepter: Ec2TransitGatewayPeeringAttachmentAccepter;
  /**
   * @param {string} stackId - The ID of the stack.
   * @param {StackConfig} StackConfig - The stack configuration.
   * @param {CrossRegionTgwPeeringConfig} crossRegionTgwPeeringConfig - The cross region TGW peering configuration.
   */
  constructor(
    stackId: string,
    StackConfig: StackConfig,
    crossRegionTgwPeeringConfig: CrossRegionTgwPeeringConfig
  ) {
    super(stackId, StackConfig);

    const providers = [null, this.primaryProvider, this.recoveryProvider];

    const routeTableIds = [];

    /**
     * * Creates the Cross Region TGW RT in each DFT Region
     */
    providers.forEach((provider, index) => {
      const routeTable = new Ec2TransitGatewayRouteTable(
        this,
        `route-table${index}`,
        {
          provider: provider,
          transitGatewayId:
            provider === this.primaryProvider
              ? crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
                  .transitGateway.id
              : provider === this.recoveryProvider
              ? crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
                  .transitGateway.id
              : crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
                  .transitGateway.id,
          tags: {
            Name: 'cross-region',
            Production: 'true',
          },
        }
      );
      routeTableIds.push(routeTable.id);
    });

    /**
     * * Primary to Recovery TGW Peering
     * * Primary Region TGW creates a peering request to Recovery Region TGW
     * * Recovery Region TGW accepts the peering request from Primary Region TGW
     */
    this.primaryTgwPeerToRecoveryRequester =
      new Ec2TransitGatewayPeeringAttachment(
        this,
        'primary-cross-region-tgw-attachment',
        {
          provider: this.primaryProvider,
          peerRegion: Constants.AWS_REGION_MAP.DFRECOVERY,
          peerTransitGatewayId:
            crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
              .transitGateway.id,
          transitGatewayId:
            crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
              .transitGateway.id,
          tags: {
            Name: `${Constants.AWS_REGION_MAP.DFRECOVERY}-peering`,
            Production: 'true',
          },
        }
      );

    this.recoveryTgwPeerToPrimaryAccepter =
      new Ec2TransitGatewayPeeringAttachmentAccepter(
        this,
        'recovery-cross-region-tgw-attachment-accepter',
        {
          provider: this.recoveryProvider,
          transitGatewayAttachmentId: this.primaryTgwPeerToRecoveryRequester.id,
          tags: {
            Name: `${Constants.AWS_REGION_MAP.DFRECOVERY}-peering`,
            Production: 'true',
          },
        }
      );

    /**
     * * Only create an output for the accepter attachment
     * * This is because the accepter attachment and the requester attachment have the same ID
     */
    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_RECOVERY_TO_PRIMARY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID,
      {
        value: this.recoveryTgwPeerToPrimaryAccepter.id,
      }
    );

    /**
     * * Legacy to Primary TGW Peering
     * * Legacy Region TGW creates a peering request to Primary Region TGW
     * * Primary Region TGW accepts the peering request from Legacy Region TGW
     */
    this.legacyTgwPeerToPrimaryRequester =
      new Ec2TransitGatewayPeeringAttachment(
        this,
        'legacy-cross-region-tgw-attachment',
        {
          transitGatewayId:
            crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
              .transitGateway.id,
          peerRegion: Constants.AWS_REGION_MAP.DFPRIMARY,
          peerTransitGatewayId:
            crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
              .transitGateway.id,
          tags: {
            Name: `${Constants.AWS_REGION_MAP.DFPRIMARY}-peering`,
            Production: 'true',
          },
        }
      );

    this.primaryTgwPeerToLegacyAccepter =
      new Ec2TransitGatewayPeeringAttachmentAccepter(
        this,
        'primary-cross-region-tgw-attachment-accepter',
        {
          provider: this.primaryProvider,
          transitGatewayAttachmentId: this.legacyTgwPeerToPrimaryRequester.id,
          tags: {
            Name: `${Constants.AWS_REGION_MAP.LEGACY}-peering`,
            Production: 'true',
          },
        }
      );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_PRIMARY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID,
      {
        value: this.primaryTgwPeerToLegacyAccepter.id,
      }
    );

    /**
     * * Legacy to Recovery TGW Peering
     * * Legacy Region TGW creates a peering request to Recovery Region TGW
     * * Recovery Region TGW accepts the peering request from Legacy Region TGW
     */
    this.legacyTgwPeerToRecoveryRequester =
      new Ec2TransitGatewayPeeringAttachment(
        this,
        'legacy-cross-region-tgw-attachment-2',
        {
          transitGatewayId:
            crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
              .transitGateway.id,
          peerRegion: Constants.AWS_REGION_MAP.DFRECOVERY,
          peerTransitGatewayId:
            crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
              .transitGateway.id,
          tags: {
            Name: `${Constants.AWS_REGION_MAP.DFRECOVERY}-peering`,
            Production: 'true',
          },
        }
      );

    this.recoveryTgwPeerToLegacyAccepter =
      new Ec2TransitGatewayPeeringAttachmentAccepter(
        this,
        'recovery-cross-region-tgw-attachment-accepter-2',
        {
          provider: this.recoveryProvider,
          transitGatewayAttachmentId: this.legacyTgwPeerToRecoveryRequester.id,
          tags: {
            Name: `${Constants.AWS_REGION_MAP.LEGACY}-peering`,
            Production: 'true',
          },
        }
      );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_RECOVERY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID,
      {
        value: this.recoveryTgwPeerToLegacyAccepter.id,
      }
    );

    /**
     * * Associate Legacy Region's TGW Peering Attachments to the Cross Region TGW Route Table
     * * In the Legacy Region
     */
    const legacyAttachments = [
      this.legacyTgwPeerToPrimaryRequester,
      this.legacyTgwPeerToRecoveryRequester,
    ];
    legacyAttachments.forEach((attachment, index) => {
      new Ec2TransitGatewayRouteTableAssociation(
        this,
        `legacy-route-table-association${index}`,
        {
          transitGatewayAttachmentId: attachment.id,
          transitGatewayRouteTableId: routeTableIds[0],
        }
      );
    });

    /**
     * * Associate Primary Region's TGW Peering Attachments to the Cross Region TGW Route Table
     * * In the Primary Region
     */
    const primaryAttachments = [
      this.primaryTgwPeerToRecoveryRequester,
      this.primaryTgwPeerToLegacyAccepter,
    ];
    primaryAttachments.forEach((attachment, index) => {
      new Ec2TransitGatewayRouteTableAssociation(
        this,
        `primary-route-table-association${index}`,
        {
          provider: this.primaryProvider,
          transitGatewayAttachmentId: attachment.id,
          transitGatewayRouteTableId: routeTableIds[1],
        }
      );
    });

    /**
     * * Associate Recovery Region's TGW Peering Attachments to the Cross Region TGW Route Table
     * * In the Recovery Region
     */
    const recoveryAttachments = [
      this.recoveryTgwPeerToPrimaryAccepter,
      this.recoveryTgwPeerToLegacyAccepter,
    ];
    recoveryAttachments.forEach((attachment, index) => {
      new Ec2TransitGatewayRouteTableAssociation(
        this,
        `recovery-route-table-association${index}`,
        {
          provider: this.recoveryProvider,
          transitGatewayAttachmentId: attachment.id,
          transitGatewayRouteTableId: routeTableIds[2],
        }
      );
    });

    /**
     * * Add a static route to the Cross Region TGW Route Table
     * * To route all traffic in a given region to the Inspection VPC's TGW attachment in that region
     */
    new Ec2TransitGatewayRoute(this, 'legacy-cross-region-tgw-route', {
      transitGatewayRouteTableId: routeTableIds[0],
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayAttachmentId:
        crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
          .inspectionTransitGatewayAttachment.id,
    });

    new Ec2TransitGatewayRoute(this, 'primary-cross-region-tgw-route', {
      provider: this.primaryProvider,
      transitGatewayRouteTableId: routeTableIds[1],
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayAttachmentId:
        crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
          .inspectionTransitGatewayAttachment.id,
    });

    new Ec2TransitGatewayRoute(this, 'recovery-cross-region-tgw-route', {
      provider: this.recoveryProvider,
      transitGatewayRouteTableId: routeTableIds[2],
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayAttachmentId:
        crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
          .inspectionTransitGatewayAttachment.id,
    });

    /**
     * * Add a static route to the Post Inspection TGW Route Table
     * * To route the secondary and tertiary regions' Ingress and Inspection VPCs' traffic to the correct Peering TGW Attachment
     */
    /**
     * * Primary Region's Ingress VPC Cross Region routes
     * * If the peerGatewayVpcs flag is set to true, the destination CIDR block will be those of the gateway VPCs
     */
    new Ec2TransitGatewayRoute(
      this,
      'primary-cross-region-tgw-route-recovery',
      {
        provider: this.primaryProvider,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.gateway.recovery
            .gatewayVpcCidr,
        transitGatewayAttachmentId: this.recoveryTgwPeerToPrimaryAccepter.id,
      }
    );
    new Ec2TransitGatewayRoute(this, 'primary-cross-region-tgw-route-legacy', {
      provider: this.primaryProvider,
      transitGatewayRouteTableId:
        crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
          .postInspectionTrafficTransitGatewayRouteTable.id,
      destinationCidrBlock:
        crossRegionTgwPeeringConfig.account.vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      transitGatewayAttachmentId: this.primaryTgwPeerToLegacyAccepter.id,
    });

    // * Primary Region's Inspection VPC Cross Region routes
    new Ec2TransitGatewayRoute(
      this,
      'primary-cross-region-tgw-route-recovery-inspection',
      {
        provider: this.primaryProvider,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.inspection.recovery,
        transitGatewayAttachmentId: this.recoveryTgwPeerToPrimaryAccepter.id,
      }
    );

    new Ec2TransitGatewayRoute(
      this,
      'primary-cross-region-tgw-route-legacy-inspection',
      {
        provider: this.primaryProvider,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.primarySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.inspection.legacy,
        transitGatewayAttachmentId: this.primaryTgwPeerToLegacyAccepter.id,
      }
    );

    /**
     * * Recovery Region's Ingress VPC Cross Region routes
     * * If the peerGatewayVpcs flag is set to true, the destination CIDR block will be those of the gateway VPCs
     */
    new Ec2TransitGatewayRoute(
      this,
      'recovery-cross-region-tgw-route-primary',
      {
        provider: this.recoveryProvider,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.gateway.primary
            .gatewayVpcCidr,
        transitGatewayAttachmentId: this.recoveryTgwPeerToPrimaryAccepter.id,
      }
    );
    new Ec2TransitGatewayRoute(this, 'recovery-cross-region-tgw-route-legacy', {
      provider: this.recoveryProvider,
      transitGatewayRouteTableId:
        crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
          .postInspectionTrafficTransitGatewayRouteTable.id,
      destinationCidrBlock:
        crossRegionTgwPeeringConfig.account.vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
      transitGatewayAttachmentId: this.recoveryTgwPeerToLegacyAccepter.id,
    });

    // * Recovery Region's Inspection VPC Cross Region routes
    new Ec2TransitGatewayRoute(
      this,
      'recovery-cross-region-tgw-route-primary-inspection',
      {
        provider: this.recoveryProvider,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.inspection.primary,
        transitGatewayAttachmentId: this.recoveryTgwPeerToPrimaryAccepter.id,
      }
    );

    new Ec2TransitGatewayRoute(
      this,
      'recovery-cross-region-tgw-route-legacy-inspection',
      {
        provider: this.recoveryProvider,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.recoverySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.inspection.legacy,
        transitGatewayAttachmentId: this.recoveryTgwPeerToLegacyAccepter.id,
      }
    );

    /**
     * * Legacy Region's Ingress VPC Cross Region routes
     * * If the peerGatewayVpcs flag is set to true, the destination CIDR block will be those of the gateway VPCs
     */
    new Ec2TransitGatewayRoute(this, 'legacy-cross-region-tgw-route-primary', {
      provider: null,
      transitGatewayRouteTableId:
        crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
          .postInspectionTrafficTransitGatewayRouteTable.id,
      destinationCidrBlock:
        crossRegionTgwPeeringConfig.account.vpcCidrs.gateway.primary
          .gatewayVpcCidr,
      transitGatewayAttachmentId: this.primaryTgwPeerToLegacyAccepter.id,
    });
    new Ec2TransitGatewayRoute(this, 'legacy-cross-region-tgw-route-recovery', {
      provider: null,
      transitGatewayRouteTableId:
        crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
          .postInspectionTrafficTransitGatewayRouteTable.id,
      destinationCidrBlock:
        crossRegionTgwPeeringConfig.account.vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
      transitGatewayAttachmentId: this.recoveryTgwPeerToLegacyAccepter.id,
    });

    // * Legacy Region's Inspection VPC Cross Region routes
    new Ec2TransitGatewayRoute(
      this,
      'legacy-cross-region-tgw-route-primary-inspection',
      {
        provider: null,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.inspection.primary,
        transitGatewayAttachmentId: this.primaryTgwPeerToLegacyAccepter.id,
      }
    );

    new Ec2TransitGatewayRoute(
      this,
      'legacy-cross-region-tgw-route-recovery-inspection',
      {
        provider: null,
        transitGatewayRouteTableId:
          crossRegionTgwPeeringConfig.legacySharedNetworkTransitGateway
            .postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock:
          crossRegionTgwPeeringConfig.account.vpcCidrs.inspection.recovery,
        transitGatewayAttachmentId: this.recoveryTgwPeerToLegacyAccepter.id,
      }
    );
  }
}
