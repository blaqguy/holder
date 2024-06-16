import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { TerraformProvider } from 'cdktf';
import { AccountProviderConfig, Constants } from '@dragonfly/utils';
import { RemoteStack } from '@dragonfly/stacks';

/**
 * Represents configuration options for creating a Route53 record in DFT's Private Hosted Zone.
 * @property {RemoteStack} requestingStack - The stack that is requesting the Route53 record.
 * @property {'CNAME' | 'A'} recordType - The type of Route53 record to create.
 * @property {string} dnsName - The DNS name of the Route53 record.
 * @property {string[]} awsPrivateIpOrPrivateDns - The private IP or private DNS of the resource that the Route53 record is pointing to.
 * @property {Constants.AWS_REGION_ALIASES} - The region the resource is deployed in. This is for creating the Shared Network Provider.
 * @property {AccountProviderConfig} accountProviderConfig - The account provider configuration for the account the resource is deployed in.
 */
interface Route53AttachmentConfig {
  /**
   * The stack that is requesting the Route53 record
   */
  requestingStack: RemoteStack;
  /**
   * The type of Route53 record to create
   */
  recordType: 'CNAME' | 'A';
  /**
   * The DNS name of the Route53 record
   */
  dnsName: string;
  /**
   * The private IP or private DNS of the resource that the Route53 record is pointing to
   */
  awsPrivateIpOrPrivateDns: string[];
  /**
   * The region the resource is deployed in. This is for creating the Shared Network Provider
   */
  region: Constants.AWS_REGION_ALIASES;
  /**
   * The account provider configuration for the account the resource is deployed in
   */
  accountProviderConfig: AccountProviderConfig;
}

/**
 * Creates a Route53 record in DFT's Private Hosted Zone
 */
export class Route53Attachment {
  /**
   * @param {Route53AttachmentConfig} config: The configuration for creating the Route53 record.
   */
  constructor(config: Route53AttachmentConfig) {

    const sharedNetworkProvider: TerraformProvider =
      config.requestingStack.createAwsProvider({
        supportedRegion: config.region,
        forAccount: config.accountProviderConfig,
      });

    const route53Zone = new DataAwsRoute53Zone(
      config.requestingStack,
      `${config.dnsName}privateZoneLookup`,
      {
        provider: sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    new Route53Record(config.requestingStack, `${config.dnsName}R53Record`, {
      provider: sharedNetworkProvider,
      name: `${config.dnsName}.${route53Zone.name}`,
      type: config.recordType,
      zoneId: route53Zone.zoneId,
      records: config.awsPrivateIpOrPrivateDns,
      ttl: 300,
    });
  }
}
