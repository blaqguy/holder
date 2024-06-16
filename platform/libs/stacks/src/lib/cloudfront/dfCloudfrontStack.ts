import { CloudfrontDistribution } from '@cdktf/provider-aws/lib/cloudfront-distribution';
import { RemoteStack, StackConfig } from '../stacks';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { TerraformProvider } from 'cdktf';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AccountProviderConfig, Constants, Utils } from '@dragonfly/utils';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';

interface DfCloudfrontConfig {
  acmCert: AcmCertificate;
  albResource: Alb;
  aliasName: string;
  webAclArn: string;
  alias: string;
  masterAccountProviderConfig: AccountProviderConfig;
}

/**
 *
 */
export class DfCloudfrontStack extends RemoteStack {
  private masterProvider: TerraformProvider;

  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   * @param {DfCloudfrontConfig} dfCloudfrontConfig - Cloudfront config used in the stack
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private dfCloudfrontConfig: DfCloudfrontConfig
  ) {
    super(stackName, stackConfig);
    this.masterProvider = this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.LEGACY,
      forAccount: dfCloudfrontConfig.masterAccountProviderConfig,
    });

    this.createCloudfrontDistribution(stackName, dfCloudfrontConfig);
  }

  /**
   * Creates an AWS Cloudfront Distribution using an internal alb as the origin
   * @param {string} stackName - The name of the stack
   * @param {DfCloudfrontConfig} dfCloudfrontConfig - stack config
   */
  private createCloudfrontDistribution(
    stackName: string,
    dfCloudfrontConfig: DfCloudfrontConfig
  ) {
    // Master Provider
    const rootZone = new DataAwsRoute53Zone(this, 'RootDragonflyFtZone', {
      provider: this.masterProvider,
      name: 'dragonflyft.com',
    });

    const distribution = new CloudfrontDistribution(this, stackName, {
      comment: 'Dragonflyft Cloudfront Distribution',
      enabled: true,
      aliases: [dfCloudfrontConfig.aliasName],
      defaultCacheBehavior: {
        allowedMethods: [
          'GET',
          'HEAD',
          'OPTIONS',
          'PUT',
          'POST',
          'PATCH',
          'DELETE',
        ],
        cachedMethods: ['GET', 'HEAD'],
        targetOriginId: dfCloudfrontConfig.albResource.arn,
        viewerProtocolPolicy: 'https-only',
        // viewerProtocolPolicy: 'redirect-to-https',
        compress: true,
        forwardedValues: {
          queryString: true,
          headers: ['*'],
          cookies: {
            forward: 'all',
          },
        },
      },
      origin: [
        {
          domainName: dfCloudfrontConfig.albResource.dnsName,
          originId: dfCloudfrontConfig.albResource.arn,
          customOriginConfig: {
            httpPort: 80,
            httpsPort: 443,
            originProtocolPolicy: 'https-only',
            originSslProtocols: ['TLSv1.2'],
          },
        },
      ],
      restrictions: {
        geoRestriction: {
          restrictionType: 'none',
        },
      },
      viewerCertificate: {
        acmCertificateArn: dfCloudfrontConfig.acmCert.arn,
        sslSupportMethod: 'sni-only',
        minimumProtocolVersion: 'TLSv1.2_2021',
      },
      webAclId: dfCloudfrontConfig.webAclArn,
      tags: { Name: stackName },
    });

    // Master Provider Cloudfront alias record
    new Route53Record(
      this,
      Utils.createStackResourceId(this.stackUuid, 'DistributionRecord'),
      {
        provider: this.masterProvider,
        name: dfCloudfrontConfig.aliasName,
        type: 'CNAME',
        zoneId: rootZone.id,
        records: [distribution.domainName],
        ttl: 300,
      }
    );
  }
}
