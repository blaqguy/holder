import {
  DfBackupPolicyConstruct,
  DftBackupRegions,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants } from '@dragonfly/utils';

/**
 * Creates organization backup policies in the root account
 * Vault names comes from backup vaults created in dfBackupResourcesStack.ts
 */
export class DfBackupPoliciesStack extends RemoteStack {
  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   */
  constructor(stackId: string, stackConfig: StackConfig) {
    super(stackId, stackConfig);

    const regions: DftBackupRegions[] = ['legacy', 'primary'];
    const services = ['ec2', 'efs', 'rds'];

    /**
     * NONPROD Backup Policies
     * Weekly backups -> Retention period of 2 weeks warm
     */

    regions.forEach((region: DftBackupRegions) => {
      services.forEach((service) => {
        const policyName = `${
          Constants.OU_ID_MAP[Constants.ROOT_OU_ID]
        }-ou-${service}-${region}`;

        // Weekly backup stored for 2 weeks warm
        new DfBackupPolicyConstruct(this, `${policyName}-weekly`, {
          targetId: Constants.ROOT_OU_ID,
          targetType: 'ou',
          service: service,
          regions:
            region === 'legacy'
              ? [Constants.AWS_REGION_MAP.LEGACY]
              : [Constants.AWS_REGION_MAP.DFPRIMARY],
          regionType: region,
          cronExpression: 'cron(0 5 ? * 1 *)', // Every Sunday at 5am UTC or 12:00 AM EST (UTC+00:00)
          deleteAfterDays: '14',
          vault: `${service}-${region}`,
          backupFrequency: 'weekly',
        });
      });
    });

    /**
     * PROD Backup Policies
     * Daily online backups -> Retention period of 7 days warm
     * Weekly backups -> Retention period of 14 days warm then 90 days cold
     * Monthly backups -> Retention period of 60 days warm 7 years cold
     */

    // LEGACY REGION OUS - list of OUs with resources in the legacy region
    const legacyProdOrgUnitIdList = [Constants.IST_OU_ID];

    legacyProdOrgUnitIdList.forEach((orgUnitId) => {
      services.forEach((service) => {
        // Daily
        new DfBackupPolicyConstruct(
          this,
          `${Constants.OU_ID_MAP[orgUnitId]}-ou-${service}-legacy-daily`,
          {
            targetId: orgUnitId,
            targetType: 'ou',
            service: service,
            regions: [Constants.AWS_REGION_MAP.LEGACY],
            regionType: 'legacy',
            cronExpression: 'cron(0 5 ? * * *)', // At 5am UTC or 12:00 AM EST (UTC+00:00) daily
            deleteAfterDays: '7',
            vault: `${service}-legacy`,
            recoveryVault: `${service}-recovery-from-legacy`,
            backupFrequency: 'daily',
          }
        );

        // Weekly
        new DfBackupPolicyConstruct(
          this,
          `${Constants.OU_ID_MAP[orgUnitId]}-ou-${service}-legacy-weekly`,
          {
            targetId: orgUnitId,
            targetType: 'ou',
            service: service,
            regions: [Constants.AWS_REGION_MAP.LEGACY],
            regionType: 'legacy',
            cronExpression: 'cron(0 5 ? * 1 *)', // Every Sunday at 5am UTC or 12:00 AM EST (UTC+00:00)
            moveToColdStorageAfterDays: service === 'efs' ? '14' : undefined, // Currently not supported for EC2 and RDS. Will be ignored for non supported services
            deleteAfterDays: service === 'efs' ? '104' : '14', // Keeps in warm storage for 14 days and 90 day cold storage for EFS only (Outside process will deal with cold storage transition for all other services)
            vault: `${service}-legacy`,
            recoveryVault: `${service}-recovery-from-legacy`,
            backupFrequency: 'weekly',
          }
        );

        // Monthly
        new DfBackupPolicyConstruct(
          this,
          `${Constants.OU_ID_MAP[orgUnitId]}-ou-${service}-legacy-monthly`,
          {
            targetId: orgUnitId,
            targetType: 'ou',
            service: service,
            regions: [Constants.AWS_REGION_MAP.LEGACY],
            regionType: 'legacy',
            cronExpression: 'cron(0 5 1 * ? *)', // Every month on the 1st at 5am UTC or 12:00 AM EST (UTC+00:00)
            moveToColdStorageAfterDays: service === 'efs' ? '60' : undefined, // Currently not supported for EC2 and RDS. Will be ignored for non supported services
            deleteAfterDays: service === 'efs' ? '2610' : '60', // Keeps in warm storage for 60 days and 2550 days (7 years) cold storage for EFS only (Outside process will deal with cold storage transition for all other services)
            vault: `${service}-legacy`,
            recoveryVault: `${service}-recovery-from-legacy`,
            backupFrequency: 'monthly',
          }
        );
      });
    });

    // PRIMARY REGION OUS  - list of OUs with resources in the primary region
    const primaryPodOrgUnitIdList = [Constants.PROD_OU_ID, Constants.UAT_OU_ID];

    primaryPodOrgUnitIdList.forEach((orgUnitId) => {
      services.forEach((service) => {
        // Daily
        new DfBackupPolicyConstruct(
          this,
          `${Constants.OU_ID_MAP[orgUnitId]}-ou-${service}-primary-daily`,
          {
            targetId: orgUnitId,
            targetType: 'ou',
            service: service,
            regions: [Constants.AWS_REGION_MAP.DFPRIMARY],
            regionType: 'primary',
            cronExpression: 'cron(0 5 ? * * *)', // At 5am UTC or 12:00 AM EST (UTC+00:00) daily
            deleteAfterDays: '7',
            vault: `${service}-primary`,
            recoveryVault: `${service}-recovery-from-primary`,
            backupFrequency: 'daily',
          }
        );

        // Weekly
        new DfBackupPolicyConstruct(
          this,
          `${Constants.OU_ID_MAP[orgUnitId]}-ou-${service}-primary-weekly`,
          {
            targetId: orgUnitId,
            targetType: 'ou',
            service: service,
            regions: [Constants.AWS_REGION_MAP.DFPRIMARY],
            regionType: 'primary',
            cronExpression: 'cron(0 5 ? * 1 *)', // Every Sunday at 5am UTC or 12:00 AM EST (UTC+00:00)
            moveToColdStorageAfterDays: service === 'efs' ? '14' : undefined, // Currently not supported for EC2 and RDS. Will be ignored for non supported services
            deleteAfterDays: service === 'efs' ? '104' : '14', // Keeps in warm storage for 14 days and 90 day cold storage for EFS only (Outside process will deal with cold storage transition for all other services)
            vault: `${service}-primary`,
            recoveryVault: `${service}-recovery-from-primary`,
            backupFrequency: 'weekly',
          }
        );

        // Monthly
        new DfBackupPolicyConstruct(
          this,
          `${Constants.OU_ID_MAP[orgUnitId]}-ou-${service}-primary-monthly`,
          {
            targetId: orgUnitId,
            targetType: 'ou',
            service: service,
            regions: [Constants.AWS_REGION_MAP.DFPRIMARY],
            regionType: 'primary',
            cronExpression: 'cron(0 5 1 * ? *)', // Every month on the 1st at 5am UTC or 12:00 AM EST (UTC+00:00)
            moveToColdStorageAfterDays: service === 'efs' ? '60' : undefined, // Currently not supported for EC2 and RDS. Will be ignored for non supported services
            deleteAfterDays: service === 'efs' ? '2610' : '60', // Keeps in warm storage for 60 days and 2550 days (7 years) cold storage for EFS only (Outside process will deal with cold storage transition for all other services)
            vault: `${service}-primary`,
            recoveryVault: `${service}-recovery-from-primary`,
            backupFrequency: 'monthly',
          }
        );
      });
    });

    /**
     * example policy targeting a single account
     * this can be deleted when we have an actual use case
     * 

    services.forEach((service) => {
      new DfBackupPolicyConstruct(
        this,
        `Constants.ACCOUNT_NUMBER_ALIAS_MAP[Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX]-account-${service}-legacy`,
        {
          targetId: Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX,
          targetType: 'account',
          service: service,
          regions: [Constants.AWS_REGION_MAP.LEGACY],
          regionType: 'legacy',
          cronExpression: 'cron(0 0 ? * 7 *)', // every Sunday at midnight
          deleteAfterDays: '1',
          vault: `${service}-legacy`,
        }
      );
    });

     */
  }
}
