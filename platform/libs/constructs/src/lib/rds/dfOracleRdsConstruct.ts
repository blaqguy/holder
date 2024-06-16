/**
 * @deprecated - This construct is deprecated.
 * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * DEPRECATED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 */
import { Construct } from 'constructs';
import { DbInstance } from '@cdktf/provider-aws/lib/db-instance';
import { DbOptionGroup } from '@cdktf/provider-aws/lib/db-option-group';
import {
  BaseRdsConfig,
  DfBaseRdsConstruct,
  RdsCredentials,
} from './dfBaseRdsConstruct';
import { DfSpokeVpcConstruct, DfToolsVpcConstruct } from '../vpc';
import { AccountDefinition } from '@dragonfly/utils';

/**
 * Oracle Rds Stack
 * @deprecated - This construct is deprecated.
 */
export class OracleRdsConstruct extends DfBaseRdsConstruct {
  private dbOptionGroup: DbOptionGroup;
  private oracleDbInstance: DbInstance;

  /**
   *
   * @param {string} envName - Environment that will own this stack
   * @param {Construct} scope - Root CDK app
   * @param {string} federatedAccountId - AWS account id resources will be deployed to
   * @param {string} constructId - Construct Id to pass into super()
   * @param {BaseRdsConfig} rdsConfig - The config for RDS
   */
  private constructor(
    envName: string,
    scope: Construct,
    federatedAccountId: string,
    constructId: string,
    rdsConfig: BaseRdsConfig
  ) {
    super(envName, scope, constructId, rdsConfig);

    this.dbOptionGroup = new DbOptionGroup(
      this,
      `${envName}-${rdsConfig.id}-OracleOptionGroup`,
      {
        name: `${envName}-${rdsConfig.id}-OracleOptionGroup`.toLowerCase(),
        engineName: rdsConfig.engine,
        majorEngineVersion: rdsConfig.engineVersion,
        option: [
          {
            optionName: 'S3_INTEGRATION',
            version: '1.0',
          },
          {
            optionName: 'Timezone',
            optionSettings: [
              {
                name: 'TIME_ZONE',
                value: 'UTC',
              },
            ],
          },
        ],
        tags: { Name: rdsConfig.id },
      }
    );

    this.oracleDbInstance = new DbInstance(
      this,
      `${envName}-${rdsConfig.id}-OracleRdsInstance`,
      {
        identifier: `${envName}-${rdsConfig.id}-oracleRds`.toLowerCase(),
        engine: rdsConfig.engine,
        engineVersion: rdsConfig.engineVersion,
        storageType: rdsConfig.storageType ?? 'gp3',
        allocatedStorage: rdsConfig.allocatedStorage,
        instanceClass: rdsConfig.instanceClass,
        username: rdsConfig.rdsCredentials.username,
        password: rdsConfig.rdsCredentials.password,
        licenseModel: 'license-included',
        dbSubnetGroupName: this.dbSubnetGroup.name,
        vpcSecurityGroupIds: [this.dbSecurityGroup.id],
        optionGroupName: this.dbOptionGroup.name,
        snapshotIdentifier: rdsConfig.snapshotId,
        tags: {
          'backup-policy': rdsConfig.backupPolicy ?? 'root-ou-rds',
          'customer-data': rdsConfig.prodCustomerData ? 'true' : 'false',
          Name: rdsConfig.id,
        },
      }
    );
  }

  /**
   *
   * @param {string} envName - The environment that will own this stack
   * @param {Construct} scope - Root CDK app
   * @param {string} federatedAccountId - The account ID to use
   * @param {string} id - The name of this stack
   * @param {string[]} subnetIds - The subnet ids to associate with the RDS instance.  A subnetGroup will be created from these ids
   *      And these should be the data subnets
   * @param {SpokeVpc} vpcResource - The VPC resource to use for the RDS.  Should be the Env's VPC (Spoke vpc)
   * @param {string} constructId - Construct Id to use
   * @param {RdsCredentials} rdsCredentials - Rds credentials including username and password
   * @param {AccountDefinition} accountDefinition
   * @param {string} snapshotId - (Optional) The snapshot id to use
   * @param {number} allocatedStorage - (Optional) The allocated storage to use
   * @return {OracleRdsStack}
   *
   */
  public static oracleRdsInstanceFactory(
    envName: string,
    scope: Construct,
    federatedAccountId: string,
    id: string,
    subnetIds: string[],
    vpcResource: DfSpokeVpcConstruct | DfToolsVpcConstruct,
    constructId: string,
    rdsCredentials: RdsCredentials,
    accountDefinition: AccountDefinition,
    snapshotId?: string,
    allocatedStorage?: number
  ): OracleRdsConstruct {
    return new OracleRdsConstruct(
      envName,
      scope,
      federatedAccountId,
      constructId,
      {
        subnetIds: subnetIds,
        id: id,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        accountDefinition: accountDefinition,
        allocatedStorage: allocatedStorage || 100,
        vpcResource: vpcResource,
        instanceClass: 'db.m6i.2xlarge',
        snapshotId: snapshotId || undefined,
        rdsCredentials: rdsCredentials,
      }
    );
  }

  /**
   * @return {DbInstance} - Returns the oracle db instance
   */
  public get oracleDbInstanceResource(): DbInstance {
    return this.oracleDbInstance;
  }

  /**
   * @return {DbOptionGroup} - Returns the DbOptionGroup
   */
  public get dbOptionGroupResource(): DbOptionGroup {
    return this.dbOptionGroup;
  }
}
