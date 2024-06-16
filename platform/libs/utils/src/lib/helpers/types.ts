/**
 * Represent VPC CIDR blocks for DFT accounts in active DFT regions.
 * @type {Object} regionalVpcCidrs
 * @property {string} legacy - The VPC CIDR block for the Legacy Region | US-EAST-1.
 * @property {string} primary - The VPC CIDR block for the Primary Region | US-EAST-2.
 * @property {string} recovery - The VPC CIDR block for the Recovery Region | US-WEST-2.
 */
export type RegionalVpcCidrs = {
  legacy: string;
  primary: string;
  recovery: string;
};

/**
 * Represents subnet CIDR blocks for availability zones in a VPC.
 * @type {Object} ZonalSubnetCidrs
 * @property {string} azA - The Subnet CIDR block for Availability Zone A.
 * @property {string} azB - The Subnet CIDR block for Availability Zone B.
 * @property {string} azC - The Subnet CIDR block for Availability Zone C.
 */
export type ZonalSubnetCidrs = {
  azA: string;
  azB: string;
  azC?: string;
};

export interface CustomerSubnet {
  subnetName: string;
  purpose: string;
  azCidrRanges: ZonalSubnetCidrs;
  customerNat?: {
    uat: string;
    prod: string;
  };
}
// ! Move this
export interface Customers {
  eastWestBank?: CustomerSubnet;
  santander?: CustomerSubnet;
  muob?: CustomerSubnet;
  eb?: CustomerSubnet;
  shared?: CustomerSubnet;
  stateStreet?: CustomerSubnet;
  ist?: CustomerSubnet;
}

/**
 * Represents the various CIDR blocks used in a Gateway VPC.
 * @type {Object} GatewayVpcCidrs
 * @property {string} gatewayVpcCidr - The VPC CIDR block for the Gateway VPC.
 * @property {string} clientVpnCidr - The CIDR block for the Client VPN. This has to be different from the VPC CIDR block.
 * @property {string[]} additionalCidrs - Additional CIDR blocks that are used in the Gateway VPC.
 * @property {Object} subnets - The CIDR blocks for the various subnets in the Gateway VPC.
 */
export type GatewayVpcCidrs = {
  gatewayVpcCidr: string;
  clientVpnCidr: string;
  additionalCidrs?: string[];
  subnets: {
    egress: ZonalSubnetCidrs;
    archReserved: ZonalSubnetCidrs;
    internet: ZonalSubnetCidrs;
    internetXL?: ZonalSubnetCidrs;
    transit: ZonalSubnetCidrs;
    clientVpn: ZonalSubnetCidrs;
    customerEdge: ZonalSubnetCidrs;
    customers?: Customers;
    globalProtect?: string;
    /** Privately Used Public Ips */
    pupiCustomerEdge?: ZonalSubnetCidrs;
  };
};

/**
 * Represents the various CIDR blocks used in a Shared Network Account.
 * @type {Object} SharedNetworkAccountCidrs
 * @property {Object} gateway - The CIDR blocks for the Gateway VPCs in the Shared Network Account.
 */
export type GatewayVpcRegionalCidrs = {
  legacy: GatewayVpcCidrs;
  primary: GatewayVpcCidrs;
  recovery: GatewayVpcCidrs;
};
