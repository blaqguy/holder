import { Vpc } from '@cdktf/provider-aws/lib/vpc';
import { RemoteStack, StackConfig } from '../stacks';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import { VpnGateway } from '@cdktf/provider-aws/lib/vpn-gateway';
import { VpnConnection } from '@cdktf/provider-aws/lib/vpn-connection';
import { CustomerGateway } from '@cdktf/provider-aws/lib/customer-gateway';
import { VpnConnectionRoute } from '@cdktf/provider-aws/lib/vpn-connection-route';

/**
 * Sydney Westpac Stack
 * ! Edge Case | Lucien has more details
 */
export class SydneyWestPacStack extends RemoteStack {
  /**
   * @param {string} stackName - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   */
  constructor(stackName: string, stackConfig: StackConfig) {
    super(stackName, stackConfig);

    const provider = this.sydneyProvider;

    /**
     * VPC Shenanigans
     */
    const vpc = new Vpc(this, 'sydney-westpac-vpc', {
      provider: provider,
      cidrBlock: '198.18.1.0/24',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Name: 'sydney-westpac-vpc',
      },
    });

    const subnetConfig = [
      {
        subnetName: 'sydney-westpac-private-subnet',
        cidrBlock: '198.18.1.0/26',
        az: 'ap-southeast-2a',
      },
      {
        subnetName: 'sydney-westpac-transit-subnet',
        cidrBlock: '198.18.1.64/26',
        az: 'ap-southeast-2a',
      },
      {
        subnetName: 'sydney-westpac-management-subnet',
        cidrBlock: '198.18.1.128/26',
        az: 'ap-southeast-2a',
      },
      {
        subnetName: 'sydney-westpac-internet-subnet',
        az: 'ap-southeast-2a',
        cidrBlock: '198.18.1.192/26',
      },
    ];

    subnetConfig.forEach((config) => {
      new Subnet(this, config.subnetName, {
        provider: provider,
        vpcId: vpc.id,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.az,
        tags: {
          Name: config.subnetName,
        },
      });
    });

    /**
     * VPN? Shenanigans
     */

    const customerGateway = new CustomerGateway(
      this,
      'sydney-westpac-customer-gateway',
      {
        provider: provider,
        bgpAsn: '65000',
        ipAddress: '202.7.37.4',
        type: 'ipsec.1',
        tags: {
          Name: 'sydney-westpac-customer-gateway',
        },
      }
    );

    const vpnGateway = new VpnGateway(this, 'sydney-westpac-vpn-gateway', {
      provider: provider,
      vpcId: vpc.id,
      tags: {
        Name: 'sydney-westpac-vpn-gateway',
      },
    });

    const vpnConnection = new VpnConnection(this, 'sydney-westpac-vpn-connection', {
      provider: provider,
      customerGatewayId: customerGateway.id,
      vpnGatewayId: vpnGateway.id,
      type: 'ipsec.1',
      staticRoutesOnly: true,
      tunnel1StartupAction: 'start',
      tunnel2StartupAction: 'start',
      tunnel1Phase1DhGroupNumbers: [20],
      tunnel1Phase2DhGroupNumbers: [20],
      tunnel1Phase1EncryptionAlgorithms: ['AES256'],
      tunnel1Phase2EncryptionAlgorithms: ['AES256'],
      tunnel1Phase1IntegrityAlgorithms: ['SHA2-256'],
      tunnel1Phase2IntegrityAlgorithms: ['SHA2-256'],
      tunnel2Phase1DhGroupNumbers: [20],
      tunnel2Phase2DhGroupNumbers: [20],
      tunnel2Phase1EncryptionAlgorithms: ['AES256'],
      tunnel2Phase2EncryptionAlgorithms: ['AES256'],
      tunnel2Phase1IntegrityAlgorithms: ['SHA2-256'],
      tunnel2Phase2IntegrityAlgorithms: ['SHA2-256'],
      tags: {
        Name: 'sydney-westpac-vpn-connection',
      },
    });

    new VpnConnectionRoute(this, 'sydney-westpac-vpn-connection-route', {
      provider: provider,
      dependsOn: [vpnConnection],
      destinationCidrBlock: '202.7.34.0/25',
      vpnConnectionId: vpnConnection.id,
    });
  }
}
