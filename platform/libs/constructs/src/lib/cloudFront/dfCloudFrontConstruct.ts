import {
  CloudfrontDistribution,
  CloudfrontDistributionDefaultCacheBehaviorFunctionAssociation,
} from '@cdktf/provider-aws/lib/cloudfront-distribution';
import { CloudfrontFunction } from '@cdktf/provider-aws/lib/cloudfront-function';
import { DataAwsCanonicalUserId } from '@cdktf/provider-aws/lib/data-aws-canonical-user-id';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { S3BucketAcl } from '@cdktf/provider-aws/lib/s3-bucket-acl';
import { Utils } from '@dragonfly/utils';
import { Token } from 'cdktf';
import { Construct } from 'constructs';
import { DfPrivateBucketConstruct } from '../constructs';

export interface DfCloudfrontFunctionConfigs {
  viewerRequestFunctionCode?: {
    type: 'viewer-request';
    code: string;
    enabled: boolean;
  };
  viewerResponseFunctionCode?: {
    type: 'viewer-response';
    code: string;
    enabled: boolean;
  };
  originRequestFunctionCode?: {
    type: 'origin-request';
    code: string;
    enabled: boolean;
  };
  originReponseFunctionCode?: {
    type: 'origin-response';
    code: string;
    enabled: boolean;
  };
}

export interface DfCloudFrontConfig {
  provider: AwsProvider;
  cnames?: string[];
  originDomainName: string;
  originId: string;
  certificateArn: string;
  webAclArn: string;
  masterProvider: AwsProvider;
  r53RecordName: string;
  bucketNameOverride?: string;
  certImported?: boolean;
  rootZoneNameOverride?: string;
  originReadTimeout?: number;
  functionConfigs?: DfCloudfrontFunctionConfigs;
  originSslProtocolsOverride?: string[];
  securityPolicyOverride?: string;
}

/**
 * Dragonfly's implementation of CloudFront
 */
export class DfCloudFrontConstruct {
  private publicIngressCdn: CloudfrontDistribution;
  /**
   * @param {Construct} scope - The parent stack
   * @param {string} id - A logical identifier for the construct
   * @param {DfCloudFrontConfig} config - Configuration for the CloudFront
   */
  constructor(
    private scope: Construct,
    private id: string,
    private config: DfCloudFrontConfig
  ) {
    const current = new DataAwsCanonicalUserId(scope, `${id}-current`, {});

    const loggingBucket = new DfPrivateBucketConstruct(
      scope,
      `${id}-cloudfront-logging-bucket`,
      {
        bucketName:
          config.bucketNameOverride || `${id}-cloudfront-logging-bucket`,
        keyProps: {
          name: `${id}-cloudfront-logging-key`,
          description: `${id}-cloudfront-logging-key`,
        },
        provider: config.provider,
        ownership: 'BucketOwnerPreferred',
      }
    );

    new S3BucketAcl(scope, `${id}-public-ingress-cdn-logs-acl`, {
      bucket: loggingBucket.bucketId,
      provider: config.provider,
      accessControlPolicy: {
        grant: [
          {
            grantee: {
              id: Token.asString(current.id),
              type: 'CanonicalUser',
            },
            permission: 'FULL_CONTROL',
          },
        ],
        owner: {
          id: Token.asString(current.id),
        },
      },
    });

    this.publicIngressCdn = new CloudfrontDistribution(
      scope,
      `${id}-public-ingress-cdn`,
      {
        lifecycle: {
          ignoreChanges: ['web_acl_id'],
        },
        provider: config.provider,
        aliases: config.cnames,
        enabled: true,
        origin: [
          {
            domainName: config.originDomainName,
            originId: config.originId,
            customOriginConfig: {
              httpPort: 80,
              httpsPort: 443,
              originProtocolPolicy: 'https-only',
              originSslProtocols: config.originSslProtocolsOverride ?? [
                'TLSv1.2',
              ],
              originReadTimeout: config.originReadTimeout ?? 60,
            },
            connectionAttempts: 1,
          },
        ],
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
          targetOriginId: config.originId,
          viewerProtocolPolicy: 'redirect-to-https',
          compress: true,
          forwardedValues: {
            queryString: true,
            headers: ['*'],
            cookies: {
              forward: 'all',
            },
          },
          functionAssociation: this.config.functionConfigs
            ? this.createFunctions()
            : undefined,
        },
        restrictions: {
          geoRestriction: {
            restrictionType: 'none',
          },
        },
        viewerCertificate: {
          acmCertificateArn: config.certificateArn,
          sslSupportMethod: 'sni-only',
          minimumProtocolVersion:
            config.securityPolicyOverride ?? 'TLSv1.2_2021',
        },
        loggingConfig: {
          bucket: `${loggingBucket.bucketId}.s3.amazonaws.com`,
          includeCookies: false,
        },
        webAclId: config.webAclArn,
      }
    );
    Utils.addPublicTag(this.publicIngressCdn);

    const dragonflyPublicZone = new DataAwsRoute53Zone(
      scope,
      `${id}-dragonfly-public-zone`,
      {
        provider: config.masterProvider,
        name: config.rootZoneNameOverride
          ? config.rootZoneNameOverride
          : 'dragonflyft.com',
      }
    );

    if (!config.certImported) {
      const publicIngressRecord = new Route53Record(
        scope,
        `${id}-public-ingress-cdn-record`,
        {
          provider: config.masterProvider,
          name: config.r53RecordName,
          type: 'CNAME',
          zoneId: dragonflyPublicZone.zoneId,
          records: [this.publicIngressCdn.domainName],
          ttl: 300,
        }
      );
      Utils.addPublicTag(publicIngressRecord);
    }
  }

  private createFunctions(): CloudfrontDistributionDefaultCacheBehaviorFunctionAssociation[] {
    const functionConfigs = Object.values(this.config.functionConfigs).map(
      (config) => {
        const func = new CloudfrontFunction(
          this.scope,
          `${this.id}-${config.type}`,
          {
            provider: this.config.provider,
            name: `${this.id}-${config.type}`,
            code: config.code,
            runtime: 'cloudfront-js-2.0',
            publish: true,
          }
        );

        return {
          eventType: config.type,
          functionArn: func.arn,
          enabled: config.enabled,
        };
      }
    );

    return functionConfigs.map((config) => {
      if (config.enabled) {
        return {
          eventType: config.eventType,
          functionArn: config.functionArn,
        };
      }
    });
  }

  public get publicIngressCdnDomainName() {
    return this.publicIngressCdn.domainName;
  }
}
