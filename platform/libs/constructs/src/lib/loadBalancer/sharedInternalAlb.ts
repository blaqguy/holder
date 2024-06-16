import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Construct } from 'constructs';
import { DfSpokeVpcConstruct } from '../vpc';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { DfPrivateInstanceConstruct } from '../constructs';
import { AlbListenerRule } from '@cdktf/provider-aws/lib/alb-listener-rule';

interface domainToPortsMap {
  domainName: string;
  port: number;
  protocol: 'HTTP' | 'HTTPS';
  healthCheckConfig?: {
    path?: string;
    port?: string;
    protocol?: 'HTTP' | 'HTTPS';
  };
  instancesForTargetGroup: DfPrivateInstanceConstruct[];
  recoveryInstancesForTargetGroup?: DfPrivateInstanceConstruct[];
}

export interface SharedInternalAlbConfig {
  scope: Construct;
  id: string;
  provider: AwsProvider;
  certificateDomainConfig: domainToPortsMap;
  subjectAlternativeNamesToPortsMap: domainToPortsMap[];
  masterAccountProvider: AwsProvider;
  vpc: DfSpokeVpcConstruct;
  sharedNetworkAccountProvider: AwsProvider;
}

export class DfSharedInternalAlbConstruct extends Construct {
  private internalAlb: Alb;

  constructor(config: SharedInternalAlbConfig) {
    super(config.scope, config.id);

    const provider = config.provider;

    const dftPublicR53ZoneId = new DataAwsRoute53Zone(
      this,
      `${config.id}-dft-public-route53-zone`,
      {
        provider: config.masterAccountProvider,
        name: 'dragonflyft.com',
      }
    );

    this.createAlb(config, provider, dftPublicR53ZoneId);

    // * Create R53 records for the domain and the subjectAlternativeNames
    const r53DomainNames = [
      config.certificateDomainConfig.domainName,
      ...config.subjectAlternativeNamesToPortsMap.map(
        (item) => item.domainName
      ),
    ];

    const dftPrivateHostedZone = new DataAwsRoute53Zone(
      this,
      `${config.id}-dft-private-hosted-zone-lookup`,
      {
        provider: config.sharedNetworkAccountProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    r53DomainNames.forEach((domainName) => {
      new Route53Record(this, `${domainName}-r53-record`, {
        provider: config.sharedNetworkAccountProvider,
        name: domainName,
        type: 'CNAME',
        zoneId: dftPrivateHostedZone.zoneId,
        records: [this.internalAlb.dnsName],
        ttl: 300,
      });
    });
  }

  private createAlb(
    config: SharedInternalAlbConfig,
    provider: AwsProvider,
    dftPublicR53ZoneId: DataAwsRoute53Zone
  ) {
    const acmCertificate = new AcmCertificate(this, `${config.id}-acm-cert`, {
      provider,
      domainName: config.certificateDomainConfig.domainName,
      validationMethod: 'DNS',
      subjectAlternativeNames: config.subjectAlternativeNamesToPortsMap.map(
        (item) => item.domainName
      ),
      tags: { Name: `${config.id}-shared-certificate` },
    });

    const recordFqdnList: string[] = [];

    for (
      let i = 0;
      i < config.subjectAlternativeNamesToPortsMap.length + 1;
      i++
    ) {
      const r53ValidationRecord = new Route53Record(
        this,
        `${config.id}-cert-validation-record-${i}`,
        {
          provider: config.masterAccountProvider,
          name: acmCertificate.domainValidationOptions.get(i)
            .resourceRecordName,
          type: acmCertificate.domainValidationOptions.get(i)
            .resourceRecordType,
          records: [
            acmCertificate.domainValidationOptions.get(i).resourceRecordValue,
          ],
          zoneId: dftPublicR53ZoneId.id,
          ttl: 60,
          allowOverwrite: true,
        }
      );

      recordFqdnList.push(r53ValidationRecord.fqdn);
    }

    new AcmCertificateValidation(this, `${config.id}cert-validation`, {
      provider,
      certificateArn: acmCertificate.arn,
      validationRecordFqdns: recordFqdnList,
    });

    const albSecurityGroup = new SecurityGroup(this, `${config.id}-alb-sg`, {
      provider,
      name: `${config.id}-shared-alb`,
      vpcId: config.vpc.vpcId,
      ingress: [
        {
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
          description: 'Allow HTTP from anywhere',
        },
        {
          fromPort: 443,
          toPort: 443,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
          description: 'Allow HTTPS from anywhere',
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
          description: 'Allow all egress traffic',
        },
      ],
    });

    this.internalAlb = new Alb(this, `${config.id}-internal-alb`, {
      provider,
      name: `${config.id}-shared-internal-alb`,
      internal: true,
      loadBalancerType: 'application',
      securityGroups: [albSecurityGroup.id],
      subnets: config.vpc.appSubnetIds,
      tags: { Name: `${config.id}-shared-internal-alb` },
    });

    // * Initial Target Group for the HTTPs listener's default action
    const initialTargetGroup = new AlbTargetGroup(
      this,
      `${config.id}-initial-target-group-`,
      {
        provider,
        name: `${config.certificateDomainConfig.domainName
          .replace('.dragonflyft.com', '')
          .replace(/\./g, '-')}-target-group`,
        port: config.certificateDomainConfig.port,
        protocol: config.certificateDomainConfig.protocol,
        targetType: 'ip',
        vpcId: config.vpc.vpcId,
        healthCheck: {
          path: config.certificateDomainConfig.healthCheckConfig?.path || '/',
          port:
            config.certificateDomainConfig.healthCheckConfig?.port ||
            config.certificateDomainConfig.port.toString(),
          protocol:
            config.certificateDomainConfig.healthCheckConfig?.protocol ||
            config.certificateDomainConfig.protocol,
          enabled: true,
          timeout: 5,
          interval: 30,
          matcher: '200',
        },
      }
    );

    // * Register the instances to the initial target group
    config.certificateDomainConfig.instancesForTargetGroup.forEach(
      (instance: DfPrivateInstanceConstruct, index: number) =>
        new AlbTargetGroupAttachment(
          this,
          `${config.id}-internal-alb-target-group-attachment-${index}`,
          {
            provider,
            targetGroupArn: initialTargetGroup.arn,
            targetId: instance.instanceResource.privateIp,
            port: config.certificateDomainConfig.port,
          }
        )
    );

    new AlbListener(this, `${config.id}-internal-alb-http-listener`, {
      provider,
      loadBalancerArn: this.internalAlb.arn,
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
      tags: { Name: `${config.id}-internal-alb-http-listener` },
    });

    const internalAlbHttpsListener = new AlbListener(
      this,
      `${config.id}-internal-alb-https-listener`,
      {
        provider,
        loadBalancerArn: this.internalAlb.arn,
        port: 443,
        protocol: 'HTTPS',
        certificateArn: acmCertificate.arn,
        defaultAction: [
          {
            type: 'forward',
            targetGroupArn: initialTargetGroup.arn,
          },
        ],
        tags: { Name: `${config.id}-internal-alb-https-listener` },
      }
    );

    /**
     * * Host Based Routing
     */
    config.subjectAlternativeNamesToPortsMap.forEach((item, index) => {
      /**
       * * Remove .dragonflyft.com from the subjectAlternativeName
       * * Replace the '.' with '-'
       */
      const removeSurfix = new RegExp('\\.?dragonflyft\\.com$', 'i');
      const dotReplacementRegex = new RegExp('\\.', 'g');
      const domainName = item.domainName
        .replace(removeSurfix, '')
        .replace(dotReplacementRegex, '-');
      const targetGroup = new AlbTargetGroup(
        this,
        `${domainName}-target-group-${index}`,
        {
          provider,
          name: `${domainName}-target-group`,
          port: item.port,
          protocol: item.protocol,
          targetType: 'ip',
          vpcId: config.vpc.vpcId,
          healthCheck: {
            path: item.healthCheckConfig?.path || '/',
            port: item.healthCheckConfig?.port || item.port.toString(),
            protocol: item.healthCheckConfig?.protocol || item.protocol,
            enabled: true,
            timeout: 5,
            interval: 30,
            matcher: '200',
          },
        }
      );

      new AlbListenerRule(
        this,
        `${domainName}-shared-internal-alb-listener-rule-${index}`,
        {
          provider,
          listenerArn: internalAlbHttpsListener.arn,
          priority: index + 1,
          condition: [
            {
              hostHeader: {
                values: [item.domainName],
              },
            },
          ],
          action: [
            {
              type: 'forward',
              targetGroupArn: targetGroup.arn,
            },
          ],
          tags: { Name: item.domainName },
        }
      );

      // * Register the instances to the initial target group
      item.instancesForTargetGroup.forEach(
        (instance: DfPrivateInstanceConstruct, index: number) =>
          new AlbTargetGroupAttachment(
            this,
            `${domainName}-internal-alb-target-group-attachment-${index}`,
            {
              provider,
              targetGroupArn: targetGroup.arn,
              targetId: instance.instanceResource.privateIp,
              port: item.port,
            }
          )
      );
    });
  }
}
