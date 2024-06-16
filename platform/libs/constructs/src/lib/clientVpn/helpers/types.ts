import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DfGatewayVpcConstruct } from '../../vpc';

/**
 * @type {string} DftRegion - Active DFT region names
 */
type DftRegion = 'legacy' | 'primary' | 'recovery';

/**
 * @type {Object} RegionConfig - Regional configuration object for the Client VPN construct
 * @property {AwsProvider} provider - The provider to use for the creation of the Client VPN construct
 * @property {string} gatewayVpcCidr - The CIDR block of the VPC to use for the creation of the Client VPN construct. Must be either the ingress or gateway VPC CIDR block
 * @property {string} vpnCidrBlock - The CIDR block of the VPN to use for the creation of the Client VPN construct
 */
export type RegionConfig<ProviderType = AwsProvider | null> = {
  provider: ProviderType;
  vpc: DfGatewayVpcConstruct;
  gatewayVpcCidr: string;
  vpnCidrBlock: string;
};

export type RegionalConfig = {
  [key in DftRegion]: RegionConfig<
    key extends 'legacy' ? AwsProvider | null : AwsProvider
  >;
};
