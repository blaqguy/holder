import { DxConnection } from '@cdktf/provider-aws/lib/dx-connection';
import { DxTransitVirtualInterface } from '@cdktf/provider-aws/lib/dx-transit-virtual-interface';
import {
  DfCrossRegionTgwPeeringStack,
  DfSharedNetworkStack,
  RemoteStack,
  StackConfig,
} from '../stacks';
import { DxPublicVirtualInterface } from '@cdktf/provider-aws/lib/dx-public-virtual-interface';
import { Route } from '@cdktf/provider-aws/lib/route';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { DataAwsDxGateway } from '@cdktf/provider-aws/lib/data-aws-dx-gateway';
import { DxGatewayAssociation } from '@cdktf/provider-aws/lib/dx-gateway-association';
import { DataAwsEc2TransitGatewayDxGatewayAttachment } from '@cdktf/provider-aws/lib/data-aws-ec2-transit-gateway-dx-gateway-attachment';
import { Ec2TransitGatewayRouteTableAssociation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-association';
import { Ec2TransitGatewayRouteTablePropagation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-propagation';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { Ec2TransitGatewayRoute } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route';

/**
 * @interface DfDirectConnectConfig - Configuration for the Direct Connect stack
 * @property stackId: string - The ID of the stack
 * @property stackConfig: StackConfig - The stacks metadata
 */
interface DfDirectConnectConfig {
  stackId: string;
  stackConfig: StackConfig;
  sharedNetworkInstances: {
    legacy: DfSharedNetworkStack;
    primary: DfSharedNetworkStack;
    recovery: DfSharedNetworkStack;
  };
  proxyLegacyRegion: {
    failOver: boolean;
    crossRegionTgwPeeringStack: DfCrossRegionTgwPeeringStack;
  };
}

/**
 * This stack is responsible for creating the Direct Connect resources
 */
export class DfDirectConnect extends RemoteStack {
  constructor(config: DfDirectConnectConfig) {
    super(config.stackId, config.stackConfig);

    /**
     * * Legacy Region | Direct Connect routing proxy
     */

    const proxyRoutes = [
      {
        cidrBlocks: Constants.ACI_DESTINATION_CIDR_BLOCKS,
        routeNamePrefix: 'proxy-aci-route',
      },
      {
        cidrBlocks: Constants.MTS_ACI_DESTINATION_CIDR_BLOCKS,
        routeNamePrefix: 'proxy-mts-route',
      },
    ];

    proxyRoutes.forEach((object) => {
      object.cidrBlocks.forEach((destination, index) => {
        new Ec2TransitGatewayRoute(this, `${object.routeNamePrefix}${index}`, {
          destinationCidrBlock: destination,
          transitGatewayRouteTableId:
            config.sharedNetworkInstances.legacy.tgwConstruct
              .postInspectionTrafficTransitGatewayRouteTable.id,
          transitGatewayAttachmentId: config.proxyLegacyRegion.failOver
            ? config.proxyLegacyRegion.crossRegionTgwPeeringStack
                .legacyTgwPeerToRecoveryRequester.id
            : config.proxyLegacyRegion.crossRegionTgwPeeringStack
                .legacyTgwPeerToPrimaryRequester.id,
        });
      });
    });

    /**
     * * Primary Region | Direct Connect Resources
     */
    const dxConn1 = new DxConnection(this, 'DxConnection1', {
      provider: this.primaryProvider,
      bandwidth: '1Gbps',
      location: 'EQC50',
      name: '152222P-NETBONDOHIO-VLAN',
    });

    new DxTransitVirtualInterface(this, 'DxVirtualInterface1', {
      provider: this.primaryProvider,
      addressFamily: 'ipv4',
      bgpAsn: 8030,
      connectionId: dxConn1.id,
      dxGatewayId: 'e54b64ac-4a3d-40ad-9459-2d512eca5f52',
      name: 'DFT-Transit-VIF',
      vlan: 315,
      sitelinkEnabled: false,
      mtu: 8500,
    });

    const dxConn3 = new DxConnection(this, 'DxConnection3', {
      provider: this.primaryProvider,
      bandwidth: '1Gbps',
      location: 'EQC50',
      name: '152222S-NETBONDOHIO-VLAN',
    });

    new DxTransitVirtualInterface(this, 'DxVirtualInterface3', {
      provider: this.primaryProvider,
      addressFamily: 'ipv4',
      bgpAsn: 8030,
      connectionId: dxConn3.id,
      dxGatewayId: 'e54b64ac-4a3d-40ad-9459-2d512eca5f52',
      name: 'DFT-Transit-VIF-Secondary',
      vlan: 321,
      sitelinkEnabled: false,
      mtu: 8500,
    });

    new DxConnection(this, 'DxConnection6', {
      provider: this.primaryProvider,
      bandwidth: '1Gbps',
      location: 'EQC50',
      name: 'NIT531049 - Dragonfly Financial Technologies',
    });

    new DxConnection(this, 'DxConnection7', {
      provider: this.primaryProvider,
      bandwidth: '50Mbps',
      location: 'EQC50',
      name: 'Dragonfly_MTS_Pri',
    });

    new DxTransitVirtualInterface(this, 'DxVirtualInterface5', {
      provider: this.primaryProvider,
      addressFamily: 'ipv4',
      bgpAsn: -94967161,
      connectionId: 'dxcon-fgch9rxn',
      dxGatewayId: '25105ec6-d01c-4da6-adb4-d7237457e1c3',
      name: 'DFT-Transit-VIF-MTS-ACI',
      vlan: 323,
      sitelinkEnabled: false,
      mtu: 1500,
    });

    new DxPublicVirtualInterface(this, 'DxPublicVirtualInterface1', {
      provider: this.primaryProvider,
      addressFamily: 'ipv4',
      bgpAsn: 29856,
      connectionId: 'dxcon-ffz5oxv3',
      name: 'DFT-Nitel-PublicVIF-Chicago',
      vlan: 205,
      customerAddress: '167.94.36.1/30',
      amazonAddress: '167.94.36.2/30',
      routeFilterPrefixes: ['167.94.36.0/24'],
    });

    /**
     * * Recovery Region | Direct Connect Resources
     */
    const dxConn2 = new DxConnection(this, 'DxConnection2', {
      provider: this.recoveryProvider,
      bandwidth: '1Gbps',
      location: 'EqSe2-EQ',
      name: '152222P-NETBONDOREGON-VL',
    });

    new DxTransitVirtualInterface(this, 'DxVirtualInterface2', {
      provider: this.recoveryProvider,
      addressFamily: 'ipv4',
      bgpAsn: 8030,
      connectionId: dxConn2.id,
      dxGatewayId: 'fa316945-e88a-48bb-a835-d4aaf9c189ed',
      name: 'DFT-Transit-VIF-Recovery-Primary',
      vlan: 309,
      sitelinkEnabled: false,
      mtu: 8500,
    });

    const dxConn4 = new DxConnection(this, 'DxConnection4', {
      provider: this.recoveryProvider,
      bandwidth: '1Gbps',
      location: 'EqSe2-EQ',
      name: '152222S-NETBONDOREGON-VL',
    });

    new DxTransitVirtualInterface(this, 'DxVirtualInterface4', {
      provider: this.recoveryProvider,
      addressFamily: 'ipv4',
      bgpAsn: 8030,
      connectionId: dxConn4.id,
      dxGatewayId: 'fa316945-e88a-48bb-a835-d4aaf9c189ed',
      name: 'DFT-Transit-VIF-Recovery-Secondary',
      vlan: 310,
      sitelinkEnabled: false,
      mtu: 8500,
    });

    new DxConnection(this, 'DxConnection5', {
      provider: this.recoveryProvider,
      bandwidth: '1Gbps',
      location: 'EqSe2-WBE',
      name: 'NIT531048 - Dragonfly Financial Technologies - 1G',
    });

    // This one is down and keeps trying to recreate. Added lifecycle to prevent it from doing so.
    new DxPublicVirtualInterface(this, 'DxPublicVirtualInterface2', {
      provider: this.recoveryProvider,
      addressFamily: 'ipv4',
      bgpAsn: 29856,
      connectionId: 'dxcon-fh0a3r7q',
      name: 'DFT-Nitel-PrivateVIF-Seatle',
      vlan: 2763,
      customerAddress: '167.94.36.5/30',
      amazonAddress: '167.94.36.6/30',
      routeFilterPrefixes: ['167.94.36.0/24'],
      lifecycle: {
        ignoreChanges: ['name'],
      },
    });

    /**
     * * BEGIN - DX VPC ROUTE TABLE ROUTES
     * Forward ACI traffic from TGW to Private NATs
     */
    const providerToSharedNetworkInstaceMapping = [
      {
        provider: this.primaryProvider,
        instance: config.sharedNetworkInstances.primary,
      },
      {
        provider: this.recoveryProvider,
        instance: config.sharedNetworkInstances.recovery,
      },
    ];

    providerToSharedNetworkInstaceMapping.forEach((map, index) => {
      map.instance.gatewayVpcConstruct.privateRouteTableIds.forEach((id, i) => {
        Constants.ACI_DESTINATION_CIDR_BLOCKS.forEach((destination, j) => {
          new Route(this, `tgw-to-nat-${index}-${i}-${j}`, {
            provider: map.provider,
            routeTableId: id,
            destinationCidrBlock: destination,
            natGatewayId:
              map.instance.gatewayVpcConstruct.customerEdgeNatGateways[i].id,
          });
        });

        Constants.MTS_ACI_DESTINATION_CIDR_BLOCKS.forEach((destination, j) => {
          new Route(this, `mts-to-nat-${index}-${i}-${j}`, {
            provider: map.provider,
            routeTableId: id,
            destinationCidrBlock: destination,
            natGatewayId:
              map.instance.gatewayVpcConstruct.customerEdgeNatGateways[i].id,
          });
        });
      });

      // Forward Natted ACI traffic from Gateway VPC to Edge TGW
      map.instance.gatewayVpcConstruct.customerEdgeRouteTableIds.forEach(
        (id, i) => {
          Constants.ACI_DESTINATION_CIDR_BLOCKS.forEach((destination, j) => {
            new Route(this, `aci-natted-to-tgw-${index}-${i}-${j}`, {
              provider: map.provider,
              routeTableId: id,
              destinationCidrBlock: destination,
              transitGatewayId:
                map.instance.tgwConstruct.customerEdgeTransitGateway.id,
            });
          });

          Constants.MTS_ACI_DESTINATION_CIDR_BLOCKS.forEach(
            (destination, j) => {
              new Route(this, `mts-natted-to-tgw-${index}-${i}-${j}`, {
                provider: map.provider,
                routeTableId: id,
                destinationCidrBlock: destination,
                transitGatewayId:
                  map.instance.tgwConstruct.customerEdgeTransitGateway.id,
              });
            }
          );
        }
      );
      /**
       * * END - DX VPC ROUTE TABLE ROUTES
       */

      /**
       * * BEGIN - DX TGW ROUTE TABLE ROUTES
       */

      const aciDxGateway = new DataAwsDxGateway(
        this,
        `directConnectLookup-${index}`,
        {
          provider: map.provider,
          name: Constants.DX_DRAGONFLY_DCG,
        }
      );

      const mtsAciDxGateway = new DataAwsDxGateway(
        this,
        `mtsAciDirectConnectLookup-${index}`,
        {
          provider: map.provider,
          name: Constants.DX_DRAGONFLY_MTS,
        }
      );

      const aciDxTransitGatewayAssociation = new DxGatewayAssociation(
        this,
        `dft-aci-dx-tgw-association-${index}`,
        {
          provider: map.provider,
          dxGatewayId: aciDxGateway.id,
          associatedGatewayId:
            map.instance.tgwConstruct.customerEdgeTransitGateway.id,
          allowedPrefixes:
            map.provider === this.primaryProvider
              ? [
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .primary.gatewayVpcCidr,
                ]
              : [
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .recovery.gatewayVpcCidr,
                ], // Advertise the correct gateway vpc cidr based on the region
        }
      );

      const mtsAciDxTransitGatewayAssociation = new DxGatewayAssociation(
        this,
        `dft-mts-aci-dx-tgw-association-${index}`,
        {
          provider: map.provider,
          dxGatewayId: mtsAciDxGateway.id,
          associatedGatewayId:
            map.instance.tgwConstruct.customerEdgeTransitGateway.id,
          allowedPrefixes:
            map.provider === this.primaryProvider
              ? [
                  ...Object.values(
                    DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                      .primary.subnets.customerEdge
                  ),
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .primary.gatewayVpcCidr,
                ]
              : Object.values(
                  DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                    .recovery.subnets.customerEdge
                ), // Advertise the correct customer edge subnets based on the region
        }
      );

      const aciDxTransitGatewayAttachment =
        new DataAwsEc2TransitGatewayDxGatewayAttachment(
          this,
          `aciGatewayAttachment-${index}`,
          {
            provider: map.provider,
            transitGatewayId:
              map.instance.tgwConstruct.customerEdgeTransitGateway.id,
            dxGatewayId: aciDxGateway.id,
            filter: [
              {
                name: 'state',
                values: ['available'],
              },
            ],
            dependsOn: [aciDxTransitGatewayAssociation],
          }
        );

      const mtsAciDxTransitGatewayAttachment =
        new DataAwsEc2TransitGatewayDxGatewayAttachment(
          this,
          `mtsAciGatewayAttachment${index}`,
          {
            provider: map.provider,
            transitGatewayId:
              map.instance.tgwConstruct.customerEdgeTransitGateway.id,
            dxGatewayId: mtsAciDxGateway.id,
            filter: [
              {
                name: 'state',
                values: ['available'],
              },
            ],
            dependsOn: [mtsAciDxTransitGatewayAssociation],
          }
        );

      new Ec2TransitGatewayRouteTableAssociation(
        this,
        `aciDxAssociation-${index}`,
        {
          provider: map.provider,
          transitGatewayRouteTableId:
            map.instance.tgwConstruct.customerEdgeTransitGatewayRouteTable.id,
          transitGatewayAttachmentId: aciDxTransitGatewayAttachment.id,
        }
      );

      new Ec2TransitGatewayRouteTableAssociation(
        this,
        `mtsAciDxAssociation-${index}`,
        {
          provider: map.provider,
          transitGatewayRouteTableId:
            map.instance.tgwConstruct.customerEdgeTransitGatewayRouteTable.id,
          transitGatewayAttachmentId: mtsAciDxTransitGatewayAttachment.id,
        }
      );

      new Ec2TransitGatewayRouteTablePropagation(
        this,
        `aciDxPropagation-${index}`,
        {
          provider: map.provider,
          transitGatewayAttachmentId: aciDxTransitGatewayAttachment.id,
          transitGatewayRouteTableId:
            map.instance.tgwConstruct.customerEdgeTransitGatewayRouteTable.id,
        }
      );

      new Ec2TransitGatewayRouteTablePropagation(
        this,
        `mtsAciDxPropagation-${index}`,
        {
          provider: map.provider,
          transitGatewayAttachmentId: mtsAciDxTransitGatewayAttachment.id,
          transitGatewayRouteTableId:
            map.instance.tgwConstruct.customerEdgeTransitGatewayRouteTable.id,
        }
      );
      /**
       * * END - DX TGW ROUTE TABLE ROUTES
       */
    });

    /**
     * * Route53 entries for Direct Connect Endpoints
     * * R53 is a global resource and we know this mappings ahead of time
     * * It's not exactly dependant on pre existing resources
     */
    const outboundEndpointNatMapping = [
      {
        outboundEndpoint: 'mts-primary.uat.dragonflyft.com',
        assignedNat: '100.126.0.210',
      },
      {
        outboundEndpoint: 'mts-primary.prod.dragonflyft.com',
        assignedNat: '100.126.0.215',
      },
      {
        outboundEndpoint: 'mts-secondary.prod.dragonflyft.com',
        assignedNat: '100.126.0.217',
      },
    ];

    outboundEndpointNatMapping.forEach((mapping, index) => {
      new Route53Record(this, `dx-{key}-r53-record${index}`, {
        name: mapping.outboundEndpoint,
        type: 'A',
        zoneId: config.sharedNetworkInstances.primary.getPhzId(),
        records: [mapping.assignedNat],
        ttl: 300,
      });
    });
  }
}
