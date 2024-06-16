import { DfSsmAnsibleAssociationConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants } from '@dragonfly/utils';

/**
 * Temp stack for build one-off SSM Associations
 */
export class DfTempAssociationsStack extends RemoteStack {
  /**
   *
   * @param {StackConfig} stackConfig
   * @param {string} id
   */
  constructor(stackConfig: StackConfig, id: string) {
    super(id, stackConfig);

    new DfSsmAnsibleAssociationConstruct(this, 'copy-platform-ebs-contents', {
      provider: this.getProviderForRegion(Constants.AWS_REGION_ALIASES.LEGACY),
      associationName: 'copy-platform-ebs-contents',
      playbookName: 'copy-platform-ebs-contents',
      targetType: 'tag',
      tagKey: 'volume-reduction-target',
      tagValues: ['true'],
      envName: this.stackConfig.envName,
      dryRun: 'False',
      accountId: this.stackConfig.federatedAccountId,
      ansibleAssetsDir: 'volumeReduction',
    });

    new DfSsmAnsibleAssociationConstruct(
      this,
      'restore-platform-ebs-contents',
      {
        provider: this.getProviderForRegion(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
        associationName: 'restore-platform-ebs-contents',
        playbookName: 'restore-platform-ebs-contents',
        targetType: 'tag',
        tagKey: 'volume-reduction-restore-target',
        tagValues: ['true'],
        envName: this.stackConfig.envName,
        dryRun: 'False',
        accountId: this.stackConfig.federatedAccountId,
        ansibleAssetsDir: 'volumeReduction',
      }
    );
  }
}
