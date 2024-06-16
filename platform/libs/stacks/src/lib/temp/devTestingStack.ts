import { RemoteStack, StackConfig } from '../stacks';

/**
 * Testing Application Stack
 */
export class DevTestingStack extends RemoteStack {
  public static readonly STACK_ID = 'DevTestingStack';

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   */
  public constructor(
    protected stackId: string,
    protected stackConfig: StackConfig
  ) {
    super(stackId, stackConfig);
  }
}
