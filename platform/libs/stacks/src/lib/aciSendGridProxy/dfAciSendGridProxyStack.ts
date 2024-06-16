import {
  AccountProviderConfig,
  Constants,
  DfMultiRegionDeployment,
  Utils,
} from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { Eip } from '@cdktf/provider-aws/lib/eip';
import { DfIsolatedVpcConstruct } from '@dragonfly/constructs';
import { TerraformProvider } from 'cdktf';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Alb } from '@cdktf/provider-aws/lib/alb';

type VpcConstruct = DfIsolatedVpcConstruct;

export interface AciSendGridProxyStackConfig {
  masterAccountProviderConfig: AccountProviderConfig;
  subDomain: string;
  healthCheckProps?: {
    healthCheckPath?: string;
    healthCheckPort?: string;
    healthCheckProtocol?: string;
  };
  primaryConfig: {
    vpc: VpcConstruct;
    ingressAlb: Alb;
  };
  recoveryConfig: {
    vpc: VpcConstruct;
    ingressAlb: Alb;
  };
  activeRegion:
    | Constants.AWS_REGION_ALIASES.DF_PRIMARY
    | Constants.AWS_REGION_ALIASES.DF_RECOVERY;
}

/**
 *
 */
export class DfAciSendGridProxyStack
  extends RemoteStack
  implements DfMultiRegionDeployment
{
  private masterProvider: TerraformProvider;
  private primaryNlb: Alb;
  private recoveryNlb: Alb;
  /**
   * @param {string} stackName
   * @param {StackConfig} stackConfig
   */
  constructor(
    stackName: string,
    stackConfig: StackConfig,
    private proxyConfig: AciSendGridProxyStackConfig
  ) {
    super(stackName, stackConfig);
    this.masterProvider = this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      forAccount: proxyConfig.masterAccountProviderConfig,
    });

    this.primaryNlb = this.createSendGridResources({
      vpc: this.proxyConfig.primaryConfig.vpc,
      ingressAlb: this.proxyConfig.primaryConfig.ingressAlb,
      healthCheckProps: this.proxyConfig.healthCheckProps,
      provider: this.primaryProvider,
      suffix: '',
    });

    this.recoveryNlb = this.createSendGridResources({
      vpc: this.proxyConfig.recoveryConfig.vpc,
      ingressAlb: this.proxyConfig.recoveryConfig.ingressAlb,
      healthCheckProps: this.proxyConfig.healthCheckProps,
      provider: this.recoveryProvider,
      suffix: '-recovery',
    });

    new Route53Record(
      this,
      Utils.createStackResourceId(this.stackUuid, 'DistributionRecord'),
      {
        provider: this.masterProvider,
        name: `${proxyConfig.subDomain}.dragonflyft.com`,
        type: 'CNAME',
        zoneId: new DataAwsRoute53Zone(this, 'RootDragonflyFtZone', {
          provider: this.masterProvider,
          name: 'dragonflyft.com',
        }).id,
        records:
          this.proxyConfig.activeRegion ===
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
            ? [this.primaryNlb.dnsName]
            : [this.recoveryNlb.dnsName],
        ttl: 300,
      }
    );
  }

  /**
   *
   * @param {any} param0 -
   * @return {Alb}
   */
  private createSendGridResources({
    vpc,
    ingressAlb,
    provider,
    suffix,
    healthCheckProps,
  }: {
    vpc: VpcConstruct;
    ingressAlb: Alb;
    provider: AwsProvider;
    suffix: string;
    healthCheckProps: {
      healthCheckPath?: string;
      healthCheckPort?: string;
      healthCheckProtocol?: string;
    };
  }): Alb {
    const aciSendGridProxyNLB = new Alb(
      this,
      Utils.createStackResourceId(this.stackUuid, `aciSendGridNLB${suffix}`),
      {
        provider: provider,
        name: `aciSendGridReverseProxy${suffix}`,
        internal: false,
        loadBalancerType: 'network',
        subnetMapping: vpc.publicSubnetIds.map((subnetId, index) => {
          return {
            subnetId: subnetId,
            allocationId: new Eip(
              this,
              Utils.createStackResourceId(
                this.stackUuid,
                `AciSendGridProxyStaticIp${suffix}${index}`
              ),
              {
                provider: provider,
                publicIpv4Pool: 'amazon',
                tags: {
                  Name: `aci-sendgrid-reverse-proxy${suffix}-${index}`,
                },
              }
            ).id,
          };
        }),
        tags: { Name: `aci-sendgrid-reverse-proxy${suffix}` },
      }
    );
    const albTargetGroup = new AlbTargetGroup(
      this,
      Utils.createStackResourceId(this.stackUuid, `ingressAlbTarget${suffix}`),
      {
        provider: provider,
        name: `aciSendGridTarget${suffix}`,
        port: 443,
        protocol: 'TCP',
        targetType: 'alb',
        vpcId: vpc.vpcId,
        preserveClientIp: 'true',
        healthCheck: {
          path: healthCheckProps?.healthCheckPath || '/',
          port: healthCheckProps?.healthCheckPort || '443',
          protocol: healthCheckProps?.healthCheckProtocol || 'HTTPS',
          enabled: true,
          timeout: 5,
          interval: 6,
        },
        lifecycle: {
          createBeforeDestroy: true,
        },
        tags: { Name: `aci-sendgrid-ingress${suffix}` },
      }
    );
    new AlbTargetGroupAttachment(
      this,
      Utils.createStackResourceId(
        this.stackUuid,
        `ingressAlbTargetAttachment${suffix}`
      ),
      {
        provider: provider,
        targetGroupArn: albTargetGroup.arn,
        targetId: ingressAlb.arn,
      }
    );
    new AlbListener(
      this,
      Utils.createStackResourceId(this.stackUuid, `aciListener${suffix}`),
      {
        provider: provider,
        loadBalancerArn: aciSendGridProxyNLB.arn,
        port: 443,
        protocol: 'TCP',
        defaultAction: [
          {
            type: 'forward',
            targetGroupArn: albTargetGroup.arn,
          },
        ],
        tags: { Name: `aci-sendgrid-listener${suffix}` },
      }
    );

    return aciSendGridProxyNLB;
  }
}
