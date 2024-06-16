import { AutoscalingGroup } from '@cdktf/provider-aws/lib/autoscaling-group';
import { LaunchTemplate } from '@cdktf/provider-aws/lib/launch-template';
import { Construct } from 'constructs';

export interface AutoscalingGroupProps {
  name: string;
  vpcZoneIdentifier: string[];
  desiredCapacity: number;
  maxSize: number;
  minSize: number;
  amiId: string;
  instanceType: string;
}

/**
 *  Autoscaling Group construct
 */
export class DfAutoscalingGroupConstruct extends Construct {
  protected readonly asg: AutoscalingGroup;
  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {AutoscalingGroupProps} props - Properties of the autoscaling group
   */
  constructor(private scope: Construct, private props: AutoscalingGroupProps) {
    super(scope, props.name);

    const launchTemplate = new LaunchTemplate(
      this.scope,
      `${props.name}-launch-template`,
      {
        name: `${props.name}`,
        imageId: props.amiId,
        instanceType: props.instanceType,
      }
    );

    this.asg = new AutoscalingGroup(this.scope, `${props.name}-asg`, {
      name: `${props.name}`,
      desiredCapacity: props.desiredCapacity,
      maxSize: props.maxSize,
      minSize: props.minSize,
      launchTemplate: {
        name: launchTemplate.name,
      },
      vpcZoneIdentifier: props.vpcZoneIdentifier,
    });
  }
}
