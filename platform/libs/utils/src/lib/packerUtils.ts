import { DataAwsAmi } from '@cdktf/provider-aws/lib/data-aws-ami';
import { ITerraformDependable } from 'cdktf/lib/terraform-dependable';
import { Construct } from 'constructs';
import * as ConstantUtils from './constants';

/**
 * Utility functions for resources created by Packer
 */
export class DfPackerUtils {
  /**
   *
   * @param {Construct} scope
   * @param {dfMachineImage} imageName
   * @param {string} suffix - (Optoinal) suffix to append onto the terraform resource for name uniqueness
   * @param {ITerraformDependable[]} dependsOn - (Optional) can make this depend on another object befor executing
   * @return {DataAwsAmi}
   *
   */
  static getAmiByName(
    scope: Construct,
    imageName: ConstantUtils.Constants.AMIS,
    suffix?: string,
    dependsOn?: ITerraformDependable[]
  ) {
    return new DataAwsAmi(
      scope,
      [imageName, suffix, 'Datasource'].filter((x) => x != null).join('-'),
      {
        nameRegex: imageName,
        mostRecent: true,
        dependsOn: dependsOn,
      }
    );
  }
}
