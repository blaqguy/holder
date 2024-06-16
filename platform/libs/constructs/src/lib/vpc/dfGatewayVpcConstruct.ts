import { RouteTable } from '@cdktf/provider-aws/lib/route-table';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import { Construct } from 'constructs';
import { DfBaseVpcConstruct } from './helpers/dfBaseVpcConstruct';
import {
  CreateCustomerSubnetParams,
  CreateRouteTableParams,
  CreateSubnetParams,
  DfBaseVpcConstructConfig,
} from './helpers/interfaces';
import { DataAwsAvailabilityZones } from '@cdktf/provider-aws/lib/data-aws-availability-zones';
import { InternetGateway } from '@cdktf/provider-aws/lib/internet-gateway';
import { Route } from '@cdktf/provider-aws/lib/route';
import { RouteTableAssociation } from '@cdktf/provider-aws/lib/route-table-association';
import {
  Utils,
  DfAccounts,
  GatewayVpcCidrs,
  Constants,
  CustomerDefinition,
  AccountDefinition,
  CustomerSubnet,
} from '@dragonfly/utils';
import { Fn } from 'cdktf';
import { Eip } from '@cdktf/provider-aws/lib/eip';
import { NatGateway } from '@cdktf/provider-aws/lib/nat-gateway';
import { RamResourceShare } from '@cdktf/provider-aws/lib/ram-resource-share';
import { RamResourceAssociation } from '@cdktf/provider-aws/lib/ram-resource-association';
import { RamPrincipalAssociation } from '@cdktf/provider-aws/lib/ram-principal-association';
import { Route53Zone } from '@cdktf/provider-aws/lib/route53-zone';
import { VpcIpv4CidrBlockAssociation } from '@cdktf/provider-aws/lib/vpc-ipv4-cidr-block-association';

/**
 * @interface gatewayVpcConfig - Configuration object containing necessary parameters for a gateway VPC.
 * @extends DfBaseVpcConstructConfig
 * @property {GatewayVpcCidrs} gatewayVpcCidrs - The CIDR blocks for the various subnets in the Gateway VPC.
 */
interface gatewayVpcConfig extends DfBaseVpcConstructConfig {
  /**
   * The Gateway VPC CIDR blocks Objects for the various subnets in the Gateway VPC.
   */
  gatewayVpcCidrs: GatewayVpcCidrs;
  /**
   * The region to deploy the Gateway VPC in.
   */
  region: Constants.AWS_REGION_ALIASES;
  /**
   * The provider for the Gateway VPC.
   */
  account: AccountDefinition;
  externalCustomers: CustomerDefinition[];
  deployHybridNetworking: boolean;
}

export type CustomerObjectSubnet = {
  customerName: string;
  azName: string;
  subnet: Subnet;
};

/**
 * Represents a construct for creating a Dragonfly Gateway VPC.
 * @extends DfBaseVpcConstruct
 */
export class DfGatewayVpcConstruct extends DfBaseVpcConstruct {
  private availabilityZones: DataAwsAvailabilityZones;
  public readonly transitSubnets: Subnet[] = [];
  private egressSubnets: Subnet[] = [];
  private archReservedSubnets: Subnet[] = [];
  private internetBlockSubnets: Subnet[] = [];
  private internetXLBlockSubnets: Subnet[] = [];
  private cvpnSubnets: Subnet[] = [];
  private publicSubnets: Subnet[] = [];
  private customerEdgeSubnets: Subnet[] = [];
  private pupiCustomerEdgeSubnets: Subnet[] = [];
  private globalProtectSubnet: Subnet; // ONLY IN NONPROD SHARED NETWORK
  public readonly publicRouteTable: RouteTable;
  private privateRouteTables: RouteTable[] = [];
  private customerEdgeRouteTables: RouteTable[] = [];
  private privateZone: Route53Zone;
  private customerObjectSubnet: CustomerObjectSubnet[] = [];
  public readonly customerEdgeNatGateways: NatGateway[] = [];
  public readonly pupiCustomerEdgeNatGateways: NatGateway[] = [];

  /**
   * @param {Construct} scope - The parent stack
   * @param {string} id - Logical id for the construct
   * @param {gatewayVpcConfig} config - Configuration object containing necessary parameters for a gateway VPC.
   */
  constructor(
    scope: Construct,
    id: string,
    private readonly config: gatewayVpcConfig
  ) {
    super(scope, id, config);

    // * Attached additional CIDR blocks to the VPC if provided
    if (config.gatewayVpcCidrs.additionalCidrs) {
      config.gatewayVpcCidrs.additionalCidrs.forEach((cidr, index) => {
        new VpcIpv4CidrBlockAssociation(
          this,
          `${id}-additional-cidr-${index}`,
          {
            provider: config.provider,
            vpcId: this.vpc.id,
            cidrBlock: cidr,
          }
        );
      });
    }

    this.availabilityZones = new DataAwsAvailabilityZones(this, `${id}-zones`, {
      provider: config.provider,
      state: 'available',
    });

    /**
     * * Create Subnets
     */
    this.transitSubnets = this.createSubnets({
      id: id,
      subnetName: 'transit',
      purpose: 'Subnet for Transit Gateway',
      azCidrRanges: config.gatewayVpcCidrs.subnets.transit,
      isPublic: false,
    });

    this.egressSubnets = this.createSubnets({
      id: id,
      subnetName: 'egress',
      purpose: 'Subnet for NAT Gateways',
      azCidrRanges: config.gatewayVpcCidrs.subnets.egress,
      isPublic: true,
    });

    this.archReservedSubnets = this.createSubnets({
      id: id,
      subnetName: 'architecture-reserved',
      purpose: 'Subnet for PST specific resources',
      azCidrRanges: config.gatewayVpcCidrs.subnets.archReserved,
      isPublic: false,
    });

    this.internetBlockSubnets = this.createSubnets({
      id: id,
      subnetName: 'internet',
      purpose: 'Subnet for Public Ingress',
      azCidrRanges: config.gatewayVpcCidrs.subnets.internet,
      isPublic: true,
    });

    this.cvpnSubnets = this.createSubnets({
      id: id,
      subnetName: 'client-vpn',
      purpose: 'Subnet for client vpn',
      azCidrRanges: config.gatewayVpcCidrs.subnets.clientVpn,
      isPublic: true,
    });

    this.customerEdgeSubnets = this.createSubnets({
      id: id,
      subnetName: 'customer-edge',
      purpose: 'Subnet for customer connectivity',
      azCidrRanges: config.gatewayVpcCidrs.subnets.customerEdge,
      isPublic: false,
    });

    this.publicSubnets = this.egressSubnets.concat(
      this.internetBlockSubnets,
      this.cvpnSubnets,
      this.internetXLBlockSubnets
    );

    if (config.gatewayVpcCidrs.subnets.internetXL) {
      this.internetXLBlockSubnets = this.createSubnets({
        id: id,
        subnetName: 'internetXL',
        purpose: 'Additional Subnet space for Public Ingress',
        azCidrRanges: config.gatewayVpcCidrs.subnets.internetXL,
        isPublic: true,
      });

      this.publicSubnets = this.publicSubnets.concat(
        this.internetXLBlockSubnets
      );

      if (config.gatewayVpcCidrs.subnets.pupiCustomerEdge) {
        this.pupiCustomerEdgeSubnets = this.createSubnets({
          id: id,
          subnetName: 'pupi-customer-edge',
          purpose:
            'Subnet for customer connectivity using private used public ip addresses',
          azCidrRanges: config.gatewayVpcCidrs.subnets.pupiCustomerEdge,
          isPublic: false,
        });
      }
    }

    if (
      config.federatedAccountId ===
      DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber
    ) {
      this.globalProtectSubnet = new Subnet(
        this,
        `${id}-global-protect-subnet`,
        {
          provider: config.provider,
          vpcId: this.vpc.id,
          cidrBlock: config.gatewayVpcCidrs.subnets.globalProtect,
          availabilityZone: Fn.element(this.availabilityZones.names, 0),
          mapPublicIpOnLaunch: true,
          tags: {
            Name: `global-protect`,
          },
        }
      );

      this.publicSubnets.push(this.globalProtectSubnet);
    }

    /**
     * * "Public" Networking Components
     */
    const igw = new InternetGateway(this, `${id}-internet-gateway`, {
      provider: config.provider,
      vpcId: this.vpc.id,
      tags: { Name: `${id}-igw` },
    });

    this.publicRouteTable = this.createRouteTable({
      id: id,
      routeTableName: 'public',
      isPublic: true,
    });

    new Route(this, 'public-subnets-to-igw', {
      provider: config.provider,
      routeTableId: this.publicRouteTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id,
    });

    this.publicSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `${id}-public-subnet-rtb-association-${index}`,
        {
          provider: config.provider,
          subnetId: subnet.id,
          routeTableId: this.publicRouteTable.id,
        }
      );
    });

    /**
     * * "Private" Networking Components
     */
    for (let i = 0; i < 3; i++) {
      const privateRouteTable = this.createRouteTable({
        id: id,
        routeTableName: `private-${i + 1}`,
        isPublic: false,
      });

      const customerEdgeRouteTable = this.createRouteTable({
        id: id,
        routeTableName: `customer-edge-${i + 1}`,
        isPublic: false,
      });

      this.privateRouteTables.push(privateRouteTable);

      this.customerEdgeRouteTables.push(customerEdgeRouteTable);

      new RouteTableAssociation(
        this,
        `${id}-transit-subnet-rt-association-${i}`,
        {
          provider: config.provider,
          subnetId: this.transitSubnets[i].id,
          routeTableId: privateRouteTable.id,
        }
      );

      new RouteTableAssociation(
        this,
        `${id}-arch-reserved-subnet-rtb-association-${i}`,
        {
          provider: config.provider,
          subnetId: this.archReservedSubnets[i].id,
          routeTableId: privateRouteTable.id,
        }
      );

      new RouteTableAssociation(
        this,
        `${id}-private-nat-subnet-rtb-association-${i}`,
        {
          provider: config.provider,
          subnetId: this.customerEdgeSubnets[i].id,
          routeTableId: customerEdgeRouteTable.id,
        }
      );

      if (
        config.gatewayVpcCidrs.subnets.pupiCustomerEdge &&
        i < this.pupiCustomerEdgeSubnets.length
      ) {
        new RouteTableAssociation(
          this,
          `${id}-pupi-customer-edge-rtb-association-${i}`,
          {
            provider: config.provider,
            subnetId: this.pupiCustomerEdgeSubnets[i].id,
            routeTableId: customerEdgeRouteTable.id,
          }
        );
      }

      const ngwEip = new Eip(this, `natGatewayEip-${i}`, {
        provider: config.provider,
        vpc: true,
        tags: { Name: `${id}-natGatewayEip-${i + 1}` },
        dependsOn: [igw],
      });

      const ngw = new NatGateway(this, `natGateway-${i}`, {
        provider: config.provider,
        allocationId: ngwEip.id,
        subnetId: this.egressSubnets[i].id,
        tags: { Name: `${id}natGateway-${i + 1}` },
      });

      new Route(this, `ngwRoute-${i}`, {
        provider: config.provider,
        routeTableId: privateRouteTable.id,
        destinationCidrBlock: '0.0.0.0/0',
        natGatewayId: ngw.id,
      });
    }

    /**
     * * "Hybrid" Networking Components
     */
    if (config.deployHybridNetworking) {
      this.customerEdgeSubnets.forEach((subnet, index) => {
        const customerEdgeNgw = new NatGateway(
          this,
          `customer-edge-nat-${index}`,
          {
            provider: config.provider,
            subnetId: subnet.id,
            connectivityType: 'private',
            tags: {
              Name: `Customer-Edge-Nat-${index + 1}`,
              Production: 'true',
            },
          }
        );

        this.customerEdgeNatGateways.push(customerEdgeNgw);
      });

      this.pupiCustomerEdgeSubnets.forEach((subnet, index) => {
        const pupiCustomerEdgeNgw = new NatGateway(
          this,
          `pupi-customer-edge-nat-${index}`,
          {
            provider: config.provider,
            subnetId: subnet.id,
            connectivityType: 'private',
            tags: {
              Name: `PUPI-Customer-Edge-Nat-${index + 1}`,
              Production: 'true',
            },
          }
        );

        this.pupiCustomerEdgeNatGateways.push(pupiCustomerEdgeNgw);
      });
    }

    /**
     * * Share only the prod primary transit subnets with tools VPCs for DMS
     */
    if (
      config.region === Constants.AWS_REGION_ALIASES.DF_PRIMARY &&
      config.federatedAccountId ===
        DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      const transitSubnetsShare = new RamResourceShare(
        this,
        'transit-subnets-share',
        {
          provider: config.provider,
          name: 'transit-subnets-share',
          allowExternalPrincipals: false,
          tags: {
            Name: 'transit-subnets-share',
            Production: 'true',
            Description:
              'Shared Prod Primary Transit Subnet for DMS Resources in Tools',
          },
        }
      );

      /**
       * ! ! This is sharing the customer edge subnets and not the cardinal transit subnets
       * ! The only time resource other than transit subnets are deployed here is if it needs customer connectivity which is only done through customer edge subnets
       */
      this.customerEdgeSubnets.forEach((subnet, index) => {
        new RamResourceAssociation(
          this,
          `transit-subnet-association-${index}`,
          {
            provider: config.provider,
            resourceArn: subnet.arn,
            resourceShareArn: transitSubnetsShare.arn,
          }
        );
      });

      new RamPrincipalAssociation(
        this,
        `gatewayVpcTransitSubnetsSharePrincipalAssociation`,
        {
          provider: config.provider,
          principal: Constants.TOOLS_ORG_OU_ARN,
          resourceShareArn: transitSubnetsShare.arn,
        }
      );
    }

    /**
     * * Share Internet Subnets to Spoke(Application) VPCs
     */

    const internetSubnetsShare = new RamResourceShare(
      this,
      'internet-subnets-share',
      {
        provider: config.provider,
        name: 'internet-subnets-share',
        allowExternalPrincipals: false,
        tags: {
          Name: 'internet-subnets-share',
          Production: 'true',
          Description: 'Shared Subnet for Public Ingress Resources',
        },
      }
    );

    this.internetBlockSubnets
      .concat(this.internetXLBlockSubnets)
      .concat(this.pupiCustomerEdgeSubnets)
      .forEach((subnet, index) => {
        new RamResourceAssociation(
          this,
          `internet-subnet-association-${index}`,
          {
            provider: config.provider,
            resourceArn: subnet.arn,
            resourceShareArn: internetSubnetsShare.arn,
          }
        );
      });

    let sharePrincipals: string[] = [];
    if (
      config.federatedAccountId ===
      DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      sharePrincipals = [
        Constants.IST_ORG_OU_ARN,
        Constants.UAT_ORG_OU_ARN,
        Constants.PROD_ORG_OU_ARN,
        Constants.TOOLS_ORG_OU_ARN,
      ];
    } else if (
      config.federatedAccountId ===
      DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber
    ) {
      sharePrincipals = [
        Constants.SANDBOX_ORG_OU_ARN,
        Constants.DEV_ORG_OU_ARN,
        Constants.PERFORMANCE_ORG_OU_ARN,
        Constants.QE_ORG_OU_ARN,
        Constants.TOOLS_ORG_OU_ARN,
      ];
    } else {
      sharePrincipals = [Constants.SANDBOX_ORG_OU_ARN];
    }

    sharePrincipals.forEach((principal, index) => {
      new RamPrincipalAssociation(
        this,
        `ingressVpcSubnetsSharePrincipalAssociation${index}`,
        {
          provider: config.provider,
          principal: principal,
          resourceShareArn: internetSubnetsShare.arn,
        }
      );
    });

    if (
      config.provider === null &&
      config.federatedAccountId ===
        DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      this.privateZone = new Route53Zone(this, `${id}-privateZone`, {
        provider: config.provider,
        name: 'dragonflyft.com',
        vpc: [
          {
            vpcId: this.vpc.id,
          },
        ],
        lifecycle: {
          ignoreChanges: ['vpc'],
        },
        tags: { Name: 'dragonflyft-com-private-zone' },
      });
    }

    // * Customer subnets
    let fieldToUse: string;
    // Grab the correct az subnets depending on region and account
    if (this.config.region === Constants.AWS_REGION_ALIASES.DF_PRIMARY) {
      if (
        this.config.account.name ===
        DfAccounts.getNonProdSharedNetworkAccountDef().name
      ) {
        fieldToUse = 'nonProdPrimaryGatewaySubnet';
      } else if (
        this.config.account.name ===
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().name
      ) {
        fieldToUse = 'platformSandboxPrimaryGatewaySubnet';
      } else if (
        this.config.account.name ===
        DfAccounts.getProdSharedNetworkAccountDef().name
      ) {
        fieldToUse = 'prodPrimaryGatewaySubnet';
      }
    } else if (
      this.config.region === Constants.AWS_REGION_ALIASES.DF_RECOVERY
    ) {
      if (
        this.config.account.name ===
        DfAccounts.getNonProdSharedNetworkAccountDef().name
      ) {
        fieldToUse = 'nonProdRecoveryGatewaySubnet';
      } else if (
        this.config.account.name ===
        DfAccounts.getPlatformSandboxSharedNetworkAccountDef().name
      ) {
        fieldToUse = 'platformSandboxRecoveryGatewaySubnet';
      } else if (
        this.config.account.name ===
        DfAccounts.getProdSharedNetworkAccountDef().name
      ) {
        fieldToUse = 'prodRecoveryGatewaySubnet';
      }
    }

    if (
      (this.config.region === Constants.AWS_REGION_ALIASES.DF_PRIMARY ||
        this.config.region === Constants.AWS_REGION_ALIASES.DF_RECOVERY) &&
      config.federatedAccountId ===
        DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      this.createCustomerSubnets({
        id: id,
        customers: config.gatewayVpcCidrs.subnets.customers,
        externalCustomerDefinitions: config.externalCustomers,
        subnetIndex: fieldToUse,
      });
    }
  }
  /**
   * createSubnet - Creates a subnet in each AZ for the given subnet type.
   * @param {CreateSubnetParams} params - The parameters for creating the subnet.
   * @return {Subnet[]}
   */
  private createSubnets(params: CreateSubnetParams): Subnet[] {
    const resultantSubnets: Subnet[] = [];
    Object.values(params.azCidrRanges).forEach((azCidrRange, index) => {
      const subnet = new Subnet(
        this,
        `${params.id}-${params.subnetName}-subnet-${index + 1}`,
        {
          provider: this.config.provider,
          vpcId: this.vpc.id,
          cidrBlock: azCidrRange,
          availabilityZone: Fn.element(this.availabilityZones.names, index),
          mapPublicIpOnLaunch: params.isPublic,
          tags: {
            Name: `${params.subnetName}-${index + 1}`,
            Description: params.purpose,
          },
        }
      );

      if (params.isPublic) {
        Utils.addPublicTag(subnet);
      }

      resultantSubnets.push(subnet);
    });
    return resultantSubnets;
  }

  /**
   * createCustomerSubnets - Creates a customer subnet in each AZ for the given subnet type.
   * @param {CreateCustomerSubnetParams} params - The parameters for creating the subnet.
   */
  private createCustomerSubnets(params: CreateCustomerSubnetParams): void {
    // Loop through the client list and get the key and value
    params.externalCustomerDefinitions.forEach((customerDefinition) => {
      const customerSubnet: CustomerSubnet =
        customerDefinition.gatewaySubnetConfig[params.subnetIndex];

      Object.entries(customerSubnet.azCidrRanges).forEach(
        ([key, azCidrRange], index) => {
          const clientSubnets: Subnet[] = [];
          const subnet = new Subnet(
            this,
            `${params.id}-${customerSubnet.subnetName}-subnet-${index + 1}`,
            {
              provider: this.config.provider,
              vpcId: this.vpc.id,
              cidrBlock: azCidrRange,
              availabilityZone: Fn.element(this.availabilityZones.names, index),
              mapPublicIpOnLaunch: false,
              tags: {
                Name: `${customerSubnet.subnetName}-customer-subnet-${
                  index + 1
                }`,
                Description: customerSubnet.purpose,
              },
            }
          );

          new RouteTableAssociation(
            this,
            `${params.id}-${customerSubnet.subnetName}-subnet-assoc-${
              index + 1
            }`,
            {
              provider: this.config.provider,
              subnetId: subnet.id,
              routeTableId: this.customerEdgeRouteTables[index].id,
            }
          );

          this.customerObjectSubnet.push({
            customerName: customerDefinition.customerName,
            azName: key,
            subnet: subnet,
          });

          // Share Subnet with accounts
          const ramResourceShare = new RamResourceShare(
            this,
            `${params.id}-${customerSubnet.subnetName}-subnet-${
              index + 1
            }-share`,
            {
              provider: this.config.provider,
              name: `${customerDefinition.customerName}-${customerSubnet.subnetName}-subnet-resource-share`,
              allowExternalPrincipals: false,
              tags: {
                Name: `${customerDefinition.customerName}-${customerSubnet.subnetName}-subnet-resource-share`,
                Production: 'true',
              },
            }
          );

          if (
            customerDefinition.customerName ===
            DfAccounts.customers.muob.customerName
          ) {
            const istAccount = DfAccounts.getIstAccountDef().accountNumber;
            new RamPrincipalAssociation(
              this,
              `${customerDefinition.customerName}-${istAccount}-principal-association-${azCidrRange}-for-ist`,
              {
                provider: this.config.provider,
                resourceShareArn: ramResourceShare.arn,
                principal: istAccount,
              }
            );
          }

          customerDefinition.accounts.forEach((account) => {
            new RamPrincipalAssociation(
              this,
              `${customerDefinition.customerName}-${account.accountNumber}-principal-association-${azCidrRange}`,
              {
                provider: this.config.provider,
                resourceShareArn: ramResourceShare.arn,
                principal: account.accountNumber,
              }
            );
          });
          new RamResourceAssociation(
            this,
            `${customerDefinition.customerName}-${customerSubnet.subnetName}-${azCidrRange}-subnet-share`,
            {
              provider: this.config.provider,
              resourceShareArn: ramResourceShare.arn,
              resourceArn: subnet.arn,
            }
          );

          // Push the multiAz subnet into the clients array which will then be added to the client object
          clientSubnets.push(subnet);
        }
      );
    });
  }

  /**
   *
   * @return {RouteTable} - The route table created
   * @param {CreateRouteTableParams} params - The parameters for creating the route table.
   */
  private createRouteTable(params: CreateRouteTableParams): RouteTable {
    const routeTable = new RouteTable(
      this,
      `${params.id}-${params.routeTableName}-route-table`,
      {
        provider: this.config.provider,
        vpcId: this.vpc.id,
        tags: {
          Name: `${params.routeTableName}`,
        },
      }
    );

    if (params.isPublic) {
      Utils.addPublicTag(routeTable);
    }

    return routeTable;
  }

  /**
   * @return {[string]} - The Transit Subnet IDs
   */
  public get transitSubnetIds(): string[] {
    return this.transitSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string[]} - The IDs of the private route tables.
   */
  public get privateRouteTableIds(): string[] {
    return this.privateRouteTables.map((rt) => rt.id);
  }

  /**
   * @return {string[]} - The IDs of the Customer Edge route tables.
   */
  public get customerEdgeRouteTableIds(): string[] {
    return this.customerEdgeRouteTables.map((rt) => rt.id);
  }

  /**
   * @return {string[]} - The IDs of the cvpn subnets.
   */
  public get cvpnSubnetIds(): string[] {
    return this.cvpnSubnets.map((subnet) => subnet.id);
  }

  /**
   * @return {string[]} - The IDs of the Architecture Reserved subnets.
   */
  public get archReservedSubnetIds(): string[] {
    return this.archReservedSubnets.map((subnet) => subnet.id);
  }

  /**
   * @return {string[]} - The IDs of the Internet Block subnets.
   */
  public get internetBlockSubnetIds(): string[] {
    return this.internetBlockSubnets.map((subnet) => subnet.id);
  }

  /**
   * @return {string[]} - The IDs of the Internet Block subnets.
   */
  public get internetXLBlockSubnetIds(): string[] {
    return this.internetXLBlockSubnets.map((subnet) => subnet.id);
  }

  /**
   * @return {string[]} - The IDs of the PUPI Customer Edge Subnets.
   */
  public get pupiCustomerEdgeSubnetIds(): string[] {
    return this.pupiCustomerEdgeSubnets.map((subnet) => subnet.id);
  }

  /**
   * @return {string[]} - The IDs of the Customer Edge subnets.
   */
  public get customerEdgeSubnetIds(): string[] {
    return this.customerEdgeSubnets.map((subnet) => subnet.id);
  }

  /**
   *
   * @param {string} customerName
   * @return {CustomerObjectSubnet[]}
   */
  public getClientObjectSubnetByCustomerName(
    customerName: string
  ): CustomerObjectSubnet[] {
    return this.customerObjectSubnet.filter(
      (x) => x.customerName === customerName
    );
  }

  public getCustomerSubnets(): CustomerObjectSubnet[] {
    return this.customerObjectSubnet;
  }
}
