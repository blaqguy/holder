import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { AlbListenerRule } from '@cdktf/provider-aws/lib/alb-listener-rule';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import {
  DfGatewayVpcConstruct,
  DfIsolatedVpcConstruct,
  DfPrivateInstanceConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '@dragonfly/stacks';
import { AccountProviderConfig, Constants, Utils } from '@dragonfly/utils';
import { DataTerraformRemoteStateS3, App } from 'cdktf';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { NetworkInstanceConfig } from '../environments/abstractSharedNetworkEnvironment';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export interface TargetGroupProps {
  targetGroupPort: number;
  targetGroupProtocol: string;
  healthCheckPath: string;
  healthCheckPort: string;
  healthCheckProtocol?: string;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  healthCheckUnhealthyThreshold?: number;
  healthCheckHealthyThreshold?: number;
}

export type VpcConstruct =
  | DfSpokeVpcConstruct
  | DfIsolatedVpcConstruct
  | DfToolsVpcConstruct
  | DfGatewayVpcConstruct;

export interface DfAlbConfig {
  subDomain: string;
  certFqdn?: string;
  stackShell: RemoteStack;
  vpc: VpcConstruct;
  recoveryVpc: VpcConstruct;
  targetGroupProps: TargetGroupProps;
  internal: boolean;
  createR53Record: boolean;
  successCodes?: string;
  idleTimeout?: number;
}

interface DfAlbConstructor {
  networkInstance?: NetworkInstanceConfig;
  dfAlbProps: DfAlbConfig;
  deployHTTPS: boolean;
  app: App;
  instancesForTargetGroup?: DfPrivateInstanceConstruct[];
  recoveryInstancesForTargetGroup?: DfPrivateInstanceConstruct[];
  enableHttp2?: boolean;
  networkAccountProviderConfig?: AccountProviderConfig;
  overrideDefaultRegion?: boolean;
  activeRegion?: 'recovery' | 'default';
}

/**
 * Creates an ALB in a Shared HUB VPC that routes traffic to a spoke
 * With a Route53 record validated by Master
 */
export class DfAlb {
  private primaryTargetGroupResource: AlbTargetGroup;
  private primaryAlbSgResource: SecurityGroup;
  private primaryAlbResource: Alb;
  private recoveryTargetGroupResource: AlbTargetGroup;
  private recoveryAlbSgResource: SecurityGroup;
  private recoveryAlbResource: Alb;
  private r53Record: Route53Record;
  private instancesForTargetGroup: DfPrivateInstanceConstruct[];
  private _domainName: string;
  private provider: AwsProvider;
  private masterProvider: AwsProvider;
  private stackShell: RemoteStack;
  private config: DfAlbConstructor;
  private id: string;
  private ingressPorts;
  private remoteStateSharedNetworkStack: DataTerraformRemoteStateS3;
  private hubProvider: AwsProvider;
  private region: Constants.AWS_REGION_ALIASES;
  private recordValidation: Route53Record;

  /**
   *
   * @param {string} id - stack id
   * @param {StackConfig} stackConfig
   * @param {DfAlbConstructor} config
   * @param {Constants.AWS_REGION_ALIASES} region
   */
  constructor(
    id: string,
    stackConfig: StackConfig,
    config: DfAlbConstructor,
    region: Constants.AWS_REGION_ALIASES = Constants.AWS_REGION_ALIASES.LEGACY
  ) {
    this.stackShell = config.dfAlbProps.stackShell;
    this.config = config;
    this.id = id;
    this.region = region;

    this._domainName = `${config.dfAlbProps.subDomain}.dragonflyft.com`;

    this.masterProvider = this.stackShell.createAwsProvider({
      supportedRegion: region,
      forAccount: Utils.getMasterAccountProviderConfig(),
    });

    this.ingressPorts = [
      {
        fromPort: 80,
        toPort: 80,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
        description: 'Allow HTTP from anywhere',
      },
    ];

    // If deployHTTPS is true then add 443 port to ingress ports
    config.deployHTTPS &&
      this.ingressPorts.push({
        fromPort: 443,
        toPort: 443,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
        description: 'Allow HTTPS from anywhere',
      });

    this.createAlbByProvider(
      true,
      config.overrideDefaultRegion ?? false
        ? config.dfAlbProps.stackShell.getProviderForRegion(this.region)
        : config.dfAlbProps.stackShell.getProviderForRegion(
            stackConfig.accountDefinition.primaryRegion
          )
    );
    if (Utils.deployToRecoveryRegion(stackConfig.accountDefinition)) {
      this.createAlbByProvider(
        false,
        config.dfAlbProps.stackShell.getProviderForRegion(
          stackConfig.accountDefinition.recoveryRegion
        )
      );
    }

    if (
      this.config.dfAlbProps.createR53Record &&
      this.config.networkAccountProviderConfig
    ) {
      // Only need 'remoteStateSharedNetworkStack' and 'hubProvider' for creating a route53 record
      // here so checking if 'createR53Record' is true and 'networkAccountProviderConfig' is passed in
      this.remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
        config.dfAlbProps.stackShell,
        `remote-state-${id}-to-${config.networkInstance.remoteStateId}-${region}`,
        config.networkInstance.s3BackendProps
      );

      this.hubProvider = this.stackShell.createAwsProvider({
        supportedRegion: region,
        forAccount: config.networkAccountProviderConfig,
      });

      // Hub Provider
      this.r53Record = new Route53Record(
        this.stackShell,
        `${this.id}R53Record`,
        {
          // Hub
          provider: this.hubProvider,
          name: this._domainName,
          type: 'CNAME',
          zoneId: this.remoteStateSharedNetworkStack.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
          ),
          records:
            this.config.activeRegion === 'recovery' && this.recoveryAlbResource
              ? [this.recoveryAlbResource.dnsName]
              : [this.primaryAlbResource.dnsName],
          ttl: 300,
        }
      );
    }
  }

  /**
   *
   * @param {boolean} deployToPrimary
   * @param {AwsProvider} provider
   */
  private createAlbByProvider(deployToPrimary: boolean, provider: AwsProvider) {
    const sg = new SecurityGroup(
      this.stackShell,
      `${this.id}AlbSecurityGroup${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: provider,
        name: `${this.id}-alb`,
        description: `Security group for ${this.id} ALB`,
        vpcId: deployToPrimary
          ? this.config.dfAlbProps.vpc.vpcId
          : this.config.dfAlbProps.recoveryVpc.vpcId,
        ingress: this.ingressPorts,
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow all outbound traffic',
          },
        ],
        tags: {
          Name: `${this.id}-alb`,
        },
      }
    );

    if (deployToPrimary) {
      this.primaryAlbSgResource = sg;
    } else {
      this.recoveryAlbSgResource = sg;
    }

    const albResource = new Alb(
      this.stackShell,
      `${this.id}Alb${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: provider,
        name: this.id,
        internal: this.config.dfAlbProps.internal,
        loadBalancerType: 'application',
        securityGroups: [sg.id],
        subnets: this.retrieveSubnet(this.config.dfAlbProps, deployToPrimary),
        enableHttp2: this.config.enableHttp2 ?? true,
        idleTimeout: this.config.dfAlbProps.idleTimeout ?? 60,
        tags: {
          Name: this.id,
        },
      }
    );

    if (deployToPrimary) {
      this.primaryAlbResource = albResource;
    } else {
      this.recoveryAlbResource = albResource;
    }

    const targetGroupResource = new AlbTargetGroup(
      this.stackShell,
      `${this.id}AlbTargetGroup${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: provider,
        name: this.id,
        port: this.config.dfAlbProps.targetGroupProps.targetGroupPort,
        protocol: this.config.dfAlbProps.targetGroupProps.targetGroupProtocol,
        targetType: 'ip',
        vpcId: deployToPrimary
          ? this.config.dfAlbProps.vpc.vpcId
          : this.config.dfAlbProps.recoveryVpc.vpcId,
        tags: {
          Name: this.id,
        },
        healthCheck: {
          path: this.config.dfAlbProps.targetGroupProps.healthCheckPath || '/',
          enabled: true,
          timeout:
            this.config.dfAlbProps.targetGroupProps.healthCheckTimeout || 5,
          interval:
            this.config.dfAlbProps.targetGroupProps.healthCheckInterval || 30,
          unhealthyThreshold:
            this.config.dfAlbProps.targetGroupProps
              .healthCheckUnhealthyThreshold || 3,
          healthyThreshold:
            this.config.dfAlbProps.targetGroupProps
              .healthCheckHealthyThreshold || 3,
          port: this.config.dfAlbProps.targetGroupProps.healthCheckPort,
          protocol:
            this.config.dfAlbProps.targetGroupProps.healthCheckProtocol ||
            'HTTP',
          matcher: this.config.dfAlbProps.successCodes || '200',
        },
        lifecycle: {
          createBeforeDestroy: true,
        },
      }
    );

    if (deployToPrimary) {
      this.primaryTargetGroupResource = targetGroupResource;
    } else {
      this.recoveryTargetGroupResource = targetGroupResource;
    }

    if (this.config.instancesForTargetGroup && deployToPrimary) {
      this.config.instancesForTargetGroup.forEach(
        (instance: DfPrivateInstanceConstruct, index: number) => {
          new AlbTargetGroupAttachment(
            this.stackShell,
            `${this.id}AlbTargetGroupAttachment${index}`,
            {
              provider: provider,
              targetGroupArn: targetGroupResource.arn,
              targetId: instance.instanceResource.privateIp,
              port:
                this.config.dfAlbProps.targetGroupProps.targetGroupPort || 443,
            }
          );
        }
      );
    } else if (!deployToPrimary && this.config.instancesForTargetGroup) {
      const instances =
        this.config.recoveryInstancesForTargetGroup ??
        this.config.instancesForTargetGroup;
      instances.forEach(
        (instance: DfPrivateInstanceConstruct, index: number) => {
          new AlbTargetGroupAttachment(
            this.stackShell,
            `${this.id}AlbTargetGroupAttachment${index}-recovery`,
            {
              provider: provider,
              targetGroupArn: targetGroupResource.arn,
              availabilityZone:
                instances === this.config.instancesForTargetGroup
                  ? 'all'
                  : null,
              targetId: instance.instanceResource.privateIp,
              port:
                this.config.dfAlbProps.targetGroupProps.targetGroupPort || 443,
            }
          );
        }
      );
    }
    const httpAction = this.config.deployHTTPS
      ? {
          type: 'redirect',
          redirect: {
            port: '443',
            protocol: 'HTTPS',
            statusCode: 'HTTP_301',
          },
        }
      : {
          type: 'forward',
          targetGroupArn: targetGroupResource.arn,
        };

    const albListenerHTTP = new AlbListener(
      this.stackShell,
      `${this.id}albListener${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: provider,
        loadBalancerArn: albResource.arn,
        port: 80,
        protocol: 'HTTP',
        defaultAction: [httpAction],
        tags: { Name: `${this.id}-http-listener` },
      }
    );
    if (this.config.deployHTTPS) {
      // Master Provider
      const rootZone = new DataAwsRoute53Zone(
        this.config.dfAlbProps.stackShell,
        `RootDragonflyFtZone-${this.id}-${this.region}${
          deployToPrimary ? '' : '-recovery'
        }`,
        {
          provider: this.masterProvider,
          name: 'dragonflyft.com',
        }
      );
      const cert = new AcmCertificate(
        this.stackShell,
        `${this.id}AcmCert${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: provider,
          domainName: this.config.dfAlbProps.certFqdn ?? this._domainName,
          validationMethod: 'DNS',
          tags: { Name: `${this.id}-cert` },
        }
      );
      // Master Provider
      // Assumes that the primary is deployed before the recovery
      // Since we only one to create one validation record we
      // must use the primarys validation record in the recovery's
      // certificate validatoin request
      if (deployToPrimary) {
        this.recordValidation = new Route53Record(
          this.stackShell,
          `${this.id}CertValidationRecord${deployToPrimary ? '' : '-recovery'}`,
          {
            provider: this.masterProvider,
            name: cert.domainValidationOptions.get(0).resourceRecordName,
            type: cert.domainValidationOptions.get(0).resourceRecordType,
            records: [cert.domainValidationOptions.get(0).resourceRecordValue],
            zoneId: rootZone.id,
            ttl: 60,
            allowOverwrite: true,
          }
        );
      }
      new AcmCertificateValidation(
        this.stackShell,
        `${this.id}CertValidation${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: provider,
          certificateArn: cert.arn,
          validationRecordFqdns: [this.recordValidation.fqdn],
        }
      );
      new AlbListener(
        this.stackShell,
        `${this.id}albListenerHTTPS${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: provider,
          loadBalancerArn: albResource.arn,
          port: 443,
          protocol: 'HTTPS',
          certificateArn: cert.arn,
          defaultAction: [
            {
              type: 'forward',
              targetGroupArn: targetGroupResource.arn,
            },
          ],
          tags: { Name: `${this.id}-https-listener` },
        }
      );
      new AlbListenerRule(
        this.stackShell,
        `${this.id}albListenerRule${deployToPrimary ? '' : '-recovery'}`,
        {
          provider: provider,
          listenerArn: albListenerHTTP.arn,
          action: [
            {
              type: 'redirect',
              redirect: {
                port: '443',
                protocol: 'HTTPS',
                statusCode: 'HTTP_301',
              },
            },
          ],
          condition: [
            {
              httpHeader: {
                httpHeaderName: '*',
                values: ['*'],
              },
            },
          ],
          tags: { Name: `${this.id}-https-listener-rule` },
        }
      );
    }
  }

  /**
   * Returns the Subnet to use
   * @param {DfAlbConfig} dfAlbConfig
   * @param {boolean} deployToPrimary
   * @return {string[]}
   */
  private retrieveSubnet(
    dfAlbConfig: DfAlbConfig,
    deployToPrimary: boolean
  ): string[] {
    // Determine if internal flag is false (internet-facing) and if the vpc has publicSubnetIds (if it is ingressVPC). Should not have an internet-facing alb in spokeVPCs
    if (
      deployToPrimary &&
      !dfAlbConfig.internal &&
      dfAlbConfig.vpc instanceof DfGatewayVpcConstruct &&
      dfAlbConfig.vpc.internetBlockSubnetIds
    ) {
      return dfAlbConfig.vpc.internetBlockSubnetIds;
    } else if (
      !deployToPrimary &&
      !dfAlbConfig.internal &&
      dfAlbConfig.recoveryVpc instanceof DfGatewayVpcConstruct &&
      dfAlbConfig.recoveryVpc.internetBlockSubnetIds
    ) {
      return dfAlbConfig.recoveryVpc.internetBlockSubnetIds;
    } else if (
      deployToPrimary &&
      (dfAlbConfig.vpc instanceof DfSpokeVpcConstruct ||
        dfAlbConfig.vpc instanceof DfIsolatedVpcConstruct ||
        dfAlbConfig.vpc instanceof DfToolsVpcConstruct)
    ) {
      return dfAlbConfig.vpc.appSubnetIds;
    } else if (
      !deployToPrimary &&
      (dfAlbConfig.recoveryVpc instanceof DfSpokeVpcConstruct ||
        dfAlbConfig.recoveryVpc instanceof DfIsolatedVpcConstruct ||
        dfAlbConfig.recoveryVpc instanceof DfToolsVpcConstruct)
    ) {
      return dfAlbConfig.recoveryVpc.appSubnetIds;
    }
  }

  /**
   * Returns the Target Group Resource
   */
  public get targetGroupArn() {
    // Used in multiple places
    return this.primaryTargetGroupResource.arn;
  }

  /**
   * Returns the Load Balancer Resource
   */
  public get loadBalancerResource() {
    // Used in only one place (ACI Prod Support)
    return this.primaryAlbResource;
  }

  /**
   * Returns the ALB Security Group Resource
   */
  public get albSgId() {
    return this.primaryAlbSgResource.id;
  }

  /**
   * Returns R53 record
   */
  public get r53RecordName() {
    return this.r53Record.fqdn;
  }

  /**
   * Returns domain name
   */
  public get domainName() {
    return this._domainName;
  }
}
