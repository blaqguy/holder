import { Testing } from 'cdktf';
import { DfAutoscalingGroupConstruct } from './dfAutoscalingGroupConstruct';
import 'cdktf/lib/testing/adapters/jest';

describe('Autoscaling group deployment testing', () => {
  it('Should create an autoscaling group with a given launch template', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      new DfAutoscalingGroupConstruct(mockStack, {
        name: 'test',
        vpcZoneIdentifier: ['test-subnet-1', 'test-subnet-2'],
        desiredCapacity: 1,
        maxSize: 1,
        minSize: 1,
        amiId: 'test-ami-id',
        instanceType: 'test-instance-type',
      });
    });
    expect(synthedMockStack).toMatchSnapshot();
  });
});
