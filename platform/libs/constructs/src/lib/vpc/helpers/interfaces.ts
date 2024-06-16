import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import {
  Customers,
  CustomerDefinition,
  ZonalSubnetCidrs,
} from '@dragonfly/utils';

/**
 * Represents configuration options for creating a base VPC construct in Dragonfly Technologies.
 * @property {string} vpcCidr - The CIDR Block of the VPC being created.
 * @property {AwsProvider} provider - The Terraform Provider used to create the VPC.
 * @property {string} federatedAccountId - Account ID of the target account.
 * @property {boolean} [isolatedNetwork=false] - Determines if the VPC is attached to a Shared Network Topology.
 * @property {gatewayVpc} [gatewayVpc=false] - Determines if the VPC is a Gateway VPC.
 */
export interface DfBaseVpcConstructConfig {
  /**
   * The CIDR Block of the VPC being created
   */
  vpcCidr: string;
  /**
   * The Terraform Provider used to create the VPC
   */
  provider: AwsProvider;
  /**
   * Account ID of target account
   */
  federatedAccountId: string;
  /**
   * Determines if the VPC is attached to a Shared Network Topology
   */
  isolatedNetwork?: boolean;
  /**
   * The CIDR Blocks of the Transit Subnets
   */
  transitSubnetCidrs?: ZonalSubnetCidrs;
  /**
   * Determines if the VPC is a Gateway VPC
   */
  gatewayVpc?: boolean;
}

/**
 * Represents configuration options for creating a subnet.
 * @property {string} id - The id for the subnet construct.
 * @property {string} subnetName - The name of the subnet.
 * @property {ZonalSubnetCidrs} azCidrRanges - The CIDR Blocks of the subnets.
 * @property {boolean} isPublic - Determines if the subnet is public or private.
 * @property {Subnet[]} subnetArray - The array of subnets to add the subnet to
 */
export interface CreateSubnetParams {
  /**
   * The id for the subnet construct
   */
  id: string;
  /**
   * The name of the subnet
   */
  subnetName: string;
  /**
   * The purpose of the subnet. What is it used for?
   */
  purpose: string;
  /**
   * The CIDR Blocks of the subnets
   */
  azCidrRanges: ZonalSubnetCidrs;
  /**
   * Determines if the subnet is public or private
   */
  isPublic: boolean;
}

export interface CreateCustomerSubnetParams {
  /**
   * The id for the subnet construct
   */
  id: string;
  /**
   * The list of client subnets
   */
  customers: Customers;
  externalCustomerDefinitions: CustomerDefinition[];
  subnetIndex: string;
}

/**
 * Represents configuration options for creating a route table.
 * @property {string} id - The id for the route table construct.
 * @property {string} routeTableName - The name of the route table.
 * @property {boolean} isPublic - Determines if the route table is public or private.
 */
export interface CreateRouteTableParams {
  /**
   * The id for the route table construct
   */
  id: string;
  /**
   * The name of the route table
   */
  routeTableName: string;
  /**
   * Determines if the route table is public or private
   */
  isPublic: boolean;
}
