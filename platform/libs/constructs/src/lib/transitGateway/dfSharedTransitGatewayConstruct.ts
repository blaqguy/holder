import { DragonflyTransitGateway } from '@dragonfly/components';
import { Ec2TransitGatewayRoute } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route';
import { Ec2TransitGatewayRouteTable } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table';
import { Ec2TransitGatewayRouteTableAssociation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-association';
import { Ec2TransitGatewayVpcAttachment } from '@cdktf/provider-aws/lib/ec2-transit-gateway-vpc-attachment';
import { RamPrincipalAssociation } from '@cdktf/provider-aws/lib/ram-principal-association';
import { RamResourceAssociation } from '@cdktf/provider-aws/lib/ram-resource-association';
import { RamResourceShare } from '@cdktf/provider-aws/lib/ram-resource-share';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { FlowLog } from '@cdktf/provider-aws/lib/flow-log';
import { Route } from '@cdktf/provider-aws/lib/route';
import { DfGatewayVpcConstruct, ReDfInspectionVpcConstruct } from '../vpc';
import { Construct } from 'constructs';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { AccountDefinition, Constants, DfAccounts } from '@dragonfly/utils';
import { Ec2TransitGatewayRouteTablePropagation } from '@cdktf/provider-aws/lib/ec2-transit-gateway-route-table-propagation';

export interface dfSharedTransitGatewayConstructConfig {
  /**
   * Instance of the Gateway VPC Construct.
   */
  gatewayVpc: DfGatewayVpcConstruct;
  /**
   * Instance of the Inspection VPC Construct
   */
  inspectionVpc: ReDfInspectionVpcConstruct;
  /**
   * The AWS Provider to be used for creating these resources
   */
  provider: AwsProvider;
  /**
   * The Transit Gateway ASN
   */
  tgwAsn?: number;
  /**
   * The suffix to be added to the TGW resource
   */
  tgwSuffix?: string;
  /**
   * The account definition for the account this construct is being deployed to
   */
  account: AccountDefinition;
  /**
   * Whether or not to bypass inspection
   */
  bypassInspection: boolean;
  /**
   * Whether or not to deploy Hybrid Networking
   */
  deployHybridNetworking: boolean;
}
/**
 * Shared TGW Construct
 */
export class DfSharedTransitGatewayConstruct extends Construct {
  public readonly transitGateway: DragonflyTransitGateway;
  public readonly customerEdgeTransitGateway: DragonflyTransitGateway;

  private ramResourceShare: RamResourceShare;
  private ramResourceAssociation: RamResourceAssociation;

  public readonly spokeTrafficTransitGatewayRouteTable: Ec2TransitGatewayRouteTable;
  private gatewayTrafficTransitGatewayRouteTable: Ec2TransitGatewayRouteTable;
  public readonly postInspectionTrafficTransitGatewayRouteTable: Ec2TransitGatewayRouteTable;
  public readonly customerEdgeTransitGatewayRouteTable: Ec2TransitGatewayRouteTable;

  public readonly gatewayTransitGatewayAttachment: Ec2TransitGatewayVpcAttachment;
  public readonly inspectionTransitGatewayAttachment: Ec2TransitGatewayVpcAttachment;
  public readonly customerEdgeTransitGatewayAttachment: Ec2TransitGatewayVpcAttachment;

  /**
   *
   * @param {StackConfig} stackConfig
   * @param {dfSharedTransitGatewayConstructConfig} dfSharedTgwConfig
   */
  constructor(
    private scope: Construct,
    private id: string,
    private dfSharedTgwConfig: dfSharedTransitGatewayConstructConfig,
    private federatedAccountId: string
  ) {
    super(scope, id);

    /**
     * * Create the Transit Gateway
     */
    this.transitGateway = new DragonflyTransitGateway(this, 'TransitGateway', {
      provider: dfSharedTgwConfig.provider,
      description: 'Dragonfly Transit Gateway',
      amazonSideAsn: dfSharedTgwConfig.tgwAsn || null,
      tags: {
        Name: 'cardinalTransitGateway',
        Production:
          this.federatedAccountId === Constants.ACCOUNT_NUMBER_SHARED_NETWORK
            ? 'true'
            : 'false',
      },
    });

    /**
     * * Create the flow logs for the transit gateway
     */
    const tgwFlowLogGroup = new CloudwatchLogGroup(this, 'tgwFlowLogGroup', {
      provider: this.dfSharedTgwConfig.provider,
      name: this.dfSharedTgwConfig.tgwSuffix
        ? `tgwFlowLogGroup-${this.dfSharedTgwConfig.tgwSuffix}`
        : 'tgwFlowLogGroup',
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        this.federatedAccountId
      )
        ? 365
        : 14,
      kmsKeyId: this.dfSharedTgwConfig.gatewayVpc.flowLogKmsArn,
      tags: { Name: 'tgw-flow-logs' },
    });

    this.createTgwFlowLog(
      'tgwFlowLog',
      'cloud-watch-logs',
      tgwFlowLogGroup.arn
    );

    /**
     * * Share the Transit Gateway
     */
    this.ramResourceShare = new RamResourceShare(this, 'tgwResourceShare', {
      provider: dfSharedTgwConfig.provider,
      name: 'tgwResourceShare',
      allowExternalPrincipals: false,
      tags: {
        Name: 'tgwResourceShare',
        Production: 'true',
      },
    });

    this.ramResourceAssociation = new RamResourceAssociation(
      this,
      'tgwResourceAssociation',
      {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        resourceArn: this.transitGateway.arn,
      }
    );

    if (
      federatedAccountId ===
      DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      new RamPrincipalAssociation(this, 'uatAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-24hschsc',
      });

      new RamPrincipalAssociation(this, 'sharedProdAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-2u6mt9y9',
      });

      new RamPrincipalAssociation(this, 'toolsAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-j81f5vr9',
      });

      new RamPrincipalAssociation(this, 'istAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-563udqk3',
      });
    } else if (
      federatedAccountId ===
      DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber
    ) {
      new RamPrincipalAssociation(this, 'toolsAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-j81f5vr9',
      });

      new RamPrincipalAssociation(this, 'sandboxAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-hlkw43mk',
      });

      new RamPrincipalAssociation(this, 'devAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-2z2cri84',
      });

      new RamPrincipalAssociation(this, 'perfAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-1qpfh8g3',
      });

      new RamPrincipalAssociation(this, 'qeAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-2u46scq1',
      });

      new RamPrincipalAssociation(this, 'istAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-563udqk3',
      });
    } else {
      new RamPrincipalAssociation(this, 'sandboxAssociation', {
        provider: dfSharedTgwConfig.provider,
        resourceShareArn: this.ramResourceShare.arn,
        principal:
          'arn:aws:organizations::446554332519:ou/o-q4ohcirjpy/ou-drg8-hlkw43mk',
      });
    }

    /**
     * * Create Gateway VPC Transit Gateway Attachment
     */
    if (dfSharedTgwConfig.gatewayVpc) {
      this.gatewayTransitGatewayAttachment = new Ec2TransitGatewayVpcAttachment(
        this,
        'gatewayTGWAttachement',
        {
          provider: dfSharedTgwConfig.provider,
          transitGatewayId: this.transitGateway.id,
          vpcId: this.dfSharedTgwConfig.gatewayVpc.vpcId,
          subnetIds: this.dfSharedTgwConfig.gatewayVpc.transitSubnetIds,
          transitGatewayDefaultRouteTableAssociation: false,
          transitGatewayDefaultRouteTablePropagation: false,
          tags: {
            Name: 'gatewayTgwAttachment',
          },
        }
      );
    }

    /**
     * * Create Inspection Transit Gateway Attachement
     */
    this.inspectionTransitGatewayAttachment =
      new Ec2TransitGatewayVpcAttachment(this, 'inspectionTGWAttachement', {
        provider: dfSharedTgwConfig.provider,
        transitGatewayId: this.transitGateway.id,
        vpcId: this.dfSharedTgwConfig.inspectionVpc.vpcId,
        subnetIds: this.dfSharedTgwConfig.inspectionVpc.transitSubnetIds,
        transitGatewayDefaultRouteTableAssociation: false,
        transitGatewayDefaultRouteTablePropagation: false,
        applianceModeSupport: 'enable',
        tags: {
          Name: 'inspectionTgwAttachment',
        },
      });

    /**
     * * Create the Spoke Traffic Transit Gateway Route Table
     */
    this.spokeTrafficTransitGatewayRouteTable = new Ec2TransitGatewayRouteTable(
      this,
      'spokeTrafficRouteTable',
      {
        provider: dfSharedTgwConfig.provider,
        transitGatewayId: this.transitGateway.id,
        tags: {
          Name: 'spoke-traffic',
          Production: 'true',
        },
      }
    );

    /**
     * * Create the Gateway Traffic Transit Gateway Route Table
     */
    if (dfSharedTgwConfig.gatewayVpc) {
      this.gatewayTrafficTransitGatewayRouteTable =
        new Ec2TransitGatewayRouteTable(this, 'gatewayTrafficRouteTable', {
          provider: dfSharedTgwConfig.provider,
          transitGatewayId: this.transitGateway.id,
          tags: {
            Name: 'gateway-traffic',
            Production: 'true',
          },
        });
    }

    /**
     * * Create the Post Inspection Traffic Transit Gateway Route Table
     */
    this.postInspectionTrafficTransitGatewayRouteTable =
      new Ec2TransitGatewayRouteTable(this, 'postInspectionTrafficRouteTable', {
        provider: dfSharedTgwConfig.provider,
        transitGatewayId: this.transitGateway.id,
        tags: {
          Name: 'post-inspection-traffic',
          Production: 'true',
        },
      });

    /**
     * * Update the Inspection VPC's RT to route appropriate traffic to the Transit Gateway
     * * Route default traffic to TGW in the MGMT Subnets' RT
     */
    new Route(this, 'mgmtToTgw', {
      provider: dfSharedTgwConfig.provider,
      routeTableId: this.dfSharedTgwConfig.inspectionVpc.mgmtRouteTableId,
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayId: this.transitGateway.id,
    });

    /**
     * * Route default traffic to TGW in the Inspection Subnets' RT
     */
    new Route(this, 'inspectionToTgw', {
      provider: dfSharedTgwConfig.provider,
      routeTableId: this.dfSharedTgwConfig.inspectionVpc.inspectionRouteTableId,
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayId: this.transitGateway.id,
    });

    /**
     * * Route default traffic to TGW in the GWLB-VPCE Subnets' RT
     */
    new Route(this, 'gwlbVpceToTgw', {
      provider: dfSharedTgwConfig.provider,
      routeTableId: this.dfSharedTgwConfig.inspectionVpc.gwlbVpceRouteTableId,
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayId: this.transitGateway.id,
    });

    /**
     * * If bypassInspection is set to true, route default traffic in the TGW Subnets' RT to the Transit Gateway
     */
    if (this.dfSharedTgwConfig.bypassInspection) {
      this.dfSharedTgwConfig.inspectionVpc.inspectionTransitSubnetRouteTables.forEach(
        (inspectionTransitRtb, index) => {
          new Route(this, `transitSubnetsToTgw-${index}`, {
            provider: dfSharedTgwConfig.provider,
            routeTableId: inspectionTransitRtb.id,
            destinationCidrBlock: '0.0.0.0/0',
            transitGatewayId: this.transitGateway.id,
          });
        }
      );
    }

    /**
     * * Update the Gateway VPC's RT to route appropriate traffic to the Transit Gateway
     */
    if (dfSharedTgwConfig.gatewayVpc) {
      const gatewayVpcRouteTableIds =
        this.dfSharedTgwConfig.gatewayVpc.privateRouteTableIds.concat(
          this.dfSharedTgwConfig.gatewayVpc.publicRouteTable.id
        );

      // * Route class A traffic to TGW in the Private and Public Route Tables. Every Subnet in the Gateway VPC belongs to one of these two route tables
      gatewayVpcRouteTableIds.forEach((routeTable, index) => {
        new Route(this, `gwVpcDftInternalRangetoTgw${index}`, {
          provider: dfSharedTgwConfig.provider,
          routeTableId: routeTable,
          destinationCidrBlock: '10.0.0.0/8',
          transitGatewayId: this.transitGateway.id,
        });

        let gatewayVpcCidrBlocks = [];
        if (
          this.federatedAccountId === Constants.ACCOUNT_NUMBER_SHARED_NETWORK
        ) {
          gatewayVpcCidrBlocks = [
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
              .gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
              .gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
          ];
        } else if (
          this.federatedAccountId ===
          Constants.ACCOUNT_NUMBER_NON_PROD_SHARED_NETWORK
        ) {
          gatewayVpcCidrBlocks = [
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .legacy.gatewayVpcCidr,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .primary.gatewayVpcCidr,
            DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
          ];
        }

        gatewayVpcCidrBlocks
          .filter((cidr) => {
            return (
              cidr !== this.dfSharedTgwConfig.gatewayVpc.untokenizedVpcCidrBlock
            );
          })
          .forEach((cidr, cidrIndex) => {
            new Route(this, `crossRegionGatewayVpcRt${index}-${cidrIndex}`, {
              provider: dfSharedTgwConfig.provider,
              routeTableId: routeTable,
              destinationCidrBlock: cidr,
              transitGatewayId: this.transitGateway.id,
            });
          });

        /**
         * * Allow return traffic from internet back to inspection VPC in the Transit Route Tables
         * ? Need to figure out if this is needed in both public and private route tables
         */
        Object.values(
          this.dfSharedTgwConfig.account.vpcCidrs.inspection
        ).forEach((cidr, cidrIndex) => {
          new Route(this, `gwVpcinspectionToTgw-${index}-${cidrIndex}`, {
            provider: dfSharedTgwConfig.provider,
            routeTableId: routeTable,
            destinationCidrBlock: cidr,
            transitGatewayId: this.transitGateway.id,
          });
        });
      });
    }

    /**
     * * Associate TGW attachments to TGW Route
     * * Associate the Inspection VPC's attachment to the Post Inspection TGW RT
     */
    new Ec2TransitGatewayRouteTableAssociation(
      this,
      'inspectionAttachmentAssociation',
      {
        provider: dfSharedTgwConfig.provider,
        transitGatewayAttachmentId: this.inspectionTransitGatewayAttachment.id,
        transitGatewayRouteTableId:
          this.postInspectionTrafficTransitGatewayRouteTable.id,
      }
    );

    /**
     * * Associate the Gateway VPC attachment to the Gateway traffic TGW RT
     */
    if (dfSharedTgwConfig.gatewayVpc) {
      new Ec2TransitGatewayRouteTableAssociation(
        this,
        'gatewayAttachmentAssociation',
        {
          provider: dfSharedTgwConfig.provider,
          transitGatewayAttachmentId: this.gatewayTransitGatewayAttachment.id,
          transitGatewayRouteTableId:
            this.gatewayTrafficTransitGatewayRouteTable.id,
        }
      );
    }

    /**
     * * Update the TGW RTs for the Spoke, Ingress, Egress and Gateway traffic
     * * Add static route for default traffic to the Inspection VPC's TGW Attachment in the Spoke TGW RT
     */
    new Ec2TransitGatewayRoute(
      this,
      'spokeTrafficDefaultToInspectionAttachment',
      {
        provider: dfSharedTgwConfig.provider,
        transitGatewayRouteTableId:
          this.spokeTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock: '0.0.0.0/0',
        transitGatewayAttachmentId: this.inspectionTransitGatewayAttachment.id,
      }
    );

    /**
     * * Add static route for default traffic to the Inspection VPC's TGW Attachment in the Gateway TGW RT
     */
    if (dfSharedTgwConfig.gatewayVpc) {
      new Ec2TransitGatewayRoute(
        this,
        'gatewayTrafficDefaultToInspectionAttachment',
        {
          provider: dfSharedTgwConfig.provider,
          transitGatewayRouteTableId:
            this.gatewayTrafficTransitGatewayRouteTable.id,
          destinationCidrBlock: '0.0.0.0/0',
          transitGatewayAttachmentId:
            this.inspectionTransitGatewayAttachment.id,
        }
      );
    }

    /**
     * * Update Post Inspection TGW RT
     */
    new Ec2TransitGatewayRoute(
      this,
      'postInspectionTrafficDefaultToGatewayAttachment',
      {
        provider: dfSharedTgwConfig.provider,
        transitGatewayRouteTableId:
          this.postInspectionTrafficTransitGatewayRouteTable.id,
        destinationCidrBlock: '0.0.0.0/0',
        transitGatewayAttachmentId: this.gatewayTransitGatewayAttachment.id,
      }
    );

    /**
     * * Hybrid Networking Resource. Used for customer connectivity.
     */
    if (dfSharedTgwConfig.deployHybridNetworking) {
      this.customerEdgeTransitGateway = new DragonflyTransitGateway(
        this,
        'edge-transit-gateway',
        {
          provider: dfSharedTgwConfig.provider,
          description:
            'Edge Transit Gateway. Used to connect to customer networks.',
          tags: {
            Name: 'Edge-Transit-Gateway',
            Production: 'true',
          },
        }
      );

      this.customerEdgeTransitGatewayAttachment =
        new Ec2TransitGatewayVpcAttachment(this, 'transit-gateway-attachment', {
          provider: dfSharedTgwConfig.provider,
          subnetIds: this.dfSharedTgwConfig.gatewayVpc.customerEdgeSubnetIds,
          transitGatewayId: this.customerEdgeTransitGateway.id,
          vpcId: this.dfSharedTgwConfig.gatewayVpc.vpcId,
          tags: {
            Name: 'Edge-Transit-Gateway-Attachment',
            Production: 'true',
          },
        });

      this.customerEdgeTransitGatewayRouteTable =
        new Ec2TransitGatewayRouteTable(this, 'transit-gateway-route-table', {
          provider: dfSharedTgwConfig.provider,
          transitGatewayId: this.customerEdgeTransitGateway.id,
          tags: {
            Name: 'edge',
            Production: 'true',
          },
        });

      new Ec2TransitGatewayRouteTableAssociation(
        this,
        'transit-gateway-route-table-association',
        {
          provider: dfSharedTgwConfig.provider,
          transitGatewayAttachmentId:
            this.customerEdgeTransitGatewayAttachment.id,
          transitGatewayRouteTableId:
            this.customerEdgeTransitGatewayRouteTable.id,
        }
      );

      new Ec2TransitGatewayRouteTablePropagation(
        this,
        'transit-gateway-route-table-propagation',
        {
          provider: dfSharedTgwConfig.provider,
          transitGatewayAttachmentId:
            this.customerEdgeTransitGatewayAttachment.id,
          transitGatewayRouteTableId:
            this.customerEdgeTransitGatewayRouteTable.id,
        }
      );

      const logGroup = new CloudwatchLogGroup(
        this,
        'edge-transit-gateway-log-group',
        {
          provider: dfSharedTgwConfig.provider,
          name: 'edge-transit-gateway-logs',
          retentionInDays: 365,
          kmsKeyId: dfSharedTgwConfig.gatewayVpc.flowLogKmsArn,
          tags: {
            Name: 'Edge-Transit-Gateway-Logs',
            Production: 'true',
          },
        }
      );

      new FlowLog(this, 'edge-transit-gateway-flow-log', {
        provider: dfSharedTgwConfig.provider,
        iamRoleArn: dfSharedTgwConfig.gatewayVpc.flowLogRoleArn,
        logDestination: logGroup.arn,
        trafficType: 'ALL',
        transitGatewayId: this.customerEdgeTransitGateway.id,
        maxAggregationInterval: 60,
        tags: {
          Name: 'Edge-Transit-Gateway-Flow-Log',
          Production: 'true',
        },
      });

      // Route from Edge TGW to Cardinal TGW
      dfSharedTgwConfig.gatewayVpc.customerEdgeRouteTableIds.forEach(
        (id, i) => {
          new Route(this, `edge-tgw-to-cardinal-tgw-${i}`, {
            provider: dfSharedTgwConfig.provider,
            routeTableId: id,
            destinationCidrBlock: '0.0.0.0/0',
            transitGatewayId: this.transitGateway.id,
          });
        }
      );
    }
  }

  /**
   * @param {string} constructId - The id for the terraform resource
   * @param {string} logDestinationType - The type of log destination
   * @param {string} logDestination - The log destination
   * @return {FlowLog} - The Flow Log resource
   */
  private createTgwFlowLog(
    constructId: string,
    logDestinationType: 'cloud-watch-logs' | 's3',
    logDestination: string
  ): FlowLog {
    // * Reuse Ingress VPC Flow Log KMS Key and Role
    return new FlowLog(this, constructId, {
      provider: this.dfSharedTgwConfig.provider,
      iamRoleArn:
        logDestinationType === 's3'
          ? undefined
          : this.dfSharedTgwConfig.gatewayVpc.flowLogRoleArn,
      logDestination: logDestination,
      logDestinationType: logDestinationType,
      trafficType: 'ALL',
      transitGatewayId: this.transitGateway.id,
      maxAggregationInterval: 60,
      tags: { Name: constructId },
    });
  }
}
