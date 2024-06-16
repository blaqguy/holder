import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { AccountDefinition, Constants, Utils } from '@dragonfly/utils';
import {
  DfPrivateInstanceConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '../constructs';
import { Construct } from 'constructs';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataTerraformRemoteStateS3, S3BackendConfig } from 'cdktf';

export interface InternalLoadBalancerConfig {
  scope: Construct;
  stackName: string;
  accountDefinition: AccountDefinition;
  constructName: string;
  lbName: string;
  route53RecordName: string;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  recoveryVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  provider: AwsProvider;
  recoveryProvider: AwsProvider;
  loadBalancerType: 'network' | 'application';
  targetGroupConfigs: {
    instances: DfPrivateInstanceConstruct[];
    port: number;
    protocol: string;
    targetType: string;
    healthCheck: {
      port: string;
      protocol: string;
      path?: string;
    };
  }[];
  privateRoute53Config: {
    remoteStateBackendProps: S3BackendConfig;
    recoveryRemoteStateBackendProps: S3BackendConfig;
    provider: AwsProvider;
  };
}
/**
 *
 */
export class DfInternalLoadBalancerConstruct {
  protected config: InternalLoadBalancerConfig;
  /**
   *
   * @param {InternalLoadBalancerConfig} config - Config
   */
  constructor(config: InternalLoadBalancerConfig) {
    this.config = config;
    this.createAlb(true, this.config.provider);
    if (Utils.isEnvironmentProdLike(this.config.accountDefinition)) {
      this.createAlb(false, this.config.recoveryProvider);
    }
  }

  private createAlb(deployToPrimary: boolean, provider: AwsProvider) {
    const loadBalancer = new Alb(
      this.config.scope,
      Utils.createStackResourceId(
        this.config.stackName,
        `${this.config.constructName}-nlb${deployToPrimary ? '' : '-recovery'}`
      ),
      {
        provider: provider,
        name: this.config.lbName,
        internal: true,
        loadBalancerType: this.config.loadBalancerType,
        subnets: deployToPrimary
          ? this.config.vpc.appSubnetIds
          : this.config.recoveryVpc.appSubnetIds,
      }
    );

    this.config.targetGroupConfigs.forEach((tgConfig, index) => {
      const targetGroup = new AlbTargetGroup(
        this.config.scope,
        Utils.createStackResourceId(
          this.config.stackName,
          `${this.config.constructName}-target-group-${index}${
            deployToPrimary ? '' : '-recovery'
          }`
        ),
        {
          provider: provider,
          name: `${this.config.lbName}-${index}`,
          port: tgConfig.port,
          protocol: tgConfig.protocol,
          targetType: tgConfig.targetType,
          vpcId: deployToPrimary
            ? this.config.vpc.vpcId
            : this.config.recoveryVpc.vpcId,
          healthCheck: {
            path: tgConfig.healthCheck.path,
            port: tgConfig.healthCheck.port,
            protocol: tgConfig.healthCheck.protocol,
          },
        }
      );

      tgConfig.instances.forEach(
        (instance: DfPrivateInstanceConstruct, instanceIndex: number) => {
          new AlbTargetGroupAttachment(
            this.config.scope,
            `${
              this.config.constructName
            }-alb-target-group-attachment-${index}-${instanceIndex}${
              deployToPrimary ? '' : '-recovery'
            }`,
            {
              provider: provider,
              targetGroupArn: targetGroup.arn,
              availabilityZone: deployToPrimary ? null : 'all',
              targetId: instance.instanceResource.privateIp,
              port: tgConfig.port,
            }
          );
        }
      );

      new AlbListener(
        this.config.scope,
        Utils.createStackResourceId(
          this.config.stackName,
          `${this.config.constructName}-listener-${index}${
            deployToPrimary ? '' : '-recovery'
          }`
        ),
        {
          provider: provider,
          loadBalancerArn: loadBalancer.arn,
          port: tgConfig.port,
          protocol: tgConfig.protocol,
          defaultAction: [
            {
              type: 'forward',
              targetGroupArn: targetGroup.arn,
            },
          ],
        }
      );
    });

    const remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      this.config.scope,
      `remote-state-df-alb-to-shared-network-${this.config.provider.region}${
        deployToPrimary ? '' : '-recovery'
      }`,
      deployToPrimary
        ? this.config.privateRoute53Config.remoteStateBackendProps
        : this.config.privateRoute53Config.recoveryRemoteStateBackendProps
    );

    if (deployToPrimary) {
      new Route53Record(
        this.config.scope,
        Utils.createStackResourceId(
          this.config.stackName,
          `${this.config.constructName}-r53-record`
        ),
        {
          provider: this.config.privateRoute53Config.provider,
          name: this.config.route53RecordName,
          type: 'CNAME',
          zoneId: remoteStateSharedNetworkStack.getString(
            Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
          ),
          records: [loadBalancer.dnsName],
          ttl: 300,
        }
      );
    }
  }
}
