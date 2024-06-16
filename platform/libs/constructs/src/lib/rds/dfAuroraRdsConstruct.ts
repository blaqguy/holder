import { Construct } from 'constructs';
import { RdsClusterInstance } from '@cdktf/provider-aws/lib/rds-cluster-instance';
import { RdsCluster } from '@cdktf/provider-aws/lib/rds-cluster';
import { BaseRdsConfig, DfBaseRdsConstruct } from './dfBaseRdsConstruct';
import { RdsGlobalCluster } from '@cdktf/provider-aws/lib/rds-global-cluster';
import { DbSubnetGroup } from '@cdktf/provider-aws/lib/db-subnet-group';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { AccountDefinition, Utils } from '@dragonfly/utils';
import { RdsClusterParameterGroup } from '@cdktf/provider-aws/lib/rds-cluster-parameter-group';

/**
 * Aurora Rds Construct
 */
export class DfAuroraRdsConstruct extends DfBaseRdsConstruct {
  private rdsCluster: RdsCluster;
  private rdsClusterInstance: RdsClusterInstance;
  private rdsClusterRecovery: RdsCluster;
  private rdsClusterInstanceRecovery: RdsClusterInstance;

  /**
   *
   * @param {string} envName - Environment that will own this stack
   * @param {Construct} scope - Root CDK app
   * @param {string} federatedAccountId - AWS account id resources will be deployed to
   * @param {string} constructId - The construct Id to pass into super()
   * @param {BaseRdsConfig} rdsConfig - The config for RDS
   * @param {AccountDefinition} accountDefinition
   * @param {boolean} createGlobalCluster - Creates the global cluster
   */
  private constructor(
    envName: string,
    scope: Construct,
    federatedAccountId: string,
    constructId: string,
    rdsConfig: BaseRdsConfig,
    accountDefinition: AccountDefinition,
    createGlobalCluster = true
  ) {
    super(envName, scope, constructId, rdsConfig);

    let globalCluster: RdsGlobalCluster;
    if (createGlobalCluster) {
      globalCluster = new RdsGlobalCluster(
        this,
        `${constructId}-global-cluster`,
        {
          provider: rdsConfig.primaryProvider,
          engine: rdsConfig.engine,
          engineVersion: rdsConfig.engineVersion,
          databaseName: rdsConfig.databaseName,
          globalClusterIdentifier: `global-${rdsConfig.id}`,
          storageEncrypted: true,
        }
      );
    }

    this.rdsCluster = new RdsCluster(
      this,
      `${envName}-${rdsConfig.id}-AuroraPostgresCluster`,
      {
        lifecycle: {
          ignoreChanges: ['replication_source_identifier'],
        },
        provider: rdsConfig.primaryProvider,
        globalClusterIdentifier: globalCluster?.id,
        clusterIdentifier:
          `${envName}-${rdsConfig.id}-Aurora-Postgres-Cluster`.toLowerCase(),
        // TODO: This should be fixed but currently you can't slice into the terraform token.  It needs to be commented out for now because because us-east-1 has 6 AZs
        // availabilityZones: availabilityZones.names.slice(0, 2),
        databaseName: rdsConfig.databaseName,
        masterUsername: rdsConfig.rdsCredentials.username,
        masterPassword: rdsConfig.rdsCredentials.password,
        dbSubnetGroupName: this.dbSubnetGroup.name,
        vpcSecurityGroupIds: [this.dbSecurityGroup.id],
        engine: rdsConfig.engine,
        engineVersion: rdsConfig.engineVersion,
        snapshotIdentifier: rdsConfig.snapshotId,
        finalSnapshotIdentifier: `${rdsConfig.id}-final-snapshot`,
        dbClusterParameterGroupName: rdsConfig.clusterParameterGroupName,
        storageEncrypted: true,
        kmsKeyId: rdsConfig.kmsKey.arn || undefined,
        tags: {
          'backup-policy': rdsConfig.backupPolicy ?? 'root-ou-rds',
          'customer-data': rdsConfig.prodCustomerData ? 'true' : 'false',
          Name: rdsConfig.id,
        },
      }
    );

    this.rdsClusterInstance = new RdsClusterInstance(
      this,
      `${envName}-${rdsConfig.id}-AuroraPostgresClusterInstance`,
      {
        count: 1,
        provider: rdsConfig.primaryProvider,
        identifier:
          `${envName}-${rdsConfig.id}-AuroraPostgresRds`.toLowerCase(),
        clusterIdentifier: this.rdsCluster.clusterIdentifier,
        instanceClass: rdsConfig.instanceClass,
        engine: rdsConfig.engine,
        engineVersion: rdsConfig.engineVersion,
        performanceInsightsEnabled: true,
        tags: {
          'backup-policy': rdsConfig.backupPolicy ?? 'root-ou-rds',
          Name: rdsConfig.id,
        },
      }
    );

    if (rdsConfig.replicaConfig) {
      const dbSubnetGroupReplica = new DbSubnetGroup(
        this,
        `${envName}-${rdsConfig.id}-rdsGroup-replica`,
        {
          provider: rdsConfig.replicaConfig.replicaProvider,
          name: `${envName}-${rdsConfig.id}-rdsSubnetGroup-replica`.toLowerCase(),
          subnetIds: rdsConfig.replicaConfig.vpc.dataSubnetIds,
          tags: { Name: `${rdsConfig.id}-replica` },
        }
      );

      const dbSecurityGroupReplica = new SecurityGroup(
        this,
        `${rdsConfig.id}-replica-rdsSecurityGroup`,
        {
          provider: rdsConfig.replicaConfig.replicaProvider,
          name: `${rdsConfig.id}-replica-rdsSecurityGroup`,
          vpcId: rdsConfig.replicaConfig.vpc.vpcId,
          ingress: [
            {
              fromPort: 1521,
              toPort: 1521,
              protocol: 'tcp',
              cidrBlocks: [
                ...Utils.getIngressCidrBlocksByNetworkType(accountDefinition),
                rdsConfig.replicaConfig.vpc.vpcCidrBlock,
              ],
              description:
                'Allow incoming Client VPN and local VPC connections',
            },
            {
              fromPort: 5432,
              toPort: 5432,
              protocol: 'tcp',
              cidrBlocks: [
                ...Utils.getIngressCidrBlocksByNetworkType(accountDefinition),
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
            Name: `${rdsConfig.id}-SecurityGroup`,
          },
        }
      );

      this.rdsClusterRecovery = new RdsCluster(
        this,
        `${rdsConfig.id}-Aurora-Postgres-Cluster-replica`,
        {
          lifecycle: {
            ignoreChanges: ['replication_source_identifier'],
          },
          provider: rdsConfig.replicaConfig.replicaProvider,
          globalClusterIdentifier: globalCluster?.id,
          clusterIdentifier: rdsConfig.replicaConfig.clusterIdentifierOverride
            ? rdsConfig.replicaConfig.clusterIdentifierOverride
            : `${rdsConfig.id}-Aurora-Postgres-Cluster-replica`.toLowerCase(),
          dbSubnetGroupName: dbSubnetGroupReplica.name,
          vpcSecurityGroupIds: [dbSecurityGroupReplica.id],
          engine: rdsConfig.engine,
          engineVersion: rdsConfig.engineVersion,
          snapshotIdentifier: rdsConfig.snapshotId,
          finalSnapshotIdentifier: `${rdsConfig.id}-final-snapshot`,
          dbClusterParameterGroupName: new RdsClusterParameterGroup(
            this,
            `${rdsConfig.replicaConfig.replicaClusterParameterGroupName}-replica`,
            {
              name: `${rdsConfig.replicaConfig.replicaClusterParameterGroupName}-replica`,
              family: rdsConfig.replicaConfig.replicaClusterFamily,
              provider: rdsConfig.replicaConfig.replicaProvider,
              parameter: rdsConfig.replicaConfig.replicaClusterParameters,
              tags: {
                Name: `${rdsConfig.replicaConfig.replicaClusterParameterGroupName}-replica`,
              },
            }
          ).name,
          storageEncrypted: true,
          kmsKeyId: rdsConfig.replicaConfig.replicaKmsKeyArn || undefined,
          dependsOn: [this.rdsClusterInstance],
          replicationSourceIdentifier: this.rdsCluster.arn,
        }
      );

      this.rdsClusterInstanceRecovery = new RdsClusterInstance(
        this,
        `${rdsConfig.id}-AuroraPostgresClusterInstance-replica`,
        {
          provider: rdsConfig.replicaConfig.replicaProvider,
          count: 1,
          identifier: rdsConfig.replicaConfig.instanceIdentifierOverride
            ? rdsConfig.replicaConfig.instanceIdentifierOverride
            : `${envName}-${rdsConfig.id}-AuroraPostgresRds-replica`.toLowerCase(),
          clusterIdentifier: this.rdsClusterRecovery.clusterIdentifier,
          instanceClass: rdsConfig.instanceClass,
          engine: rdsConfig.engine,
          engineVersion: rdsConfig.engineVersion,
          performanceInsightsEnabled: true,
        }
      );
    }
  }

  /**
   *
   * @param {string} envName
   * @param {Construct} scope
   * @param {string} federatedAccountId
   * @param {string} constructId
   * @param {BaseRdsConfig} rdsConfig
   * @param {AccountDefinition} accountDefinition
   * @param {boolean} createGlobalCluster
   * @return {DfAuroraRdsConstruct}
   */
  public static auroraPostgresRdsInstanceFactory(
    envName: string,
    scope: Construct,
    federatedAccountId: string,
    constructId: string,
    rdsConfig: BaseRdsConfig,
    accountDefinition: AccountDefinition,
    createGlobalCluster = true
  ): DfAuroraRdsConstruct {
    const factoryConfig = {
      ...{
        engineVersion: '14.5',
      },
      ...rdsConfig,
      ...{
        engine: 'aurora-postgresql',
        storageType: 'gp3',
      },
    };
    return new DfAuroraRdsConstruct(
      envName,
      scope,
      federatedAccountId,
      constructId,
      factoryConfig,
      accountDefinition,
      createGlobalCluster
    );
  }

  /**
   * @return {RdsCluster} - Returns RdsCluster
   */
  public get rdsClusterResource(): RdsCluster {
    return this.rdsCluster;
  }

  public get rdsClusterRecoveryResource(): RdsCluster {
    return this.rdsClusterRecovery;
  }

  /**
   * @return {RdsClusterInstance} - Returns the rds cluster instance
   */
  public get rdsClusterInstanceResource(): RdsClusterInstance {
    return this.rdsClusterInstance;
  }

  public get rdsClusterInstanceRecoveryResource(): RdsClusterInstance {
    return this.rdsClusterInstanceRecovery;
  }
}
