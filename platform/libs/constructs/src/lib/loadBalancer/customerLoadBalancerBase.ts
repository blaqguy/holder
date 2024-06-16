import {
  AccountDefinition,
  Constants,
  CustomerDefinition,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import { DfPrivateInstanceConstruct } from '../constructs';
import { DataTerraformRemoteStateS3, S3BackendConfig } from 'cdktf';
import { Construct } from 'constructs';
import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import {
  AlbTargetGroup,
  AlbTargetGroupHealthCheck,
} from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export interface BaseLbConfig {
  providers?: {
    constructProvider: AwsProvider;
    networkProvider: AwsProvider;
    route53Provider: AwsProvider;
    masterProvider: AwsProvider;
    recoveryProvider?: AwsProvider;
  };
  certDomainName: string;
  networkBackendProps: S3BackendConfig;
  recoveryNetworkBackendProps: S3BackendConfig;
  shared?: {
    domainPortMappings?: { domain: string; port: number }[];
  };
  overrideTgConstructName?: boolean;
  deployToRegisteredCidr?: boolean;
}

export interface CustomerLbConfig extends BaseLbConfig {
  lbName: string;
  customerDefinition: CustomerDefinition;
  accountDefinition: AccountDefinition;
  lbProps: {
    targetGroups: {
      constructName: string;
      tgAttachmentConstructNameOverride?: string;
      targetGroupNameOverride?: string;
      instancesForTargetGroup?: DfPrivateInstanceConstruct[];
      recoveryInstancesForTargetGroup?: DfPrivateInstanceConstruct[];
      targetPort: number;
      targetProtocol: string;
      healthCheck?: AlbTargetGroupHealthCheck;
      listeners: {
        lbPort: number;
        lbProtocol: string;
        name: string;
        overrideDefaultAction?: AlbListener['defaultAction'];
        overrideListenerConstructName?: string;
        overrideListenerTgAttachmentConstructName?: string;
      }[];
    }[];
  };
  activeRegion?: 'recovery' | 'default';
}

export abstract class CustomerLbBase {
  protected remoteStateSharedNetworkStack: DataTerraformRemoteStateS3;
  protected recoveryRemoteStateSharedNetworkStack: DataTerraformRemoteStateS3;
  protected dragonflyPublicZone: DataAwsRoute53Zone;
  protected loadBalancer: Alb;
  protected recoveryLoadBalancer: Alb;
  protected loadBalancerCert: AcmCertificate;
  protected loadBalancerSecurityGroup: SecurityGroup;
  protected r53ValidationRecord: Route53Record;

  constructor(
    protected scope: Construct,
    protected id: string,
    protected config: CustomerLbConfig
  ) {
    this.remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      this.scope,
      `${id}-remote-state-shared-network`,
      this.config.networkBackendProps
    );
    this.recoveryRemoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      this.scope,
      `${id}-remote-state-shared-network-recovery`,
      this.config.recoveryNetworkBackendProps
    );
    this.createLoadBalancerCert(true, this.config.providers.constructProvider);
    this.createLoadBalancerSg(true, this.config.providers.constructProvider);
    this.loadBalancer = this.createLoadBalancer(
      true,
      this.config.providers.constructProvider
    );
    this.createTargetGroups(true, this.config.providers.constructProvider);
    if (Utils.isEnvironmentProdLike(this.config.accountDefinition)) {
      this.createLoadBalancerCert(
        false,
        this.config.providers.recoveryProvider,
        this.route53ValidationRecord
      );
      this.createLoadBalancerSg(false, this.config.providers.recoveryProvider);
      this.recoveryLoadBalancer = this.createLoadBalancer(
        false,
        this.config.providers.recoveryProvider
      );
      this.createTargetGroups(false, this.config.providers.recoveryProvider);
    }
    this.createLoadBalancerRecord(this.config.activeRegion);
  }

  protected createLoadBalancerCert(
    deployToPrimary: boolean,
    provider: AwsProvider,
    route53CertValidationRecord?: Route53Record
  ) {
    this.loadBalancerCert = new AcmCertificate(
      this.scope,
      `${this.id}-load-balancer-certificate${
        deployToPrimary ? '' : '-recovery'
      }`,
      {
        provider: provider,
        domainName: this.config.certDomainName,
        validationMethod: 'DNS',
      }
    );

    this.dragonflyPublicZone = new DataAwsRoute53Zone(
      this.scope,
      `${this.id}-dragonfly-public-zone${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: this.config.providers.masterProvider,
        name: 'dragonflyft.com',
      }
    );

    if (deployToPrimary) {
      this.r53ValidationRecord = new Route53Record(
        this.scope,
        `${this.id}-r53-validation-record${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: this.config.providers.masterProvider,
          name: this.loadBalancerCert.domainValidationOptions.get(0)
            .resourceRecordName,
          type: this.loadBalancerCert.domainValidationOptions.get(0)
            .resourceRecordType,
          records: [
            this.loadBalancerCert.domainValidationOptions.get(0)
              .resourceRecordValue,
          ],
          zoneId: this.dragonflyPublicZone.zoneId,
          ttl: 60,
        }
      );
    }

    new AcmCertificateValidation(
      this.scope,
      `${this.id}-acm-certificate-validation${
        deployToPrimary ? '' : '-recovery'
      }`,
      {
        provider: provider,
        certificateArn: this.loadBalancerCert.arn,
        validationRecordFqdns: [
          route53CertValidationRecord
            ? route53CertValidationRecord.fqdn
            : this.r53ValidationRecord.fqdn,
        ],
      }
    );
  }

  protected createLoadBalancerSg(
    deployToPrimary: boolean,
    provider: AwsProvider
  ) {
    const ingressRules = this.defaultIngressRules;
    this.config.lbProps.targetGroups.forEach((targetGroup) => {
      targetGroup.listeners.forEach((listener) => {
        ingressRules.push({
          fromPort: listener.lbPort,
          toPort: listener.lbPort,
          protocol: listener.lbProtocol,
          cidrBlocks: [
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
              .gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
              .gatewayVpcCidr,
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
              .recovery.gatewayVpcCidr,
            Constants.SITE_TO_SITE_VPN_SUMMARY_CIDR,
          ],
        });
      });
    });

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

  protected get defaultIngressRules() {
    return [];
  }

  protected abstract createLoadBalancer(
    deployToPrimary: boolean,
    provider: AwsProvider
  );

  protected createTargetGroups(
    deployToPrimary: boolean,
    provider: AwsProvider
  ) {
    this.config.lbProps.targetGroups.forEach((targetGroupProps) => {
      const tgName = this.config.overrideTgConstructName
        ? targetGroupProps.constructName
        : [this.id, targetGroupProps.constructName].join('-');
      const targetGroup = new AlbTargetGroup(
        this.scope,
        `${tgName}${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: provider,
          name: targetGroupProps.targetGroupNameOverride
            ? targetGroupProps.targetGroupNameOverride
            : tgName,
          port: targetGroupProps.targetPort,
          protocol: targetGroupProps.targetProtocol,
          targetType: 'ip',
          vpcId: deployToPrimary
            ? this.remoteStateSharedNetworkStack.getString(
                Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
              )
            : this.recoveryRemoteStateSharedNetworkStack.getString(
                Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
              ),
        }
      );
      const instancesForTargetGroup = deployToPrimary
        ? targetGroupProps.instancesForTargetGroup
        : targetGroupProps.recoveryInstancesForTargetGroup;
      instancesForTargetGroup.forEach((instance, index) => {
        new AlbTargetGroupAttachment(
          this.scope,
          targetGroupProps.tgAttachmentConstructNameOverride
            ? `${
                targetGroupProps.tgAttachmentConstructNameOverride
              }-attachment${index}${deployToPrimary ? '' : '-recovery'}`
            : `${tgName}-attachment-${index}${
                deployToPrimary ? '' : '-recovery'
              }`,
          {
            provider: provider,
            targetGroupArn: targetGroup.arn,
            targetId: instance.instanceResource.privateIp,
            availabilityZone: 'all',
          }
        );
      });

      /**
       * todo!: this needs to be updated to include recoveryinstances
       */
      targetGroupProps.listeners.forEach((listenerProps) => {
        const listenerName = [tgName, listenerProps.name].join('-');
        new AlbListener(
          this.scope,
          `${
            listenerProps.overrideListenerConstructName
              ? listenerProps.overrideListenerConstructName
              : listenerName
          }${deployToPrimary ? '' : '-recovery'}`,
          {
            provider: provider,
            loadBalancerArn: deployToPrimary
              ? this.loadBalancer.arn
              : this.recoveryLoadBalancer.arn,
            port: listenerProps.lbPort,
            protocol: listenerProps.lbProtocol,
            certificateArn:
              listenerProps.lbProtocol === 'HTTPS'
                ? this.loadBalancerCert.arn
                : null,
            defaultAction: listenerProps.overrideDefaultAction ?? [
              {
                type: 'forward',
                targetGroupArn: targetGroup.arn,
              },
            ],
            tags: {
              Name: listenerName,
            },
          }
        );
      });
    });
  }

  protected createLoadBalancerRecord(activeRegion: 'recovery' | 'default') {
    new Route53Record(this.scope, `${this.id}-public-record`, {
      provider: this.config.providers.masterProvider,
      name: this.config.certDomainName,
      type: 'CNAME',
      zoneId: this.dragonflyPublicZone.zoneId,
      records: [
        activeRegion === 'recovery'
          ? this.recoveryLoadBalancer.dnsName
          : this.loadBalancer.dnsName,
      ],
      ttl: 300,
    });
  }

  /**
   *
   */
  public get route53ValidationRecord() {
    return this.r53ValidationRecord;
  }
}
