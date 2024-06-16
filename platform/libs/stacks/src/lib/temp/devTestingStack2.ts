import {
  DfPrivateBucketConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { PlatformSecrets } from '@dragonfly/utils';

/**
 * Testing Application Stack
 */
export class DevTestingStack2 extends RemoteStack {
  public static readonly STACK_ID = 'DevTestingStack';

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   */
  public constructor(
    protected stackId: string,
    protected stackConfig: StackConfig,
    protected vpc: DfSpokeVpcConstruct,
    protected recoveryVpc: DfSpokeVpcConstruct,
    protected sopsData: PlatformSecrets
  ) {
    super(stackId, stackConfig);
    new DfPrivateBucketConstruct(this, 'id1', {
      bucketName: 'testbucket-dk20231103',
    });
  }
}
