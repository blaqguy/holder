import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { CustomerGateway } from '@cdktf/provider-aws/lib/customer-gateway';
import { VpnConnection } from '@cdktf/provider-aws/lib/vpn-connection';
import { DfAliasedKeyConstruct } from '@dragonfly/constructs';
import { Constants, Utils } from '@dragonfly/utils';
import { CustomerConfigs } from './customerConfigs';
import { DfSharedNetworkStack, RemoteStack, StackConfig } from '../stacks';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { Route } from '@cdktf/provider-aws/lib/route';
import { Ec2TransitGatewayRouteTable } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table';
import { Ec2TransitGatewayRouteTableAssociation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-association';
import { Ec2TransitGatewayRouteTablePropagation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-propagation';
import { Ec2Tag } from '@cdktf/provider-aws/lib/ec2-tag';
import { cidrSubnet } from 'ip';
import { Ec2TransitGatewayRoute } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route';
import { DfCrossRegionTgwPeeringStack } from '../stacks';

/**
 * @interface SiteToSiteVpnConfig - The configuration for the site to site VPN stack
 * @property {Constants.AWS_REGION_ALIASES} region - The Region to deploy the stack to
 * @property {CustomerConfigs} customerConfig - The customer configuration object containing the VPN configurations
 * @property {string} phzId - The private hosted zone ID
 * @property {DfSharedNetworkStack} sharedNetworkInstance - The shared network instance
 * @property {boolean} [proxyLegacyRegion] - Whether or not to proxy legacy region traffic
 */
interface SiteToSiteVpnConfig {
  /**
   * The Region to deploy the stack to
   */
  region: Constants.AWS_REGION_ALIASES;
  /**
   * The customer configuration object containing the VPN configurations
   */
  customerConfigs: CustomerConfigs;
  /**
   * The private hosted zone ID
   */
  phzId: string;
  /**
   * The shared network instance
   */
  sharedNetworkInstance: DfSharedNetworkStack;
  /**
   * Whether or not to proxy legacy region traffic
   */
  proxyLegacyRegion: {
    enabled: boolean;
    crossRegionPeeringStack?: DfCrossRegionTgwPeeringStack; // Must be passed in if true
    legacySharedNetworkInstance?: DfSharedNetworkStack; // Must be passed in if true
  };
}

/**
 * This stack is used to create a site to site VPN connections.
 */
export class DfSiteToSiteVpnStack extends RemoteStack {
  private vpnConnection: VpnConnection;
  private customerTgwRtb: Ec2TransitGatewayRouteTable;

  /**
   * @param {string} stackId - The ID of the stack.
   * @param {StackConfig} stackConfig - The stack configuration.
   * @param {SiteToSiteVpnConfig} s2sVpnConfig - The site to site VPN connection configuration.
   */
  constructor(
    stackId: string,
    stackConfig: StackConfig,
    s2sVpnConfig: SiteToSiteVpnConfig
  ) {
    super(stackId, stackConfig);
    // Retrieves the current provider based on the region passed in
    const provider = this.getProviderForRegion(s2sVpnConfig.region);

    const cloudWatchKmsKey = new DfAliasedKeyConstruct(
      this,
      `cloudwatch-kms-key`,
      {
        provider: provider,
        name: 'site-to-site-vpn-cloudwatch',
        description: `Site to Site VPN CloudWatch Kms Key`,
      }
    );
    cloudWatchKmsKey.key.addOverride(
      'policy',
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'Enable IAM User Permissions',
            Effect: 'Allow',
            Principal: {
              AWS: `arn:aws:iam::${this.stackConfig.federatedAccountId}:root`,
            },
            Action: 'kms:*',
            Resource: '*',
          },
          {
            Sid: 'Allow CloudWatch',
            Effect: 'Allow',
            Principal: {
              Service: [
                `logs.${
                  Constants.AWS_REGION_MAP[s2sVpnConfig.region]
                }.amazonaws.com`,
              ],
            },
            Action: [
              'kms:Encrypt*',
              'kms:Decrypt*',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:Describe*',
            ],
            Resource: '*',
          },
        ],
      })
    );

    // * Summary route to route all customer nat block packets from application vpcs to the customer edge private nats
    s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct.privateRouteTableIds.forEach(
      (privateRouteTableId, i) => {
        new Route(this, `summarized-customer-nat-block-to-private-nat${i}`, {
          provider: provider,
          routeTableId: privateRouteTableId,
          destinationCidrBlock: Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR,
          natGatewayId:
            s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct
              .customerEdgeNatGateways[i].id,
        });
      }
    );

    // * Summary route to route all customer nat block packets from private nats to the customer edge tgw
    s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct.customerEdgeRouteTableIds.forEach(
      (customerEdgeRouteTableId, i) => {
        new Route(
          this,
          `summarized-customer-nat-block-to-customer-edge-tgw${i}`,
          {
            provider: provider,
            routeTableId: customerEdgeRouteTableId,
            destinationCidrBlock: Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR,
            transitGatewayId:
              s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                .customerEdgeTransitGateway.id,
          }
        );
      }
    );

    // * Summary route to route all customer nat block packets from Legacy Region to the Proxy Region
    if (s2sVpnConfig.proxyLegacyRegion.enabled) {
      new Ec2TransitGatewayRoute(
        this,
        'summarized-customer-nat-block-legacy-proxy',
        {
          destinationCidrBlock: Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR,
          transitGatewayRouteTableId:
            s2sVpnConfig.proxyLegacyRegion.legacySharedNetworkInstance
              .tgwConstruct.postInspectionTrafficTransitGatewayRouteTable.id,
          transitGatewayAttachmentId:
            provider === this.primaryProvider
              ? s2sVpnConfig.proxyLegacyRegion.crossRegionPeeringStack
                  .legacyTgwPeerToPrimaryRequester.id
              : s2sVpnConfig.proxyLegacyRegion.crossRegionPeeringStack
                  .legacyTgwPeerToRecoveryRequester.id,
        }
      );
    }

    Object.entries(s2sVpnConfig.customerConfigs).forEach(
      ([key, customerConfig]) => {
        // * There can be duplicate assigned nat ips for different endpoints. Create new outbound endpoint mapping nats array and remove duplicates
        const allAssignedNats = customerConfig.outboundEndpointNatMapping.map(
          (mapping) => mapping.assignedNat
        );

        // * New outbound endpoint mapping nats array without duplicates
        const uniqueAssignedNatSet = new Set(allAssignedNats);
        const uniqueAssignedNats = [...uniqueAssignedNatSet];

        customerConfig.vpnConfigs.forEach((vpnConfig, index) => {
          // Create Customer Gateway with clients public ip address
          const customerGw = new CustomerGateway(
            this,
            `customer-gw-${vpnConfig.fiName}-${vpnConfig.oldIndex ?? index}`,
            {
              provider: provider,
              bgpAsn: vpnConfig.bgpAsn ?? '65020', // Default private ASN if we dont get one from the client
              type: 'ipsec.1', // Only type AWS supports at this time
              ipAddress: vpnConfig.clientIp, // Clients public IP address
              tags: {
                Name: `site-to-site-vpn-${vpnConfig.fiName}`,
              },
            }
          );

          const tunnel1LogGroup = new CloudwatchLogGroup(
            this,
            `vpn-log-group-tunnel-1-${vpnConfig.fiName}-${
              vpnConfig.oldIndex ?? index
            }`,
            {
              provider: provider,
              dependsOn: [cloudWatchKmsKey.key],
              name: `/aws/vendedlogs/site-to-site-vpn-tunnel-1-${vpnConfig.fiName}`,
              kmsKeyId: cloudWatchKmsKey.key.arn,
              retentionInDays: Utils.getLogRetention(
                this.stackConfig.federatedAccountId
              ),
              tags: {
                Name: `site-to-site-vpn-tunnel-1-${vpnConfig.fiName}`,
              },
            }
          );

          const tunnel2LogGroup = new CloudwatchLogGroup(
            this,
            `vpn-log-group-tunnel-2-${vpnConfig.fiName}-${
              vpnConfig.oldIndex ?? index
            }`,
            {
              provider: provider,
              dependsOn: [cloudWatchKmsKey.key],
              name: `/aws/vendedlogs/site-to-site-vpn-tunnel-2-${vpnConfig.fiName}`,
              kmsKeyId: cloudWatchKmsKey.key.arn,
              retentionInDays: Utils.getLogRetention(
                this.stackConfig.federatedAccountId
              ),
              tags: {
                Name: `site-to-site-vpn-tunnel-2-${vpnConfig.fiName}`,
              },
            }
          );

          this.vpnConnection = new VpnConnection(
            this,
            `vpn-connection-${vpnConfig.fiName}-${vpnConfig.oldIndex ?? index}`,
            {
              dependsOn: [customerGw, tunnel1LogGroup, tunnel2LogGroup],
              provider: provider,
              customerGatewayId: customerGw.id,
              type: 'ipsec.1', // Only type AWS supports at this time,
              transitGatewayId:
                s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                  .customerEdgeTransitGateway.id,
              staticRoutesOnly: vpnConfig.staticConnection,
              localIpv4NetworkCidr: '0.0.0.0/0',
              remoteIpv4NetworkCidr: '0.0.0.0/0',
              tunnel1LogOptions: {
                cloudwatchLogOptions: {
                  logEnabled: true,
                  logOutputFormat: 'json',
                  logGroupArn: tunnel1LogGroup.arn,
                },
              },
              tunnel2LogOptions: {
                cloudwatchLogOptions: {
                  logEnabled: true,
                  logOutputFormat: 'json',
                  logGroupArn: tunnel2LogGroup.arn,
                },
              },
              tunnel1IkeVersions: ['ikev2'],
              tunnel2IkeVersions: ['ikev2'],
              // Phase 1 attributes
              tunnel1Phase1DhGroupNumbers:
                vpnConfig.tunnel1Phase1DhGroupNumbersOverride
                  ? vpnConfig.tunnel1Phase1DhGroupNumbersOverride
                  : [20, 21, 22, 23, 24],
              tunnel2Phase1DhGroupNumbers: [20, 21, 22, 23, 24],
              tunnel1Phase1EncryptionAlgorithms:
                vpnConfig.tunnel1Phase1EncryptionAlgorithmsOverride
                  ? vpnConfig.tunnel1Phase1EncryptionAlgorithmsOverride
                  : ['AES256', 'AES256-GCM-16'],
              tunnel2Phase1EncryptionAlgorithms: ['AES256', 'AES256-GCM-16'],
              tunnel1Phase1IntegrityAlgorithms:
                vpnConfig.tunnel1Phase1IntegrityAlgorithmsOverride
                  ? vpnConfig.tunnel1Phase1IntegrityAlgorithmsOverride
                  : ['SHA2-256', 'SHA2-512'],
              tunnel2Phase1IntegrityAlgorithms: ['SHA2-256', 'SHA2-512'],
              tunnel1StartupAction: vpnConfig.startupAction,
              // Phase 2 attributes
              tunnel1Phase2DhGroupNumbers:
                vpnConfig.tunnel1Phase2DhGroupNumbersOverride
                  ? vpnConfig.tunnel1Phase2DhGroupNumbersOverride
                  : [20, 21, 22, 23, 24],
              tunnel2Phase2DhGroupNumbers: [20, 21, 22, 23, 24],
              tunnel1Phase2EncryptionAlgorithms:
                vpnConfig.tunnel1Phase2EncryptionAlgorithmsOverride
                  ? vpnConfig.tunnel1Phase2EncryptionAlgorithmsOverride
                  : ['AES256', 'AES256-GCM-16'],
              tunnel2Phase2EncryptionAlgorithms: ['AES256', 'AES256-GCM-16'],
              tunnel1Phase2IntegrityAlgorithms:
                vpnConfig.tunnel1Phase2IntegrityAlgorithmsOverride
                  ? vpnConfig.tunnel1Phase2IntegrityAlgorithmsOverride
                  : ['SHA2-256', 'SHA2-512'],
              tunnel2Phase2IntegrityAlgorithms: ['SHA2-256', 'SHA2-512'],
              tunnel2StartupAction: vpnConfig.startupAction,
              tags: {
                Name: `site-to-site-vpn-connection-${vpnConfig.fiName}`,
                Description: vpnConfig.description,
              },
            }
          );

          // * Tag the VPN connection Transit Gateway attachment with the customer's name
          new Ec2Tag(this, `vpn-attachment-tag-${vpnConfig.fiName}`, {
            provider: provider,
            resourceId: this.vpnConnection.transitGatewayAttachmentId,
            key: 'Name',
            value: vpnConfig.fiName,
          });

          // * Create Transit Gateway Route Table per customer. This is to limit the prefixes that are propagated to the customer
          this.customerTgwRtb = new Ec2TransitGatewayRouteTable(
            this,
            `tgw-rtb-${vpnConfig.fiName}-${vpnConfig.oldIndex ?? index}`,
            {
              provider: provider,
              transitGatewayId:
                s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                  .customerEdgeTransitGateway.id,
              tags: {
                Name: vpnConfig.fiName,
              },
            }
          );

          /**
           * * Associate each customer tgw vpn attachment to the customer tgw route table
           */

          new Ec2TransitGatewayRouteTableAssociation(
            this,
            `tgw-rtb-assoc-${vpnConfig.fiName}-${vpnConfig.oldIndex ?? index}`,
            {
              provider: provider,
              transitGatewayAttachmentId:
                this.vpnConnection.transitGatewayAttachmentId,
              transitGatewayRouteTableId: this.customerTgwRtb.id,
            }
          );

          // * Propagate routes from Edge TGW VPC attachment. Allows for return traffic from customer to our Gateway VPC and ultimately to the application vpcs
          if (!vpnConfig.disableS2SVpnAttachmentPropagation) {
            // Primarily added for EWB transition from ACI hosted to DFT hosted Fortinet appliance
            new Ec2TransitGatewayRouteTablePropagation(
              this,
              `gateway-vpc-prop-${vpnConfig.fiName}-${
                vpnConfig.oldIndex ?? index
              }`,
              {
                provider: provider,
                transitGatewayAttachmentId:
                  s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                    .customerEdgeTransitGatewayAttachment.id,
                transitGatewayRouteTableId: this.customerTgwRtb.id,
              }
            );
          }

          if (vpnConfig.staticConnection && vpnConfig.primaryVpnConnection) {
            uniqueAssignedNats.forEach((uniqueAssignedNat) => {
              if (
                !cidrSubnet(Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR).contains(
                  uniqueAssignedNat
                )
              ) {
                new Ec2TransitGatewayRoute(
                  this,
                  `customer-provided-nat-edge-static-tgw-route-${key}-${uniqueAssignedNat}`,
                  {
                    provider: provider,
                    destinationCidrBlock: `${uniqueAssignedNat}/32`,
                    transitGatewayRouteTableId:
                      s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                        .customerEdgeTransitGatewayRouteTable.id,
                    transitGatewayAttachmentId:
                      this.vpnConnection.transitGatewayAttachmentId,
                  }
                );

                // * Route customer nat bound packets to customer
                new Ec2TransitGatewayRoute(
                  this,
                  `customer-provided-nat-static-tgw-route-${key}-${uniqueAssignedNat}`,
                  {
                    provider: provider,
                    destinationCidrBlock: `${uniqueAssignedNat}/32`,
                    transitGatewayRouteTableId: this.customerTgwRtb.id,
                    transitGatewayAttachmentId:
                      this.vpnConnection.transitGatewayAttachmentId,
                  }
                );
              }
            });

            if (
              customerConfig.privatelyUsedPublicIp.ingressOnlyEndpoints
                ?.length > 0
            ) {
              customerConfig.privatelyUsedPublicIp.ingressOnlyEndpoints.forEach(
                (endpoint) => {
                  if (
                    !cidrSubnet(
                      Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR
                    ).contains(endpoint)
                  ) {
                    new Ec2TransitGatewayRoute(
                      this,
                      `customer-pupi-endpoint-edge-static-tgw-route-${key}-${endpoint}`,
                      {
                        provider: provider,
                        destinationCidrBlock: `${endpoint}/32`,
                        transitGatewayRouteTableId:
                          s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                            .customerEdgeTransitGatewayRouteTable.id,
                        transitGatewayAttachmentId:
                          this.vpnConnection.transitGatewayAttachmentId,
                      }
                    );

                    // * Route customer nat bound packets to customer
                    new Ec2TransitGatewayRoute(
                      this,
                      `customer-pupi-endpoint-static-tgw-route-${key}-${endpoint}`,
                      {
                        provider: provider,
                        destinationCidrBlock: `${endpoint}/32`,
                        transitGatewayRouteTableId: this.customerTgwRtb.id,
                        transitGatewayAttachmentId:
                          this.vpnConnection.transitGatewayAttachmentId,
                      }
                    );
                  }
                }
              );
            }

            if (!customerConfig.privatelyUsedPublicIp.enabled) {
              // * Route customer traffic from the edge tgw rtb to the customer's tgw rtb
              vpnConfig.customerNatBlock.forEach((natBlock, i) => {
                new Ec2TransitGatewayRoute(
                  this,
                  `edge-static-tgw-route-${vpnConfig.fiName}-${i}`,
                  {
                    provider: provider,
                    destinationCidrBlock: natBlock,
                    transitGatewayRouteTableId:
                      s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                        .customerEdgeTransitGatewayRouteTable.id,
                    transitGatewayAttachmentId:
                      this.vpnConnection.transitGatewayAttachmentId,
                  }
                );

                // * Route customer traffic from customer's tgw rtb to the customer
                new Ec2TransitGatewayRoute(
                  this,
                  `customer-static-tgw-route-${vpnConfig.fiName}-${i}`,
                  {
                    provider: provider,
                    destinationCidrBlock: natBlock,
                    transitGatewayRouteTableId: this.customerTgwRtb.id,
                    transitGatewayAttachmentId:
                      this.vpnConnection.transitGatewayAttachmentId,
                  }
                );
              });
            }
          } else if (!vpnConfig.staticConnection) {
            // * Propagate routes from the Vpn TGW Attachment to the Edge TGW route table
            if (!vpnConfig.disableS2SVpnAttachmentPropagation) {
              // Primarily added for EWB transition from ACI hosted to DFT hosted Fortinet appliance
              new Ec2TransitGatewayRouteTablePropagation(
                this,
                `vpn-tgw-attachment-edge-prop-${vpnConfig.fiName}`,
                {
                  provider: provider,
                  transitGatewayAttachmentId:
                    this.vpnConnection.transitGatewayAttachmentId,
                  transitGatewayRouteTableId:
                    s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                      .customerEdgeTransitGatewayRouteTable.id,
                }
              );

              // * Propagate routes from the Vpn TGW Attachment to the customer's TGW route table
              new Ec2TransitGatewayRouteTablePropagation(
                this,
                `vpn-tgw-attachment-prop-${vpnConfig.fiName}`,
                {
                  provider: provider,
                  transitGatewayAttachmentId:
                    this.vpnConnection.transitGatewayAttachmentId,
                  transitGatewayRouteTableId: this.customerTgwRtb.id,
                }
              );
            }
          }
        });

        uniqueAssignedNats.forEach((assignedNat) => {
          /**
           * * If assigned nat not within the summarized customer block range of 10.252.0.0/14
           * * Route customer nat bound packets from application vpcs to our private nats
           */

          if (
            !cidrSubnet(Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR).contains(
              assignedNat
            )
          ) {
            s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct.privateRouteTableIds.forEach(
              (privateRouteTableId, i) => {
                // * Pupi Logic
                if (customerConfig.privatelyUsedPublicIp.enabled) {
                  new Route(
                    this,
                    `customer-provided-nat-vpc-route-to-pupi-nat-${key}-${assignedNat}-${i}`,
                    {
                      provider: provider,
                      routeTableId: privateRouteTableId,
                      destinationCidrBlock: `${assignedNat}/32`,
                      // We only have 2 pupi nat gateways. Use 2nd nat gateway if the index is not 0
                      natGatewayId:
                        i === 0
                          ? s2sVpnConfig.sharedNetworkInstance
                              .gatewayVpcConstruct
                              .pupiCustomerEdgeNatGateways[0].id
                          : s2sVpnConfig.sharedNetworkInstance
                              .gatewayVpcConstruct
                              .pupiCustomerEdgeNatGateways[1].id,
                    }
                  );
                } else {
                  // * Create a new route for the assignedNat with a /32
                  new Route(
                    this,
                    `customer-provided-nat-vpc-route-to-private-nat-${key}-${assignedNat}-${i}`,
                    {
                      provider: provider,
                      routeTableId: privateRouteTableId,
                      destinationCidrBlock: `${assignedNat}/32`,
                      natGatewayId:
                        s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct
                          .customerEdgeNatGateways[i].id,
                    }
                  );
                }
              }
            );

            // * Route natted customer packets from private nats to the customer edge tgw
            s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct.customerEdgeRouteTableIds.forEach(
              (customerEdgeRouteTableId, i) => {
                new Route(
                  this,
                  `customer-provided-nat-vpc-route-to-edge-tgw-${key}-${assignedNat}-${i}`,
                  {
                    provider: provider,
                    routeTableId: customerEdgeRouteTableId,
                    destinationCidrBlock: `${assignedNat}/32`,
                    transitGatewayId:
                      s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                        .customerEdgeTransitGateway.id,
                  }
                );
              }
            );

            // * Route customer nat block packets from Legacy Region to the Proxy Region
            if (s2sVpnConfig.proxyLegacyRegion.enabled) {
              new Ec2TransitGatewayRoute(
                this,
                `customer-provided-nat-block-to-legacy-region-${assignedNat}`,
                {
                  destinationCidrBlock: `${assignedNat}/32`,
                  transitGatewayRouteTableId:
                    s2sVpnConfig.proxyLegacyRegion.legacySharedNetworkInstance
                      .tgwConstruct
                      .postInspectionTrafficTransitGatewayRouteTable.id,
                  transitGatewayAttachmentId:
                    provider === this.primaryProvider
                      ? s2sVpnConfig.proxyLegacyRegion.crossRegionPeeringStack
                          .legacyTgwPeerToPrimaryRequester.id
                      : s2sVpnConfig.proxyLegacyRegion.crossRegionPeeringStack
                          .legacyTgwPeerToRecoveryRequester.id,
                }
              );
            }
          }
        });

        if (
          customerConfig.privatelyUsedPublicIp.ingressOnlyEndpoints?.length > 0
        ) {
          customerConfig.privatelyUsedPublicIp.ingressOnlyEndpoints.forEach(
            (endpoint) => {
              if (
                !cidrSubnet(Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR).contains(
                  endpoint
                )
              ) {
                s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct.privateRouteTableIds.forEach(
                  (privateRouteTableId, i) => {
                    if (customerConfig.privatelyUsedPublicIp.enabled) {
                      new Route(
                        this,
                        `customer-pupi-endpoint-vpc-route-to-pupi-nat-${key}-${endpoint}-${i}`,
                        {
                          provider: provider,
                          routeTableId: privateRouteTableId,
                          destinationCidrBlock: `${endpoint}/32`,
                          // We only have 2 pupi nat gateways. Use 2nd nat gateway if the index is not 0
                          natGatewayId:
                            i === 0
                              ? s2sVpnConfig.sharedNetworkInstance
                                  .gatewayVpcConstruct
                                  .pupiCustomerEdgeNatGateways[0].id
                              : s2sVpnConfig.sharedNetworkInstance
                                  .gatewayVpcConstruct
                                  .pupiCustomerEdgeNatGateways[1].id,
                        }
                      );
                    } else {
                      // * Create a new route for the assignedNat with a /32
                      new Route(
                        this,
                        `customer-pupi-endpoint-vpc-route-to-private-nat-${key}-${endpoint}-${i}`,
                        {
                          provider: provider,
                          routeTableId: privateRouteTableId,
                          destinationCidrBlock: `${endpoint}/32`,
                          natGatewayId:
                            s2sVpnConfig.sharedNetworkInstance
                              .gatewayVpcConstruct.customerEdgeNatGateways[i]
                              .id,
                        }
                      );
                    }
                  }
                );

                // * Route natted customer packets from private nats to the customer edge tgw
                s2sVpnConfig.sharedNetworkInstance.gatewayVpcConstruct.customerEdgeRouteTableIds.forEach(
                  (customerEdgeRouteTableId, i) => {
                    new Route(
                      this,
                      `customer-pupi-endpoint-vpc-route-to-edge-tgw-${key}-${endpoint}-${i}`,
                      {
                        provider: provider,
                        routeTableId: customerEdgeRouteTableId,
                        destinationCidrBlock: `${endpoint}/32`,
                        transitGatewayId:
                          s2sVpnConfig.sharedNetworkInstance.tgwConstruct
                            .customerEdgeTransitGateway.id,
                      }
                    );
                  }
                );

                // * Route customer nat block packets from Legacy Region to the Proxy Region
                if (s2sVpnConfig.proxyLegacyRegion.enabled) {
                  new Ec2TransitGatewayRoute(
                    this,
                    `customer-pupi-endpoint-block-to-legacy-region-${endpoint}`,
                    {
                      destinationCidrBlock: `${endpoint}/32`,
                      transitGatewayRouteTableId:
                        s2sVpnConfig.proxyLegacyRegion
                          .legacySharedNetworkInstance.tgwConstruct
                          .postInspectionTrafficTransitGatewayRouteTable.id,
                      transitGatewayAttachmentId:
                        provider === this.primaryProvider
                          ? s2sVpnConfig.proxyLegacyRegion
                              .crossRegionPeeringStack
                              .legacyTgwPeerToPrimaryRequester.id
                          : s2sVpnConfig.proxyLegacyRegion
                              .crossRegionPeeringStack
                              .legacyTgwPeerToRecoveryRequester.id,
                    }
                  );
                }
              }
            }
          );
        }

        if (s2sVpnConfig.region === Constants.AWS_REGION_ALIASES.DF_PRIMARY) {
          // * Create route53 records for the customer's outbound endpoints
          customerConfig.outboundEndpointNatMapping.forEach(
            (mapping, index) => {
              new Route53Record(this, `customer-gw-${key}-${index}`, {
                provider: provider,
                name: mapping.outboundEndpoint,
                type: 'A',
                zoneId: s2sVpnConfig.phzId,
                records: [mapping.assignedNat],
                ttl: 300,
              });
            }
          );
        }
      }
    );
  }
}
