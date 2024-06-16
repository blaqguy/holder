import { OrganizationsPolicy } from '@cdktf/provider-aws/lib/organizations-policy';
import { OrganizationsPolicyAttachment } from '@cdktf/provider-aws/lib/organizations-policy-attachment';
import { Constants } from '@dragonfly/utils';
import { Construct } from 'constructs';

export type DftBackupRegions = 'legacy' | 'primary';

interface DfBackupPolicyConfig {
  targetId: string;
  targetType: 'account' | 'ou';
  service: string;
  regions: string[];
  regionType: DftBackupRegions;
  cronExpression: string;
  deleteAfterDays: string;
  moveToColdStorageAfterDays?: string;
  vault: string;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  recoveryVault?: string;
}

/**
 * Creates a backup policy to be deployed to the root organizations account
 *
 * Policies can be applied to organizational units or specific accounts by using `targetType`
 *
 * ASSUMPTIONS:
 *  - Backup vaults exist in target accounts
 *  - Target resources have applicable tags
 */
export class DfBackupPolicyConstruct {
  /**
   * @param {Construct} scope
   * @param {string} id
   * @param {DfBackupPlanConfig} config
   */
  constructor(scope: Construct, id: string, config: DfBackupPolicyConfig) {
    /**
     * account target example: platformsandbox-account-ec2
     * OU target example: sandbox-ou-ec2
     */

    const policy = new OrganizationsPolicy(scope, `${id}-policy`, {
      name: id,
      type: 'BACKUP_POLICY',
      content: JSON.stringify({
        plans: {
          [id]: {
            regions: {
              '@@assign': config.regions,
            },
            rules: {
              [id]: {
                schedule_expression: {
                  '@@assign': config.cronExpression,
                },
                start_backup_window_minutes: {
                  '@@assign': '60',
                },
                complete_backup_window_minutes: {
                  '@@assign': '10080',
                },
                lifecycle: {
                  delete_after_days: {
                    '@@assign': config.deleteAfterDays,
                  },
                  move_to_cold_storage_after_days:
                    config.moveToColdStorageAfterDays
                      ? {
                          '@@assign': config.moveToColdStorageAfterDays,
                        }
                      : {},
                },
                target_backup_vault_name: {
                  '@@assign': config.vault,
                },
                recovery_point_tags: {
                  backupFrequency: {
                    tag_key: {
                      '@@assign': 'backupFrequency',
                    },
                    tag_value: {
                      '@@assign': config.backupFrequency,
                    },
                  },
                },
                copy_actions: config.recoveryVault
                  ? {
                      [`arn:aws:backup:us-west-2:$account:backup-vault:${config.recoveryVault}`]:
                        {
                          target_backup_vault_arn: {
                            '@@assign': `arn:aws:backup:us-west-2:$account:backup-vault:${config.recoveryVault}`,
                          },
                          lifecycle: {
                            delete_after_days: {
                              '@@assign': config.deleteAfterDays,
                            },
                            move_to_cold_storage_after_days:
                              config.moveToColdStorageAfterDays
                                ? {
                                    '@@assign':
                                      config.moveToColdStorageAfterDays,
                                  }
                                : {},
                          },
                        },
                    }
                  : {},
              },
            },
            selections: {
              tags: {
                [id]: {
                  iam_role_arn: {
                    '@@assign':
                      'arn:aws:iam::$account:role/DfBackupServiceRole',
                  },
                  tag_key: {
                    '@@assign': `backup-policy`,
                  },
                  tag_value: {
                    '@@assign': [
                      `${Constants.OU_ID_MAP[config.targetId]}-${
                        config.targetType
                      }-${config.service}`,
                    ],
                  },
                },
              },
            },
          },
        },
      }),
      tags: { Name: id },
    });

    new OrganizationsPolicyAttachment(scope, `${id}-attachment`, {
      policyId: policy.id,
      targetId: config.targetId,
    });
  }
}
