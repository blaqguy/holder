import { Constants, Utils } from '@dragonfly/utils';
import { Construct } from 'constructs';
import { CustomerLbBase, CustomerLbConfig } from './customerLoadBalancerBase';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export class DfCustomerNlbConstruct extends CustomerLbBase {
  constructor(
    protected scope: Construct,
    id: string,
    protected stackConfig,
    protected config: CustomerLbConfig
  ) {
    super(scope, id, config);
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

    return new Alb(
      this.scope,
      `${this.id}-internal-alb${deployToPrimary ? '' : '-recovery'}`,
      {
        provider: provider,
        name: this.config.lbName,
        internal: true,
        loadBalancerType: 'network',
        securityGroups: [this.loadBalancerSecurityGroup.id],
        subnets: subnetIds,
        enableHttp2: true,
        preserveHostHeader: true,
        tags: {
          Name: this.config.lbName,
        },
      }
    );
  }

  protected get defaultIngressRules() {
    return [];
  }
}
