import { DfIsolatedVpcConstruct } from '@dragonfly/constructs';
import { StackConfig } from '../sharedStackTypes/remoteStack';
import { DfBaseVpcConfig, DfBaseVpcStack } from './helpers/dfBaseVpcStack';
import {
  Constants,
  DfMultiRegionDeployment,
  DfMultiRegionDeploymentBase,
} from '@dragonfly/utils';

export interface DfIsolatedVpcProperties {
  envName: string;
  envTier: 'uat' | 'prod' | 'dev' | 'tools';
}

/**
 * Isolated Network VPC
 */
export class DfIsolatedVpcStack
  extends DfBaseVpcStack
  implements DfMultiRegionDeployment
{
  private static STACK_ID = 'Isolated';
  public readonly vpcConstruct: DfIsolatedVpcConstruct;

  /**
   *
   * @param {string} stackName - "Stack unique name"
   * @param {StackConfig} stackConfig - ""
   */
  constructor(
    protected stackName: string,
    protected stackConfig: StackConfig,
    private dfIsolatedVpcStackConfig: DfBaseVpcConfig,
    private dfIsolatedVpcProperties?: DfIsolatedVpcProperties
  ) {
    super(
      `${stackName}-${DfIsolatedVpcStack.STACK_ID}`,
      stackConfig,
      dfIsolatedVpcStackConfig
    );

    this.vpcConstruct = new DfIsolatedVpcConstruct(this, this.stackUuid, {
      vpcCidr: this.dfIsolatedVpcStackConfig.vpcCidrBlock,
      isolatedNetwork: true,
      provider: null,
      federatedAccountId: this.stackConfig.federatedAccountId,
    });
  }

  /**
   *
   * @param {Constants.AWS_REGION_ALIASES} region
   */
  public switchRegion(region: Constants.AWS_REGION_ALIASES): void {
    DfMultiRegionDeploymentBase.basicMultiRegionAspect(this, region);
  }
}
