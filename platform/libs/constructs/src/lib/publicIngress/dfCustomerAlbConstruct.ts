import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { AlbListenerRule } from '@cdktf/provider-aws/lib/alb-listener-rule';
import { Construct } from 'constructs';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';

import { CustomerLbBase, CustomerLbConfig } from '../loadBalancer';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { AccountDefinition, Constants, Utils } from '@dragonfly/utils';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';

/* eslint-disable require-jsdoc */
export interface CustomerAlbConfig extends CustomerLbConfig {
  accountDefinition: AccountDefinition;
}

export class DfCustomerAlbConstruct extends CustomerLbBase {
  protected config: CustomerAlbConfig;
  protected cloudFrontCert: AcmCertificate;
  protected scope: Construct;
  protected loadBalancer: Alb;
  protected dragonflyPublicZone: DataAwsRoute53Zone;
  private internalIngressAlbTargetGroup: AlbTargetGroup;
  private publicAlbHttpsListener: AlbListener;

  constructor(scope: Construct, id: string, config: CustomerAlbConfig) {
    super(scope, id, config);
    this.config = config;
    this.scope = scope;
    this.id = id;

    if (this.config.shared) {
      this.config.shared.domainPortMappings?.forEach((mapping, index) => {
        const domainRegex = new RegExp('\\.?dragonflyft\\.com$', 'i');

        const dotReplacementRegex = new RegExp('\\.', 'g');

        let sanitizedDomain = mapping.domain.replace(domainRegex, '');

        sanitizedDomain = sanitizedDomain.replace(dotReplacementRegex, '-');

        let counter = 0;
        this.config.lbProps.targetGroups.forEach((targetGroup) => {
          targetGroup.instancesForTargetGroup.forEach((instance) => {
            new AlbTargetGroupAttachment(
              this.scope,
              `${sanitizedDomain}-target-group-attachment${counter}`,
              {
                provider: this.config.providers.constructProvider,
                targetGroupArn: this.internalIngressAlbTargetGroup.arn,
                targetId: instance.instanceResource.privateIp,
                port: mapping.port,
                availabilityZone: 'all',
              }
            );
            counter++;
          });
        });

        new AlbListenerRule(this.scope, `${sanitizedDomain}-listener-rule`, {
          provider: this.config.providers.constructProvider,
          listenerArn: this.publicAlbHttpsListener.arn,
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
              targetGroupArn: this.internalIngressAlbTargetGroup.arn,
            },
          ],
          tags: {
            Name: sanitizedDomain,
          },
        });

        new AlbListener(this.scope, `${sanitizedDomain}-listener`, {
          provider: this.config.providers.constructProvider,
          loadBalancerArn: this.loadBalancer.arn,
          port: mapping.port,
          protocol: 'HTTPS',
          certificateArn: this.loadBalancerCert.arn,
          defaultAction: [
            {
              type: 'forward',
              targetGroupArn: this.internalIngressAlbTargetGroup.arn,
            },
          ],
          tags: {
            Name: sanitizedDomain,
          },
        });
      });
    }
  }

  protected override createLoadBalancerSg(
    deployToPrimary: boolean,
    provider: AwsProvider
  ) {
    const ingressRules = [
      {
        fromPort: 443,
        toPort: 443,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
      {
        fromPort: 80,
        toPort: 80,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
    ];

    if (this.config.shared?.domainPortMappings) {
      for (const mapping of this.config.shared.domainPortMappings) {
        ingressRules.push({
          fromPort: mapping.port,
          toPort: mapping.port,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        });
      }
    }

    this.loadBalancerSecurityGroup = new SecurityGroup(
      this.scope,
      `${this.id}-load-balancer-security-group${
        deployToPrimary ? '' : '-recovery'
      }`,
      {
        provider: provider,
        name: this.config.lbName,
        vpcId: deployToPrimary
          ? this.remoteStateSharedNetworkStack.getString(
              Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
            )
          : this.recoveryRemoteStateSharedNetworkStack.getString(
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
          Name: this.config.lbName,
        },
      }
    );
  }

  protected override createLoadBalancer(
    deployToPrimary: boolean,
    provider: AwsProvider
  ): Alb {
    let subnetIds = [];

    const remoteStateToUse = deployToPrimary
      ? this.remoteStateSharedNetworkStack
      : this.recoveryRemoteStateSharedNetworkStack;

    if (this.config.deployToRegisteredCidr) {
      subnetIds = remoteStateToUse.getList(
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_PUPI_EDGE_SUBNET_IDS
      );
    } else {
      ['azA', 'azB', 'azC'].forEach((az) => {
        subnetIds.push(
          remoteStateToUse.getString(
            Utils.getCustomerSubnetTerraformOutputName(
              this.config.customerDefinition.customerName,
              az
            )
          )
        );
      });
    }

    const loadBalancer = new Alb(
      this.scope,
      `${this.id}-internal-alb${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: provider,
        name: this.config.lbName,
        internal: true,
        loadBalancerType: 'application',
        securityGroups: [this.loadBalancerSecurityGroup.id],
        subnets: subnetIds,
        enableHttp2: true,
        preserveHostHeader: true,
        tags: {
          Name: this.config.lbName,
        },
      }
    );

    new AlbListener(
      this.scope,
      `${this.id}-internal-alb-http-redirect${
        deployToPrimary ? '' : '-recovery'
      }`,
      {
        provider: provider,
        loadBalancerArn: loadBalancer.arn,
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
    return loadBalancer;
  }
}
