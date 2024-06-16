import { DfToolsVpcConstruct } from '@dragonfly/constructs';
import { StackConfig } from '../sharedStackTypes/remoteStack';
import { DfBaseVpcConfig, DfBaseVpcStack } from './helpers/dfBaseVpcStack';
import {
  Constants,
  DfMultiRegionDeployment,
  DfMultiRegionDeploymentBase,
} from '@dragonfly/utils';
import { TerraformOutput } from 'cdktf';

export interface DfToolsVpcProperties {
  envName: string;
  envTier: 'uat' | 'prod' | 'dev' | 'tools';
  sharedSpoke: boolean;
}

/**
 * Tools VPC
 */
export class DfToolsVpcStack
  extends DfBaseVpcStack
  implements DfMultiRegionDeployment
{
  private static STACK_ID = 'Spoke';
  public readonly vpcConstruct: DfToolsVpcConstruct;

  /**
   *
   * @param {string} stackName - "Stack unique name"
   * @param {StackConfig} stackConfig - "Config for the stack"
   * @param {DfBaseVpcConfig} DfToolsVpcStackConfig - "Config for the VPC"
   * @param {DfToolsVpcProperties} DfToolsVpcProperties - "Properties for the VPC"
   */
  constructor(
    protected stackName: string,
    protected stackConfig: StackConfig,
    private DfToolsVpcStackConfig: DfBaseVpcConfig,
    private DfToolsVpcProperties?: DfToolsVpcProperties
  ) {
    super(
      `${stackName}-${DfToolsVpcStack.STACK_ID}`,
      stackConfig,
      DfToolsVpcStackConfig
    );

    this.vpcConstruct = new DfToolsVpcConstruct(this, this.stackUuid, {
      vpcCidr: this.DfToolsVpcStackConfig.vpcCidrBlock,
      provider: null,
      federatedAccountId: this.stackConfig.federatedAccountId,
    });

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_TOOLS_NON_PROD_TRANSIT_VPC_RTB_ID,
      {
        value: this.vpcConstruct.nonProdTransitRouteTableId,
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_TOOLS_PROD_TRANSIT_VPC_RTB_ID,
      {
        value: this.vpcConstruct.prodTransitRouteTableId,
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_TOOLS_VPC_PRIVATE_RTB_ID,
      {
        value: this.vpcConstruct.privateRouteTableId,
      }
    );
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
    return this.DfToolsVpcProperties.envName;
  }

  /**
   * @return {string}
   */
  public get environmentTier() {
    return this.DfToolsVpcProperties.envTier;
  }

  /**
   * @return {string}
   */
  public get sharedSpoke() {
    return this.DfToolsVpcProperties.sharedSpoke;
  }
}
