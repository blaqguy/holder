import {
  DfPrivateInstanceConstruct,
  DfPrivateInstanceConstructProps,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { TerraformProvider } from 'cdktf';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { Constants } from '@dragonfly/utils';

/**
 * Windows Workstation Stack
 */
export class WindowsWorkstationStack extends RemoteStack {
  public static readonly STACK_ID = 'WindowsWorkstationStack';

  public readonly windowsWorkstationConstructs: DfPrivateInstanceConstruct[] =
    [];

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   */
  public constructor(
    protected stackConfig: StackConfig,
    private instanceConfigs: DfPrivateInstanceConstructProps[]
  ) {
    super(WindowsWorkstationStack.STACK_ID, stackConfig);

    this.windowsWorkstationConstructs = instanceConfigs.map((config, index) => {
      if (
        config.instanceResourceConfig.ami &&
        Constants.OS_FAMILY_MAP[config.instanceResourceConfig.ami] != 'windows'
      ) {
        throw new Error(
          'DF ERROR: Windows Workstation Stack can only be used with Windows AMIs'
        );
      }

      if (config.options?.region) {
        // Get the provider from the region if it is passed in
        config.options.provider = this.getProviderForRegion(
          config.options.region
        );
      }

      const workstationConstruct = new DfPrivateInstanceConstruct({
        scope: this,
        name: `workstation-${index}`,
        constructProps: config,
      });

      if (!config.route53Config) {
        throw new Error(
          'DF ERROR: Route53 config is required for a windows workstation stack'
        );
      }

      const sharedNetworkProvider: TerraformProvider = this.createAwsProvider({
        supportedRegion: config.route53Config.region,
        forAccount: config.route53Config.accountProviderConfig,
      });

      const route53Zone = new DataAwsRoute53Zone(
        this,
        `${config.route53Config.dnsName}privateZoneLookup`,
        {
          provider: sharedNetworkProvider,
          name: 'dragonflyft.com',
          privateZone: true,
        }
      );

      new Route53Record(this, `${config.route53Config.dnsName}R53Record`, {
        provider: sharedNetworkProvider,
        name: `${config.route53Config.dnsName}.${route53Zone.name}`,
        type: 'A',
        zoneId: route53Zone.zoneId,
        records: [workstationConstruct.instanceResource.privateIp],
        ttl: 300,
      });

      return workstationConstruct;
    });
  }
}
