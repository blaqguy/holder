import { AccountDefinition, Constants, Utils } from '@dragonfly/utils';
import {
  DfCloudFrontConstruct,
  DfPrivateInstanceConstruct,
  BaseLbConfig,
  DfCloudfrontFunctionConfigs,
} from '../constructs';
import {
  AlbTargetGroup,
  AlbTargetGroupHealthCheck,
} from '@cdktf/provider-aws/lib/alb-target-group';
import { Construct } from 'constructs';
import { DataTerraformRemoteStateS3 } from 'cdktf';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { AlbListenerRule } from '@cdktf/provider-aws/lib/alb-listener-rule';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Eip } from '@cdktf/provider-aws/lib/eip';

export interface PublicIngressLbConfig extends BaseLbConfig {
  albName: string;
  r53RecordName: string;
  rootZoneNameOverride?: string;
  wafId: string;
  bucketNameOverride?: string;
  instancesForTargetGroup?: DfPrivateInstanceConstruct[];
  recoveryInstancesForTargetGroup?: DfPrivateInstanceConstruct[];
  albProps?: {
    targetPort: number;
    targetProtocol: string;
    healthCheck: AlbTargetGroupHealthCheck;
    skipInternalRecord?: boolean;
    region?: Constants.AWS_REGION_ALIASES;
    certImported?: boolean;
    idleTimeout?: number;
    cloudfrontOriginReadTimeout?: number;
    cloudfrontFunctionConfig?: DfCloudfrontFunctionConfigs;
    validationRecordAlreadyExists?: boolean;
    originSslProtocolsOverride?: string[];
    securityPolicyOverride?: string;
  };
  deployToXL?: boolean;
  activeRegion?: 'recovery' | 'default';
  staticIps?: boolean;
}

export interface PublicIngressNlbConfig extends PublicIngressLbConfig {
  ipWhitelist: string[];
}

export class DfPublicIngressConstruct {
  protected scope: Construct;
  protected cloudfrontConstruct: DfCloudFrontConstruct;
  protected remoteStateSharedNetworkStack: DataTerraformRemoteStateS3;
  protected recoveryRemoteStateSharedNetworkStack: DataTerraformRemoteStateS3;
  protected primaryProivder: AwsProvider;
  protected recoveryProvider: AwsProvider;
  private primaryLoadBalancer: Alb;
  private recoveryLoadBalancer: Alb;

  constructor(
    scope: Construct,
    id: string,
    nlbConfig: PublicIngressNlbConfig,
    albConfig: PublicIngressLbConfig,
    isNlb: boolean,
    accountDefinition: AccountDefinition
  ) {
    this.scope = scope;
    this.primaryProivder = isNlb
      ? nlbConfig.providers.constructProvider
      : albConfig.providers.constructProvider;
    this.recoveryProvider = isNlb
      ? nlbConfig.providers.recoveryProvider
      : albConfig.providers.recoveryProvider;
    this.remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      this.scope,
      `${id}-remote-state-shared-network`,
      isNlb ? nlbConfig.networkBackendProps : albConfig.networkBackendProps
    );
    this.recoveryRemoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      this.scope,
      `${id}-remote-state-shared-network-recovery`,
      isNlb
        ? nlbConfig.recoveryNetworkBackendProps
        : albConfig.recoveryNetworkBackendProps
    );

    if (isNlb) {
      this.primaryLoadBalancer = this.createNlb(
        `${id}-internal-alb`,
        nlbConfig,
        true
      );
      if (Utils.isEnvironmentProdLike(accountDefinition)) {
        // Create recovery
        this.recoveryLoadBalancer = this.createNlb(
          `${id}-internal-alb`,
          nlbConfig,
          false
        );
      }
      const rootZone = new DataAwsRoute53Zone(
        this.scope,
        `RootDragonflyFtZone`,
        {
          provider: nlbConfig.providers.masterProvider,
          name: 'dragonflyft.com',
        }
      );

      new Route53Record(this.scope, `${id}-nlb-r53`, {
        provider: nlbConfig.providers.masterProvider,
        name: nlbConfig.r53RecordName,
        type: 'CNAME',
        records:
          this.recoveryLoadBalancer && nlbConfig.activeRegion === 'recovery'
            ? [this.recoveryLoadBalancer.dnsName]
            : [this.primaryLoadBalancer.dnsName],
        zoneId: rootZone.id,
        ttl: 60,
        allowOverwrite: true,
      });
    } else {
      const cloudFrontCert = this.createCloudFrontCert(
        `${id}-cloudfront-cert`,
        albConfig
      );

      this.primaryLoadBalancer = this.createAlb(
        `${id}-internal-alb`,
        albConfig,
        true
      );
      if (Utils.isEnvironmentProdLike(accountDefinition)) {
        // Create recovery
        this.recoveryLoadBalancer = this.createAlb(
          `${id}-internal-alb`,
          albConfig,
          false
        );
      }
      this.cloudfrontConstruct = new DfCloudFrontConstruct(
        scope,
        `${id}-cloudfront`,
        {
          provider: this.primaryProivder,
          cnames: albConfig.shared?.domainPortMappings
            ? [
                albConfig.r53RecordName,
                ...albConfig.shared.domainPortMappings.map(
                  (mapping) => mapping.domain
                ),
              ]
            : [albConfig.r53RecordName],
          originDomainName:
            this.recoveryLoadBalancer && albConfig.activeRegion === 'recovery'
              ? this.recoveryLoadBalancer.dnsName
              : this.primaryLoadBalancer.dnsName,
          originId:
            this.recoveryLoadBalancer && albConfig.activeRegion === 'recovery'
              ? this.recoveryLoadBalancer.arn
              : this.primaryLoadBalancer.arn,
          certificateArn: cloudFrontCert.arn,
          webAclArn: albConfig.wafId,
          masterProvider: albConfig.providers.masterProvider,
          r53RecordName: albConfig.r53RecordName,
          bucketNameOverride: albConfig.bucketNameOverride || undefined,
          certImported: albConfig.albProps?.certImported ?? false,
          rootZoneNameOverride: albConfig.rootZoneNameOverride,
          originReadTimeout: albConfig.albProps?.cloudfrontOriginReadTimeout,
          functionConfigs: albConfig.albProps?.cloudfrontFunctionConfig,
          originSslProtocolsOverride:
            albConfig.albProps?.originSslProtocolsOverride,
          securityPolicyOverride: albConfig.albProps?.securityPolicyOverride,
        }
      );
    }
  }

  private createNlb(
    id: string,
    config: PublicIngressNlbConfig,
    deployToPrimary: boolean
  ): Alb {
    const remoteStateSharedNetworkStack = deployToPrimary
      ? this.remoteStateSharedNetworkStack
      : this.recoveryRemoteStateSharedNetworkStack;

    /**
     * Chunking the whitelist is a temporary solution
     * until we can use Palo Alto to manage the large
     * whitelist we have for MoveIT. The MoveIT whitelist
     * exceeded the rules per security group quota.
     * Our quota for shared UAT and prod is 200
     * */
    const whitelistUniqueSet = new Set(config.ipWhitelist);
    const ipWhitelistChunks = Utils.arrayChunker([...whitelistUniqueSet], 200);
    const whitelistSecurityGroups = ipWhitelistChunks.map((chunk, index) => {
      return new SecurityGroup(
        this.scope,
        `${id}-whitelist-security-group-${index}${
          deployToPrimary ? '' : '-recovery'
        }`,
        {
          provider: deployToPrimary
            ? this.primaryProivder
            : this.recoveryProvider,
          name: `${config.albName}-whitelist-${index}`,
          vpcId: remoteStateSharedNetworkStack.getString(
            Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
          ),
          ingress: this.createIngressRules(true, null, chunk, deployToPrimary),
          egress: [
            {
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: ['0.0.0.0/0'],
            },
          ],
          tags: {
            Name: `${config.albName}-whitelist-${index}`,
          },
        }
      );
    });

    return this.createLoadBalancer(
      id,
      true,
      config,
      whitelistSecurityGroups,
      null,
      deployToPrimary
    );
  }

  private createAlb(
    id: string,
    config: PublicIngressLbConfig,
    deployToPrimary
  ): Alb {
    const remoteStateSharedNetworkStack = deployToPrimary
      ? this.remoteStateSharedNetworkStack
      : this.recoveryRemoteStateSharedNetworkStack;
    const loadBalancerCert = new AcmCertificate(
      this.scope,
      `${id}-load-balancer-certificate${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: deployToPrimary
          ? this.primaryProivder
          : this.recoveryProvider,
        domainName: config.certDomainName,
        validationMethod: config.albProps?.certImported ? null : 'DNS',
      }
    );

    const ingressRules = this.createIngressRules(
      false,
      config,
      null,
      deployToPrimary
    );

    const loadBalancerSecurityGroup = new SecurityGroup(
      this.scope,
      `${id}-load-balancer-security-group${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: deployToPrimary
          ? this.primaryProivder
          : this.recoveryProvider,
        name: config.albName,
        vpcId: remoteStateSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
        ),
        ingress: ingressRules,
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
          },
        ],
        tags: {
          Name: config.albName,
        },
      }
    );

    const publicIngressAlb = this.createLoadBalancer(
      id,
      false,
      config,
      [loadBalancerSecurityGroup],
      loadBalancerCert,
      deployToPrimary
    );

    return publicIngressAlb;
  }

  private createCloudFrontCert(
    id: string,
    config: PublicIngressLbConfig
  ): AcmCertificate {
    const dragonflyPublicZone = new DataAwsRoute53Zone(
      this.scope,
      `${id}-dragonfly-public-zone`,
      {
        provider: config.providers.masterProvider,
        name: config.rootZoneNameOverride
          ? config.rootZoneNameOverride
          : 'dragonflyft.com',
      }
    );
    // * CloudFront Certificates are a special case where the certificate must be created in the us-east-1 (legacy) region
    const cloudFrontCert = new AcmCertificate(
      this.scope,
      `${id}-acm-certificate`,
      {
        domainName: config.certDomainName,
        validationMethod: config.albProps?.certImported ? null : 'DNS',
      }
    );

    if (
      !config.albProps?.certImported &&
      !config.albProps?.validationRecordAlreadyExists
    ) {
      const r53ValidationRecord = new Route53Record(
        this.scope,
        `${id}-r53-validation-record`,
        {
          provider: config.providers.masterProvider,
          name: cloudFrontCert.domainValidationOptions.get(0)
            .resourceRecordName,
          type: cloudFrontCert.domainValidationOptions.get(0)
            .resourceRecordType,
          records: [
            cloudFrontCert.domainValidationOptions.get(0).resourceRecordValue,
          ],
          zoneId: dragonflyPublicZone.zoneId,
          ttl: 60,
        }
      );

      new AcmCertificateValidation(
        this.scope,
        `${id}-acm-certificate-validation`,
        {
          certificateArn: cloudFrontCert.arn,
          validationRecordFqdns: [r53ValidationRecord.fqdn],
        }
      );
    }

    return cloudFrontCert;
  }

  private createIngressRules(
    isNlb,
    config: PublicIngressLbConfig,
    cidrBlocks: string[],
    deployToPrimary: boolean
  ) {
    let ingressRules;
    if (isNlb) {
      ingressRules = [
        {
          fromPort: 22,
          toPort: 22,
          protocol: 'tcp',
          cidrBlocks: cidrBlocks,
        },
      ];
    } else {
      const prefixList = this.getPrefixListIds(deployToPrimary);
      ingressRules = [
        {
          fromPort: 443,
          toPort: 443,
          protocol: 'tcp',
          prefixListIds: prefixList,
        },
        {
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          prefixListIds: prefixList,
        },
      ];

      if (config.shared?.domainPortMappings) {
        for (const mapping of config.shared.domainPortMappings) {
          ingressRules.push({
            fromPort: mapping.port,
            toPort: mapping.port,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
          });
        }
      }
    }
    return ingressRules;
  }

  private createLoadBalancer(
    id: string,
    isNlb: boolean,
    config: PublicIngressLbConfig,
    lbSecurityGroups: SecurityGroup[],
    loadBalancerCert: AcmCertificate,
    deployToPrimary: boolean
  ): Alb {
    const remoteStateSharedNetworkStack = deployToPrimary
      ? this.remoteStateSharedNetworkStack
      : this.recoveryRemoteStateSharedNetworkStack;

    const defaultSubnets = remoteStateSharedNetworkStack.getList(
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_IDS
    );

    const xlInternetSubnets = remoteStateSharedNetworkStack.getList(
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_IDS
    );

    let subnetConfig:
      | { subnets: string[] }
      | {
          subnetMapping: { subnetId: string; allocationId: string }[];
        };

    if (config.staticIps && isNlb) {
      let subnetIds = [
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_A,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_B,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_C,
      ];
      if (config.deployToXL) {
        subnetIds = [
          Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_A,
          Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_B,
          Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_C,
        ];
      }
      subnetConfig = {
        subnetMapping: subnetIds.map((subnetConstId, idx) => {
          const subnetIdToken =
            remoteStateSharedNetworkStack.getString(subnetConstId);
          return {
            subnetId: subnetIdToken,
            allocationId: new Eip(
              this.scope,
              `${config.albName}-${
                deployToPrimary ? 'primary' : 'recovery'
              }-eip-${idx}`,
              {
                provider: deployToPrimary
                  ? this.primaryProivder
                  : this.recoveryProvider,
                publicIpv4Pool: 'amazon',
                tags: {
                  Name: `${config.albName}-eip-${idx}`,
                },
              }
            ).id,
          };
        }),
      };
    } else {
      const subnets = config.deployToXL ? xlInternetSubnets : defaultSubnets;
      subnetConfig = {
        subnets: subnets,
      };
    }
    const publicIngressAlb = new Alb(
      this.scope,
      `${id}-internal-alb${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: deployToPrimary
          ? this.primaryProivder
          : this.recoveryProvider,
        name: config.albName,
        internal: false,
        loadBalancerType: isNlb ? 'network' : 'application',
        securityGroups: lbSecurityGroups.map((securityGroup) => {
          return securityGroup.id;
        }),
        enableHttp2: true,
        preserveHostHeader: true,
        idleTimeout: config.albProps?.idleTimeout ?? 60,
        tags: {
          Name: config.albName,
        },
        ...subnetConfig,
      }
    );
    Utils.addPublicTag(publicIngressAlb);

    if (!isNlb) {
      new AlbListener(
        this.scope,
        `${id}-internal-alb-http-redirect${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: deployToPrimary
            ? this.primaryProivder
            : this.recoveryProvider,
          loadBalancerArn: publicIngressAlb.arn,
          port: 80,
          protocol: 'HTTP',
          defaultAction: [
            {
              type: 'redirect',
              redirect: {
                port: '443',
                protocol: 'HTTPS',
                statusCode: 'HTTP_301',
              },
            },
          ],
          tags: {
            Name: 'http-redirect',
          },
        }
      );
    }

    const internalIngressAlbTargetGroup = new AlbTargetGroup(
      this.scope,
      `${id}-internal-alb-target-group${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: deployToPrimary
          ? this.primaryProivder
          : this.recoveryProvider,
        name: config.albName,
        port: config.albProps?.targetPort || (isNlb ? 22 : 443),
        protocol: config.albProps?.targetProtocol || (isNlb ? 'TCP' : 'HTTPS'),
        targetType: 'ip',
        vpcId: remoteStateSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
        ),
        healthCheck: config.albProps?.healthCheck || undefined,
      }
    );

    const publicAlbHttpsListener = new AlbListener(
      this.scope,
      `${id}-internal-alb-tls-listener${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: deployToPrimary
          ? this.primaryProivder
          : this.recoveryProvider,
        loadBalancerArn: publicIngressAlb.arn,
        port: isNlb ? 22 : 443,
        protocol: isNlb ? 'TCP' : 'HTTPS',
        certificateArn: isNlb ? null : loadBalancerCert.arn,
        defaultAction: [
          {
            type: 'forward',
            targetGroupArn: internalIngressAlbTargetGroup.arn,
          },
        ],
        tags: {
          Name: isNlb ? 'tcp' : 'https',
        },
      }
    );

    if (deployToPrimary || !config.recoveryInstancesForTargetGroup) {
      config.instancesForTargetGroup.forEach((instance, index) => {
        new AlbTargetGroupAttachment(
          this.scope,
          `${id}-target-group-attachment${index}${
            deployToPrimary ? '' : '-recovery'
          }`,
          {
            provider: deployToPrimary
              ? this.primaryProivder
              : this.recoveryProvider,
            targetGroupArn: internalIngressAlbTargetGroup.arn,
            targetId: instance.instanceResource.privateIp,
            availabilityZone: 'all',
          }
        );
      });
    } else {
      config.recoveryInstancesForTargetGroup.forEach((instance, index) => {
        new AlbTargetGroupAttachment(
          this.scope,
          `${id}-target-group-attachment${index}${
            deployToPrimary ? '' : '-recovery'
          }`,
          {
            provider: deployToPrimary
              ? this.primaryProivder
              : this.recoveryProvider,
            targetGroupArn: internalIngressAlbTargetGroup.arn,
            targetId: instance.instanceResource.privateIp,
            availabilityZone: 'all',
          }
        );
      });
    }

    if (config.shared) {
      config.shared.domainPortMappings?.forEach((mapping, index) => {
        const domainRegex = new RegExp('\\.?dragonflyft\\.com$', 'i');

        const dotReplacementRegex = new RegExp('\\.', 'g');

        let sanitizedDomain = mapping.domain.replace(domainRegex, '');

        sanitizedDomain = sanitizedDomain.replace(dotReplacementRegex, '-');

        config.instancesForTargetGroup.forEach((instance, i) => {
          new AlbTargetGroupAttachment(
            this.scope,
            `${sanitizedDomain}-target-group-attachment${i}${
              deployToPrimary ? '' : '-recovery'
            }`,
            {
              provider: deployToPrimary
                ? this.primaryProivder
                : this.recoveryProvider,
              targetGroupArn: internalIngressAlbTargetGroup.arn,
              targetId: instance.instanceResource.privateIp,
              port: mapping.port,
              availabilityZone: 'all',
            }
          );
        });

        new AlbListenerRule(
          this.scope,
          `${sanitizedDomain}-listener-rule${
            deployToPrimary ? '' : '-recovery'
          }`,
          {
            provider: deployToPrimary
              ? this.primaryProivder
              : this.recoveryProvider,
            listenerArn: publicAlbHttpsListener.arn,
            priority: index + 1,
            condition: [
              {
                hostHeader: {
                  values: [mapping.domain],
                },
              },
            ],
            action: [
              {
                type: 'forward',
                targetGroupArn: internalIngressAlbTargetGroup.arn,
              },
            ],
            tags: {
              Name: sanitizedDomain,
            },
          }
        );

        new AlbListener(
          this.scope,
          `${sanitizedDomain}-listener${deployToPrimary ? '' : '-recovery'}`,
          {
            provider: deployToPrimary
              ? this.primaryProivder
              : this.recoveryProvider,
            loadBalancerArn: publicIngressAlb.arn,
            port: mapping.port,
            protocol: isNlb ? 'TCP' : 'HTTPS',
            certificateArn: isNlb ? null : loadBalancerCert.arn,
            defaultAction: [
              {
                type: 'forward',
                targetGroupArn: internalIngressAlbTargetGroup.arn,
              },
            ],
            tags: {
              Name: sanitizedDomain,
            },
          }
        );
      });
    }

    return publicIngressAlb;
  }

  private getPrefixListIds(deployToPrimary: boolean) {
    if (deployToPrimary) {
      if (this.primaryProivder === null) {
        return [Constants.CLOUDFRONT_LEGACY_PREFIX_LIST_ID];
      }

      const primaryRegionAlias = Utils.getRegionAliasFromRegion(
        this.primaryProivder.region
      );

      if (primaryRegionAlias === Constants.AWS_REGION_ALIASES.LEGACY) {
        return [Constants.CLOUDFRONT_LEGACY_PREFIX_LIST_ID];
      } else if (
        primaryRegionAlias === Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ) {
        return [Constants.CLOUDFRONT_PRIMARY_PREFIX_LIST_ID];
      }
    } else {
      return [Constants.CLOUDFRONT_RECOVERY_PREFIX_LIST_ID];
    }
  }

  public get cloudfrontDomain() {
    return this.cloudfrontConstruct.publicIngressCdnDomainName;
  }
}
