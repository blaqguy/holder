import { DfSpokeVpcConstruct } from '@dragonfly/constructs';
import { StackConfig } from '../sharedStackTypes/remoteStack';
import { DfBaseVpcConfig, DfBaseVpcStack } from './helpers/dfBaseVpcStack';
import {
  Constants,
  DfMultiRegionDeployment,
  DfMultiRegionDeploymentBase,
} from '@dragonfly/utils';

export interface DfSpokeVpcProperties {
  envName: string;
  envTier: 'uat' | 'prod' | 'dev' | 'tools';
  sharedSpoke: boolean;
}

/**
 * Spoke VPC
 */
export class DfSpokeVpcStack
  extends DfBaseVpcStack
  implements DfMultiRegionDeployment
{
  private static STACK_ID = 'Spoke';
  public readonly vpcConstruct: DfSpokeVpcConstruct;

  /**
   *
   * @param {string} stackName - "Stack unique name"
   * @param {StackConfig} stackConfig - ""
   * @param {DfBaseVpcConfig} dfEgressVpcConfig - ""
   */
  constructor(
    protected stackName: string,
    protected stackConfig: StackConfig,
    private dfSpokeVpcStackConfig: DfBaseVpcConfig,
    private dfSpokeVpcProperties?: DfSpokeVpcProperties
  ) {
    super(
      `${stackName}-${DfSpokeVpcStack.STACK_ID}`,
      stackConfig,
      dfSpokeVpcStackConfig
    );

    this.vpcConstruct = new DfSpokeVpcConstruct(this, this.stackUuid, {
      vpcCidr: this.dfSpokeVpcStackConfig.vpcCidrBlock,
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

  /**
   * @return {string}
   */
  public get environmentName() {
    return this.dfSpokeVpcProperties.envName;
  }

  /**
   * @return {string}
   */
  public get environmentTier() {
    return this.dfSpokeVpcProperties.envTier;
  }

  /**
   * @return {string}
   */
  public get sharedSpoke() {
    return this.dfSpokeVpcProperties.sharedSpoke;
  }
}
