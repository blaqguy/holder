import { AmiLaunchPermission } from '@cdktf/provider-aws/lib/ami-launch-permission';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Construct } from 'constructs';

interface DfCrossAccountAmiConfig {
  imageIds: string[];
  targetAccountNumbers: string[];
  provider: AwsProvider;
}

/**
 * Shares AMIs with the provided account numbers
 * AMIs must already exist in the account where this construct is deployed
 */
export class DfCrossAccountAmiConstruct extends Construct {
  /**
   * @param {Construct} scope
   * @param {string} id
   * @param {DfCrossAccountAmiConfig} config
   */
  constructor(scope: Construct, id: string, config: DfCrossAccountAmiConfig) {
    super(scope, id);

    config.imageIds.forEach((imageId) => {
      config.targetAccountNumbers.forEach((targetAccountNumber) => {
        new AmiLaunchPermission(
          scope,
          `${imageId}-launch-permissions-to-${targetAccountNumber}`,
          {
            provider: config.provider,
            imageId: imageId,
            accountId: targetAccountNumber,
          }
        );
      });
    });
  }
}
