import { Construct } from 'constructs';
import {
  BaseRdsConfig,
  RdsCredentials,
  RdsReplicaConfig,
} from './dfBaseRdsConstruct';
import { DbOptionGroup } from '@cdktf/provider-aws/lib/db-option-group';
import { DbInstance } from '@cdktf/provider-aws/lib/db-instance';
import { DfSpokeVpcConstruct } from '../vpc';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DbSubnetGroup } from '@cdktf/provider-aws/lib/db-subnet-group';
import { DfAliasedKeyConstruct } from '../constructs';
import { AccountDefinition, Utils } from '@dragonfly/utils';

export interface SqlServerConfig {
  envName: string;
  scope: Construct;
  dbId: string;
  subnetIds: string[];
  vpcResource: DfSpokeVpcConstruct;
  constructId: string;
  rdsCredentials: RdsCredentials;
  multiAz: boolean;
  accountDefinition: AccountDefinition;
  replicaConfig?: RdsReplicaConfig;
  snapshotId?: string;
  allocatedStorage?: number;
  primaryProvider?: AwsProvider;
  prodCustomerData?: boolean;
  backupRetentionPeriod?: number;
  multiRegion?: boolean;
  kmsNameOverride?: string;
}
/**
 * Sql Server Construct
 */
export class DfSqlServerRdsConstruct {
  private dbOptionGroup: DbOptionGroup;
  private sqlServerDbInstance: DbInstance;
  private sqlServerDbInstanceReplica: DbInstance;
  private dbSecurityGroupReplica: SecurityGroup;

  /**
   *
   * @param {string} envName
   * @param {Construct} scope
   * @param {string} id
   * @param {BaseRdsConfig} rdsConfig
   */
  private constructor(
    envName: string,
    scope: Construct,
    id: string,
    rdsConfig: BaseRdsConfig
  ) {
    const dbSubnetGroup = new DbSubnetGroup(
      scope,
      `${envName}-${rdsConfig.id}-rdsGroup`,
      {
        provider: rdsConfig.primaryProvider,
        name: `${envName}-${rdsConfig.id}-rdsSubnetGroup`.toLowerCase(),
        subnetIds: rdsConfig.subnetIds,
        tags: { Name: rdsConfig.id },
      }
    );

    const dbSecurityGroup = new SecurityGroup(
      scope,
      `${rdsConfig.id}-rdsSecurityGroup`,
      {
        provider: rdsConfig.primaryProvider,
        name: `${rdsConfig.id}-rdsSecurityGroup`,
        vpcId: rdsConfig.vpcResource.vpcId,
        ingress: [
          {
            fromPort: 1433,
            toPort: 1433,
            protocol: 'tcp',
            cidrBlocks: [
              ...Utils.getIngressCidrBlocksByNetworkType(
                rdsConfig.accountDefinition
              ),
              rdsConfig.vpcResource.vpcCidrBlock,
            ],
            description: 'Allow incoming Client VPN and local VPC connections',
          },
        ],
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [
              ...Utils.getIngressCidrBlocksByNetworkType(
                rdsConfig.accountDefinition
              ),
              rdsConfig.vpcResource.vpcCidrBlock,
            ],
            description: 'Allow all outbound traffic',
          },
        ],
        tags: {
          Name: `${rdsConfig.id}-security-group`,
        },
      }
    );
    const key = new DfAliasedKeyConstruct(scope, `${rdsConfig.id}-key`, {
      name: rdsConfig.kmsNameOverride
        ? rdsConfig.kmsNameOverride
        : `${rdsConfig.id}-sql-server-key`,
      description: 'The KMS key for encypting the DB',
      provider: rdsConfig.primaryProvider,
      multiRegion: rdsConfig.multiRegion ?? false,
      recoveryProvider: rdsConfig.multiRegion
        ? rdsConfig.replicaConfig.replicaProvider
        : null,
    });

    this.sqlServerDbInstance = new DbInstance(
      scope,
      `${envName}-${rdsConfig.id}-SqlServerRdsInstance`,
      {
        provider: rdsConfig.primaryProvider,
        identifier: `${rdsConfig.id}-sql-server`.toLowerCase(),
        engine: rdsConfig.engine,
        engineVersion: rdsConfig.engineVersion,
        storageType: rdsConfig.storageType ?? 'gp3',
        allocatedStorage: rdsConfig.allocatedStorage,
        instanceClass: rdsConfig.instanceClass,
        username: rdsConfig.rdsCredentials.username,
        password: rdsConfig.rdsCredentials.password,
        licenseModel: 'license-included',
        dbSubnetGroupName: dbSubnetGroup.name,
        vpcSecurityGroupIds: [dbSecurityGroup.id],
        snapshotIdentifier: rdsConfig.snapshotId,
        multiAz: rdsConfig.multiAz || false,
        backupRetentionPeriod: rdsConfig.backupRetentionPeriod ?? 0,
        kmsKeyId: key.arn,
        storageEncrypted: true,
        applyImmediately:
          rdsConfig.applyImmediately || rdsConfig.multiAz || false,
        tags: {
          'backup-policy': rdsConfig.backupPolicy ?? 'root-ou-rds',
          'customer-data': rdsConfig.prodCustomerData ? 'true' : 'false',
          Name: rdsConfig.id,
        },
      }
    );

    if (rdsConfig.replicaConfig) {
      const dbSubnetGroupReplica = new DbSubnetGroup(
        scope,
        `${envName}-${rdsConfig.id}-rdsGroup-replica`,
        {
          provider: rdsConfig.replicaConfig.replicaProvider,
          name: `${envName}-${rdsConfig.id}-rdsSubnetGroup-replica`.toLowerCase(),
          subnetIds: rdsConfig.replicaConfig.vpc.dataSubnetIds,
        }
      );
      this.dbSecurityGroupReplica = new SecurityGroup(
        scope,
        `${rdsConfig.id}-rdsSecurityGroup-replica`,
        {
          provider: rdsConfig.replicaConfig.replicaProvider,
          name: `${rdsConfig.id}-rdsSecurityGroup-replica`,
          vpcId: rdsConfig.replicaConfig.vpc.vpcId,
          ingress: [
            {
              fromPort: 1433,
              toPort: 1433,
              protocol: 'tcp',
              cidrBlocks: [
                ...Utils.getIngressCidrBlocksByNetworkType(
                  rdsConfig.accountDefinition
                ),
                rdsConfig.replicaConfig.vpc.vpcCidrBlock,
              ],
              description:
                'Allow incoming Client VPN and local VPC connections',
            },
          ],
          egress: [
            {
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: ['0.0.0.0/0'],
              description: 'Allow all outbound traffic',
            },
          ],
          tags: {
            Name: `${rdsConfig.id}-SecurityGroup-replica`,
          },
        }
      );

      this.sqlServerDbInstanceReplica = new DbInstance(
        scope,
        `${envName}-${rdsConfig.id}-sql-server-rds-instance-replica`,
        {
          provider: rdsConfig.replicaConfig.replicaProvider,
          identifier: `${rdsConfig.id}-sql-server-rds-replica`.toLowerCase(),
          replicateSourceDb: this.sqlServerDbInstance.arn,
          storageType: rdsConfig.storageType,
          instanceClass: rdsConfig.instanceClass,
          kmsKeyId: key.getReplicaKey().arn,
          storageEncrypted: true,
          vpcSecurityGroupIds: [this.dbSecurityGroupReplica.id],
          snapshotIdentifier: rdsConfig.snapshotId,
          dbSubnetGroupName: dbSubnetGroupReplica.name,
        }
      );
    }
  }

  /**
   *
   * @param {SqlServerConfig} sqlServerConfig
   * @return {DfSqlServerRdsConstruct}
   *
   */
  public static sqlServerRdsInstanceFactory(
    sqlServerConfig: SqlServerConfig
  ): DfSqlServerRdsConstruct {
    return new DfSqlServerRdsConstruct(
      sqlServerConfig.envName,
      sqlServerConfig.scope,
      sqlServerConfig.constructId,
      {
        subnetIds: sqlServerConfig.subnetIds,
        id: sqlServerConfig.dbId,
        engine: 'sqlserver-ee',
        engineVersion: '15.00',
        storageType: 'gp3',
        allocatedStorage: sqlServerConfig.allocatedStorage || 100,
        vpcResource: sqlServerConfig.vpcResource,
        instanceClass: 'db.m6i.xlarge',
        accountDefinition: sqlServerConfig.accountDefinition,
        snapshotId: sqlServerConfig.snapshotId || undefined,
        rdsCredentials: sqlServerConfig.rdsCredentials,
        replicaConfig: sqlServerConfig.replicaConfig,
        multiAz: sqlServerConfig.multiAz,
        primaryProvider: sqlServerConfig.primaryProvider,
        prodCustomerData: sqlServerConfig.prodCustomerData,
        backupRetentionPeriod: sqlServerConfig.backupRetentionPeriod,
        multiRegion: sqlServerConfig.multiRegion,
        kmsNameOverride: sqlServerConfig.kmsNameOverride,
      }
    );
  }

  /**
   * @return {DbInstance} - Returns the Sql Server db instance
   */
  public get sqlServerDbInstanceResource(): DbInstance {
    return this.sqlServerDbInstance;
  }

  /**
   * @return {DbOptionGroup} - Returns the DbOptionGroup
   */
  public get dbOptionGroupResource(): DbOptionGroup {
    return this.dbOptionGroup;
  }
}
