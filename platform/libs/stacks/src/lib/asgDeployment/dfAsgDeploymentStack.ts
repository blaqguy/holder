import {
  DfAutoscalingGroupConstruct,
  AutoscalingGroupProps,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { DfSpokeVpcStack } from '../stacks';

/**
 * ASG Deployment stack
 */
export class DfAsgDeploymentStack extends RemoteStack {
  private asgConstruct: DfAutoscalingGroupConstruct;
  private vpc: DfSpokeVpcStack;

  /**
   *
   * @param {string} envName - The environment that will own this stack
   * @param {Construct} scope - Root CDK app
   * @param {string} federatedAccountId - The AWS Account id the resources will be deployed to
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    protected props: AutoscalingGroupProps
  ) {
    super(stackId, stackConfig);
    this.asgConstruct = new DfAutoscalingGroupConstruct(this, props);
  }

  /**
   * @return {DfAutoscalingGroupConstruct} - Getter for the ASG construct
   */
  public get asg() {
    return this.asgConstruct;
  }

  /**
   * Example of Linux ASG factory, but currently has no use
   *
   * @param {string} stackId - Meaningful name for stack
   * @param {StackConfig} stackConfig - Stack config
   * @param {string[]} vpcZoneIdentifier - Subnet IDs for ASG
   * @return {DfAsgDeploymentStack}
   */
  public static linuxAsgFactory(
    stackId: string,
    stackConfig: StackConfig,
    vpcZoneIdentifier: string[]
  ): DfAsgDeploymentStack {
    return new DfAsgDeploymentStack(stackId, stackConfig, {
      name: `linux-instance`,
      vpcZoneIdentifier: vpcZoneIdentifier,
      desiredCapacity: 1,
      maxSize: 1,
      minSize: 1,
      amiId: 'ami-0d23dbdcfc02f701c',
      instanceType: 't2.micro',
    });
  }
}
