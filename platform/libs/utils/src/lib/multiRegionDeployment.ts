import { IConstruct } from 'constructs';
import { Constants } from './constants';
import { Utils } from './helpers';
import { Aspects, TerraformStack } from 'cdktf';

export interface DfMultiRegionDeployment {
  switchRegion(region: Constants.AWS_REGION_ALIASES): void;
}

/**
 *
 */
export class DfMultiRegionDeploymentBase {
  /**
   *
   * @param {TerraformStack} stack
   * @param {Constants.AWS_REGION_ALIASES} region
   */
  public static basicMultiRegionAspect(
    stack: TerraformStack,
    region: Constants.AWS_REGION_ALIASES
  ) {
    Aspects.of(stack).add({
      visit: (node: IConstruct) => {
        this.basicMultiRegionDeployment(stack, region, node);
      },
    });
  }
  /**
   *
   * @param {TerraformStack} stack
   * @param {Constants.AWS_REGION_ALIASES} region
   * @param {IConstruct} node
   */
  public static basicMultiRegionDeployment(
    stack: TerraformStack,
    region: Constants.AWS_REGION_ALIASES,
    node: IConstruct
  ): void {
    const regionProvider = Utils.getAwsProvider(stack, 'aws', region);
    if (Utils.isAwsNode(node)) {
      // Only override default provider if it's not already set
      node.provider = node.provider || regionProvider;
    }
  }
}
