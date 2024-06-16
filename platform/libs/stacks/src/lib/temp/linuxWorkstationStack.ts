import {
  DfPrivateInstanceConstruct,
  DfPrivateInstanceConstructProps,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';

/**
 * Linux Workstation Stack
 */
export class LinuxWorkstationStack extends RemoteStack {
  public static readonly STACK_ID = 'linux-workstation-stack';

  public readonly linuxWorkstationConstructs: DfPrivateInstanceConstruct[] = [];

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   */
  public constructor(
    protected stackConfig: StackConfig,
    private instanceConfigs: DfPrivateInstanceConstructProps[]
  ) {
    super(LinuxWorkstationStack.STACK_ID, stackConfig);
    this.linuxWorkstationConstructs = instanceConfigs.map((config, index) => {
      if (config.options?.region) {
        // Get the provider from the region if it is passed in
        config.options.provider = this.getProviderForRegion(
          config.options.region
        );
      }

      return DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: `linux-workstation-${index}`,
        constructProps: config,
      });
    });
  }
}
