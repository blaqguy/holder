import { TerraformProvider } from 'cdktf';
import { RemoteStack, StackConfig } from '../stacks';
import {
  DfAliasedKeyConstruct,
  DfCrossAccountAmiConstruct,
} from '@dragonfly/constructs';
import { Constants } from '@dragonfly/utils';

/**
 * Required resources for sharing AMIs in the tools account
 */
export class DfAmiSharingStack extends RemoteStack {
  private masterProvider: TerraformProvider;

  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   */
  constructor(private stackName: string, protected stackConfig: StackConfig) {
    super(stackName, stackConfig);

    new DfAliasedKeyConstruct(this, 'ami-sharing-key', {
      name: 'ami-sharing-key',
      description: 'Key used to share amis from tools to other accounts',
      provider: null,
    });

    new DfAliasedKeyConstruct(this, 'ami-sharing-key-primary', {
      name: 'ami-sharing-key',
      description: 'Key used to share amis from tools to other accounts',
      provider: this.primaryProvider,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Id: 'Share key to accounts that need to decrypt AMIs in tools account',
        Statement: [
          {
            Sid: 'Default key policy to allow tools to manage the key',
            Effect: 'Allow',
            Principal: {
              AWS: [`arn:aws:iam::${Constants.ACCOUNT_NUMBER_TOOLS}:root`],
            },
            Action: 'kms:*',
            Resource: '*',
          },
          {
            Sid: 'Allow accounts access to key',
            Effect: 'Allow',
            Principal: {
              AWS: [
                `arn:aws:iam::${Constants.ACCOUNT_NUMBER_EB_CIT}:root`,
                `arn:aws:iam::${Constants.ACCOUNT_NUMBER_EB_QE}:root`,
                `arn:aws:iam::${Constants.ACCOUNT_NUMBER_EB_PROD}:root`,
                `arn:aws:iam::${Constants.ACCOUNT_NUMBER_EB_UAT}:root`,
              ],
            },
            Action: [
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
            ],
            Resource: '*',
          },
        ],
      }),
    });

    new DfCrossAccountAmiConstruct(this, 'eb-golden-images', {
      provider: this.primaryProvider,
      imageIds: [
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_APP_01_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_APP_02_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_APP_03_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_MQ_01_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_MQ_02_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_UTIL_01_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_UTIL_02_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_WEB_01_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_WEB_02_GOLDEN_IMAGE
        ],
        Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.DF_PRIMARY][
          Constants.AMIS.EB_WIND_01_GOLDEN_IMAGE
        ],
      ],
      targetAccountNumbers: [
        Constants.ACCOUNT_NUMBER_EB_CIT,
        Constants.ACCOUNT_NUMBER_EB_QE,
        Constants.ACCOUNT_NUMBER_EB_UAT,
        Constants.ACCOUNT_NUMBER_EB_PROD,
      ],
    });
  }
}
