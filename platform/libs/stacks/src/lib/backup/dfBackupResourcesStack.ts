import { BackupVault } from '@cdktf/provider-aws/lib/backup-vault';
import { RemoteStack, StackConfig } from '../stacks';
import { DfIamRoleConstruct } from '@dragonfly/constructs';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { Constants, Utils } from '@dragonfly/utils';
import { createColdStorageProcess } from './coldStorageProcess';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

interface BackupConfig {
  /** Add additional regions where resources are deployed and need to be backed up other than the accounts primary region. Recovery will be added if account is prodLike */
  additionalRegions?: (
    | Constants.AWS_REGION_ALIASES.LEGACY
    | Constants.AWS_REGION_ALIASES.DF_PRIMARY
  )[];
  /** Boolean flag to deploy cold storage lambda process*/
  enableColdStorage: boolean;
}

interface RegionProviders {
  provider: AwsProvider | null;
  region: Constants.AWS_REGION_ALIASES;
}

/**
 * Creates one backup vault per service per region/provider
 *
 * The vaults created here are used by the backup policies
 * created in the master account by dfBackupPoliciesStack.ts
 */
export class DfBackupResourcesStack extends RemoteStack {
  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   * @param {BackupConfig} backupConfig - Config for the backup resources stack
   */
  constructor(
    stackId: string,
    stackConfig: StackConfig,
    backupConfig: BackupConfig
  ) {
    super(stackId, stackConfig);

    const services = ['ec2', 'efs', 'rds'];

    services.forEach((service) => {
      new BackupVault(this, `${service}-legacy`, {
        name: `${service}-legacy`,
        tags: {
          service: service,
          'region-type': 'legacy',
          Name: `${service}-legacy`,
        },
      });

      new BackupVault(this, `${service}-primary`, {
        name: `${service}-primary`,
        provider: this.primaryProvider,
        tags: {
          service: service,
          'region-type': 'primary',
          Name: `${service}-primary`,
        },
      });

      new BackupVault(this, `${service}-recovery-from-legacy`, {
        name: `${service}-recovery-from-legacy`,
        provider: this.recoveryProvider,
        tags: {
          service: service,
          'region-type': 'recovery',
          Name: `${service}-recovery-from-legacy`,
        },
      });

      new BackupVault(this, `${service}-recovery-from-primary`, {
        name: `${service}-recovery-from-primary`,
        provider: this.recoveryProvider,
        tags: {
          service: service,
          'region-type': 'recovery',
          Name: `${service}-recovery-from-primary`,
        },
      });
    });

    const ec2BackupPolicyDoc = new DataAwsIamPolicyDocument(
      this,
      'ec2-policy-document',
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['ec2:CreateTags', 'ec2:DeleteSnapshot'],
            resources: ['arn:aws:ec2:*::snapshot/*'],
          },
          {
            effect: 'Allow',
            actions: ['ec2:CreateImage', 'ec2:DeregisterImage'],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: ['ec2:CopyImage', 'ec2:CopySnapshot'],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: ['ec2:CreateTags'],
            resources: ['arn:aws:ec2:*:*:image/*'],
          },
          {
            effect: 'Allow',
            actions: [
              'ec2:DescribeSnapshots',
              'ec2:DescribeTags',
              'ec2:DescribeImages',
              'ec2:DescribeInstances',
              'ec2:DescribeInstanceAttribute',
              'ec2:DescribeInstanceCreditSpecifications',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeElasticGpus',
              'ec2:DescribeSpotInstanceRequests',
            ],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              'ec2:CreateSnapshot',
              'ec2:DeleteSnapshot',
              'ec2:DescribeVolumes',
              'ec2:DescribeSnapshots',
            ],
            resources: [
              'arn:aws:ec2:*::snapshot/*',
              'arn:aws:ec2:*:*:volume/*',
            ],
          },
          {
            actions: ['tag:GetResources'],
            resources: ['*'],
            effect: 'Allow',
          },
          {
            effect: 'Allow',
            actions: [
              'backup:DescribeBackupVault',
              'backup:CopyIntoBackupVault',
            ],
            resources: ['arn:aws:backup:*:*:backup-vault:*'],
          },
        ],
      }
    );

    const rdsBackupPolicyDoc = new DataAwsIamPolicyDocument(
      this,
      'rds-policy-document',
      {
        statement: [
          {
            effect: 'Allow',
            actions: [
              'rds:AddTagsToResource',
              'rds:ListTagsForResource',
              'rds:DescribeDBSnapshots',
              'rds:CreateDBSnapshot',
              'rds:CopyDBSnapshot',
              'rds:DescribeDBInstances',
              'rds:CreateDBClusterSnapshot',
              'rds:DescribeDBClusters',
              'rds:DescribeDBClusterSnapshots',
              'rds:CopyDBClusterSnapshot',
            ],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: ['rds:DeleteDBSnapshot', 'rds:ModifyDBSnapshotAttribute'],
            resources: ['arn:aws:rds:*:*:snapshot:awsbackup:*'],
          },
          {
            effect: 'Allow',
            actions: [
              'rds:DeleteDBClusterSnapshot',
              'rds:ModifyDBClusterSnapshotAttribute',
            ],
            resources: ['arn:aws:rds:*:*:cluster-snapshot:awsbackup:*'],
          },
          {
            effect: 'Allow',
            actions: ['tag:GetResources'],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              'backup:DescribeBackupVault',
              'backup:CopyIntoBackupVault',
            ],
            resources: ['arn:aws:backup:*:*:backup-vault:*'],
          },
          {
            effect: 'Allow',
            actions: ['kms:DescribeKey'],
            resources: ['*'],
          },
        ],
      }
    );

    const efsBackupPolicyDoc = new DataAwsIamPolicyDocument(
      this,
      'efs-policy-document',
      {
        statement: [
          {
            effect: 'Allow',
            actions: [
              'elasticfilesystem:Backup',
              'elasticfilesystem:DescribeTags',
            ],
            resources: ['arn:aws:elasticfilesystem:*:*:file-system/*'],
          },
          {
            effect: 'Allow',
            actions: ['tag:GetResources'],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              'backup:DescribeBackupVault',
              'backup:CopyIntoBackupVault',
            ],
            resources: ['arn:aws:backup:*:*:backup-vault:*'],
          },
        ],
      }
    );

    const restorePolicyDoc = new DataAwsIamPolicyDocument(
      this,
      'restore-policy-document',
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['ec2:CreateVolume', 'ec2:DeleteVolume'],
            resources: [
              'arn:aws:ec2:*::snapshot/*',
              'arn:aws:ec2:*:*:volume/*',
            ],
          },
          {
            effect: 'Allow',
            actions: [
              'ec2:DescribeImages',
              'ec2:DescribeInstances',
              'ec2:DescribeSnapshots',
              'ec2:DescribeVolumes',
            ],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              'rds:DescribeDBInstances',
              'rds:DescribeDBSnapshots',
              'rds:ListTagsForResource',
              'rds:RestoreDBInstanceFromDBSnapshot',
              'rds:DeleteDBInstance',
              'rds:AddTagsToResource',
              'rds:DescribeDBClusters',
              'rds:RestoreDBClusterFromSnapshot',
              'rds:DeleteDBCluster',
              'rds:RestoreDBInstanceToPointInTime',
            ],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              'elasticfilesystem:Restore',
              'elasticfilesystem:CreateFilesystem',
              'elasticfilesystem:DescribeFilesystems',
              'elasticfilesystem:DeleteFilesystem',
              'elasticfilesystem:TagResource',
            ],
            resources: ['arn:aws:elasticfilesystem:*:*:file-system/*'],
          },
          {
            effect: 'Allow',
            actions: ['kms:DescribeKey'],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              'kms:Decrypt',
              'kms:Encrypt',
              'kms:GenerateDataKey',
              'kms:ReEncryptTo',
              'kms:ReEncryptFrom',
              'kms:GenerateDataKeyWithoutPlaintext',
            ],
            resources: ['*'],
            condition: [
              {
                test: 'StringLike',
                variable: 'kms:ViaService',
                values: [
                  'ec2.*.amazonaws.com',
                  'elasticfilesystem.*.amazonaws.com',
                  'rds.*.amazonaws.com',
                ],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: ['kms:CreateGrant'],
            resources: ['*'],
            condition: [
              {
                test: 'Bool',
                variable: 'kms:GrantIsForAWSResource',
                values: ['true'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: [
              'ebs:CompleteSnapshot',
              'ebs:StartSnapshot',
              'ebs:PutSnapshotBlock',
            ],
            resources: ['arn:aws:ec2:*::snapshot/*'],
          },
          {
            effect: 'Allow',
            actions: ['rds:CreateDBInstance'],
            resources: ['arn:aws:rds:*:*:db:*'],
          },
          {
            effect: 'Allow',
            actions: ['ec2:DeleteSnapshot', 'ec2:DeleteTags'],
            resources: ['arn:aws:ec2:*::snapshot/*'],
            condition: [
              {
                test: 'Null',
                variable: 'aws:ResourceTag/aws:backup:source-resource',
                values: ['false'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: ['ec2:CreateTags'],
            resources: [
              'arn:aws:ec2:*::snapshot/*',
              'arn:aws:ec2:*:*:instance/*',
            ],
            condition: [
              {
                test: 'ForAllValues:StringEquals',
                variable: 'aws:TagKeys',
                values: ['aws:backup:source-resource'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: ['ec2:RunInstances'],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: ['ec2:TerminateInstances'],
            resources: ['arn:aws:ec2:*:*:instance/*'],
          },
          {
            effect: 'Allow',
            actions: ['ec2:CreateTags'],
            resources: [
              'arn:aws:ec2:*:*:instance/*',
              'arn:aws:ec2:*:*:volume/*',
            ],
            condition: [
              {
                test: 'ForAnyValue:StringLike',
                variable: 'ec2:CreateAction',
                values: ['RunInstances', 'CreateVolume'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: ['fsx:CreateFileSystemFromBackup'],
            resources: [
              'arn:aws:fsx:*:*:file-system/*',
              'arn:aws:fsx:*:*:backup/*',
            ],
          },
          {
            effect: 'Allow',
            actions: ['fsx:DescribeFileSystems', 'fsx:TagResource'],
            resources: ['arn:aws:fsx:*:*:file-system/*'],
          },
          {
            effect: 'Allow',
            actions: ['fsx:DescribeBackups'],
            resources: ['arn:aws:fsx:*:*:backup/*'],
          },
          {
            effect: 'Allow',
            actions: ['fsx:DeleteFileSystem', 'fsx:UntagResource'],
            resources: ['arn:aws:fsx:*:*:file-system/*'],
            condition: [
              {
                test: 'Null',
                variable: 'aws:ResourceTag/aws:backup:source-resource',
                values: ['false'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: ['fsx:DescribeVolumes'],
            resources: ['arn:aws:fsx:*:*:volume/*'],
          },
          {
            effect: 'Allow',
            actions: ['fsx:CreateVolumeFromBackup', 'fsx:TagResource'],
            resources: ['arn:aws:fsx:*:*:volume/*'],
            condition: [
              {
                test: 'ForAllValues:StringEquals',
                variable: 'aws:TagKeys',
                values: ['aws:backup:source-resource'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: ['fsx:CreateVolumeFromBackup', 'fsx:TagResource'],
            resources: [
              'arn:aws:fsx:*:*:storage-virtual-machine/*',
              'arn:aws:fsx:*:*:backup/*',
              'arn:aws:fsx:*:*:volume/*',
            ],
          },
          {
            effect: 'Allow',
            actions: ['fsx:DeleteVolume', 'fsx:UntagResource'],
            resources: ['arn:aws:fsx:*:*:volume/*'],
            condition: [
              {
                test: 'Null',
                variable: 'aws:ResourceTag/aws:backup:source-resource',
                values: ['false'],
              },
            ],
          },
          {
            effect: 'Allow',
            actions: [
              'ec2:DescribeAccountAttributes',
              'ec2:DescribeAddresses',
              'ec2:DescribeAvailabilityZones',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeSubnets',
              'ec2:DescribeVpcs',
              'ec2:DescribeInternetGateways',
            ],
            resources: ['*'],
          },
        ],
      }
    );

    const passRolePolicyDoc = new DataAwsIamPolicyDocument(
      this,
      'pass-role-document',
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['iam:PassRole'],
            resources: [
              `arn:aws:iam::${this.stackConfig.federatedAccountId}:role/*`,
            ],
          },
        ],
      }
    );

    new DfIamRoleConstruct(this, {
      roleName: 'DfBackupServiceRole',
      permissionsDocuments: [
        ec2BackupPolicyDoc,
        rdsBackupPolicyDoc,
        efsBackupPolicyDoc,
        restorePolicyDoc,
        passRolePolicyDoc,
      ],
      assumptionDocument: Utils.createTrustPolicyDocument(
        this,
        Utils.createConstructResourceId('backupTrustPolicyDoc'),
        ['backup.amazonaws.com']
      ),
    });

    if (
      // Utils.isEnvironmentProdLike(this.stackConfig.accountDefinition) && //This will be uncommented after testing is done in nonprod to allow only prod envs to get the cold storage process resources
      backupConfig.enableColdStorage
    ) {
      // Add the envs Primary region from accounts.ts file (can be legacy or primary)
      const providers: RegionProviders[] = [
        {
          provider: this.getProviderForRegion(
            this.stackConfig.accountDefinition.primaryRegion
          ),
          region: this.stackConfig.accountDefinition.primaryRegion,
        },
        {
          provider: this.recoveryProvider,
          region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        },
      ];

      // Adds additional region that account has resources deployed to that need to be backed up
      if (backupConfig.additionalRegions?.length > 0) {
        backupConfig.additionalRegions.map((region) => {
          providers.push({
            provider: this.getProviderForRegion(region),
            region: region,
          });
        });
      }

      // Creates and bundles the cold storage lambda infrastructure and dependent resources
      providers.forEach((providerObj) => {
        createColdStorageProcess({
          scope: this,
          stackconfig: stackConfig,
          dftRegion: providerObj.region,
          provider: providerObj.provider,
          backupFrequency: 'weekly',
          accountName: stackConfig.accountDefinition.name,
        });
        createColdStorageProcess({
          scope: this,
          stackconfig: stackConfig,
          dftRegion: providerObj.region,
          provider: providerObj.provider,
          backupFrequency: 'monthly',
          accountName: stackConfig.accountDefinition.name,
        });
      });
    }
  }
}
