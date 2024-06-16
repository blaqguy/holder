import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import {
  AccountDefinition,
  Constants,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import { Construct } from 'constructs';
import { DfSpokeVpcConstruct, DfToolsVpcConstruct } from '../vpc';
import { DfPrivateInstanceConstruct } from '../constructs';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { DataTerraformRemoteStateS3, Fn, S3BackendConfig } from 'cdktf';
import path from 'path';

interface NlbHealthCheck {
  healthCheckProtocol: string;
  healthCheckPath: string;
  matcher: string;
}

export interface NlbPortAndProtocol {
  port: number;
  protocol: string;
  /**
   * Pass this in your ports and protocol target different instances
   */
  primaryTargetInstances: DfPrivateInstanceConstruct[];
  recoveryTargetInstances: DfPrivateInstanceConstruct[];
  healthCheck?: NlbHealthCheck;
}

interface ImportCertificate {
  certificatePrivateKeySopsKey: string;
  certificateChainPath: string;
  certificateBodyPath: string;
}

export interface NlbConfig {
  scope: Construct;
  stackName: string;
  constructName: string;
  nlbName: string;
  route53RecordName: string;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  recoveryVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  networkInstanceS3BackendProps: S3BackendConfig;
  portAndProtocols: NlbPortAndProtocol[];
  masterProvider: AwsProvider;
  hubProvider: AwsProvider;
  provider: AwsProvider;
  recocveryProvider: AwsProvider;
  accountDefinition: AccountDefinition;
  internal?: boolean;
  importCertificate?: ImportCertificate;
}

/**
 *
 */
export class NlbConstruct {
  private rootZone: DataAwsRoute53Zone;
  private primaryRecordValidation: Route53Record;
  private primaryTransferNlb: Alb;
  private recoveryTransferNlb: Alb;
  /**
   *
   * @param {NlbConfig} nlbConfig
   */
  constructor(nlbConfig: NlbConfig) {
    // Master Provider
    this.rootZone = new DataAwsRoute53Zone(
      nlbConfig.scope,
      `root-dragonflyft-zone-${nlbConfig.stackName}-${nlbConfig.provider.region}`,
      {
        provider: nlbConfig.masterProvider,
        name: 'dragonflyft.com',
      }
    );
    this.createNlb(true, nlbConfig.provider, nlbConfig);
    if (Utils.isEnvironmentProdLike(nlbConfig.accountDefinition)) {
      this.createNlb(false, nlbConfig.recocveryProvider, nlbConfig);
    }

    const remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      nlbConfig.scope,
      `remote-state-df-alb-to-shared-network-${nlbConfig.provider.region}`,
      nlbConfig.networkInstanceS3BackendProps
    );

    new Route53Record(
      nlbConfig.scope,
      Utils.createStackResourceId(
        nlbConfig.stackName,
        `${nlbConfig.constructName}-r53-record`
      ),
      {
        // Hub
        provider: nlbConfig.hubProvider,
        name: nlbConfig.route53RecordName,
        type: 'CNAME',
        zoneId: remoteStateSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
        ),
        records: [this.primaryTransferNlb.dnsName],
        ttl: 300,
      }
    );
  }
  private createNlb(
    deployToPrimary: boolean,
    provider: AwsProvider,
    nlbConfig: NlbConfig
  ) {
    const sopsData: PlatformSecrets = Utils.getSecretsForNode(
      nlbConfig.scope.node
    );

    const cert = new AcmCertificate(
      nlbConfig.scope,
      Utils.createStackResourceId(
        nlbConfig.stackName,
        `${nlbConfig.constructName}-acm-cert${
          deployToPrimary ? '' : '-recovery'
        }`
      ),
      {
        provider: provider,
        domainName: nlbConfig.importCertificate
          ? undefined
          : `${nlbConfig.route53RecordName}.dragonflyft.com`,
        validationMethod: nlbConfig.importCertificate ? undefined : 'DNS',
        privateKey: nlbConfig.importCertificate
          ? sopsData[nlbConfig.importCertificate.certificatePrivateKeySopsKey]
          : undefined,
        certificateBody: nlbConfig.importCertificate
          ? Fn.file(
              `${path.resolve(__dirname, 'certificates')}/${
                nlbConfig.importCertificate.certificateBodyPath
              }`
            )
          : undefined,
        certificateChain: nlbConfig.importCertificate
          ? Fn.file(
              `${path.resolve(__dirname, 'certificates')}/${
                nlbConfig.importCertificate.certificateChainPath
              }`
            )
          : undefined,
      }
    );
    // Master Provider
    if (deployToPrimary && !nlbConfig.importCertificate) {
      this.primaryRecordValidation = new Route53Record(
        nlbConfig.scope,
        Utils.createStackResourceId(
          nlbConfig.stackName,
          `${nlbConfig.constructName}-cert-validation-record${
            deployToPrimary ? '' : '-recovery'
          }`
        ),
        {
          provider: nlbConfig.masterProvider,
          name: cert.domainValidationOptions.get(0).resourceRecordName,
          type: cert.domainValidationOptions.get(0).resourceRecordType,
          records: [cert.domainValidationOptions.get(0).resourceRecordValue],
          zoneId: this.rootZone.id,
          ttl: 60,
          allowOverwrite: true,
        }
      );
    }
    if (!nlbConfig.importCertificate) {
      new AcmCertificateValidation(
        nlbConfig.scope,
        Utils.createStackResourceId(
          nlbConfig.stackName,
          `${nlbConfig.constructName}-cert-validation${
            deployToPrimary ? '' : '-recovery'
          }`
        ),
        {
          provider: provider,
          certificateArn: cert.arn,
          validationRecordFqdns: [this.primaryRecordValidation.fqdn],
        }
      );
    }

    const transferNlb = new Alb(
      nlbConfig.scope,
      Utils.createStackResourceId(
        nlbConfig.stackName,
        `${nlbConfig.constructName}-nlb${deployToPrimary ? '' : '-recovery'}`
      ),
      {
        provider: provider,
        name: nlbConfig.nlbName,
        internal: nlbConfig.internal ?? true,
        loadBalancerType: 'network',
        subnets: deployToPrimary
          ? nlbConfig.vpc.appSubnetIds
          : nlbConfig.recoveryVpc.appSubnetIds,
      }
    );
    if (deployToPrimary) {
      this.primaryTransferNlb = transferNlb;
    } else {
      this.recoveryTransferNlb = transferNlb;
    }

    nlbConfig.portAndProtocols.forEach((portAndProtocol, outerIndex) => {
      const transferTargetGroup = new AlbTargetGroup(
        nlbConfig.scope,
        Utils.createStackResourceId(
          nlbConfig.stackName,
          `${nlbConfig.constructName}-target-group-${outerIndex}${
            deployToPrimary ? '' : '-recovery'
          }`
        ),
        {
          provider: provider,
          name: `${nlbConfig.nlbName}-${outerIndex}`,
          port: portAndProtocol.port,
          protocol: portAndProtocol.protocol,
          targetType: 'ip',
          healthCheck: portAndProtocol?.healthCheck
            ? {
                protocol: portAndProtocol.healthCheck.healthCheckProtocol,
                path: portAndProtocol.healthCheck.healthCheckPath,
                matcher: portAndProtocol.healthCheck.matcher,
              }
            : undefined,
          vpcId: deployToPrimary
            ? nlbConfig.vpc.vpcId
            : nlbConfig.recoveryVpc.vpcId,
        }
      );

      const instancesForTargetGroup = deployToPrimary
        ? portAndProtocol.primaryTargetInstances
        : portAndProtocol.recoveryTargetInstances;
      instancesForTargetGroup.forEach(
        (instance: DfPrivateInstanceConstruct, index: number) => {
          new AlbTargetGroupAttachment(
            nlbConfig.scope,
            `${
              nlbConfig.constructName
            }-alb-target-group-attachment-${outerIndex}-${index}${
              deployToPrimary ? '' : '-recovery'
            }`,
            {
              provider: provider,
              targetGroupArn: transferTargetGroup.arn,
              targetId: instance.instanceResource.privateIp,
              port: portAndProtocol.port,
            }
          );
        }
      );

      new AlbListener(
        nlbConfig.scope,
        Utils.createStackResourceId(
          nlbConfig.stackName,
          `${nlbConfig.constructName}-listener-${outerIndex}${
            deployToPrimary ? '' : '-recovery'
          }`
        ),
        {
          provider: provider,
          loadBalancerArn: transferNlb.arn,
          port: portAndProtocol.port,
          protocol: portAndProtocol.protocol,
          defaultAction: [
            {
              type: 'forward',
              targetGroupArn: transferTargetGroup.arn,
            },
          ],
        }
      );
    });
  }
}
