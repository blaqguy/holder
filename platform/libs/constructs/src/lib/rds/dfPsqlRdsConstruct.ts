/* eslint-disable require-jsdoc */
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Construct } from 'constructs';
import { DfSpokeVpcConstruct, DfToolsVpcConstruct } from '../vpc';
import { DbInstance } from '@cdktf/provider-aws/lib/db-instance';
import { DfAliasedKeyConstruct } from '../constructs';
import {
  DbParameterGroup,
  DbParameterGroupConfig,
} from '@cdktf/provider-aws/lib/db-parameter-group';

export interface DfPsqlRdsConfig {
  provider: AwsProvider;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  securityGroup: {
    allowedCidrBlocks: string[];
  };
  dbOptions: {
    rdsInstanceName: string;
    dbVersion: string;
    allocatedStorage: number;
    instanceClass: string;
    dbName?: string;
    username?: string;
    password: string;
    multiAz?: boolean;
    applyImmediately?: boolean;
    backupPolicy?: string;
    customerData?: 'true' | 'false';
    finalSnapshotName?: string;
    iops?: number;
    autoMinorVersionUpgrade: boolean;
    paramaterGroupConfig?: DbParameterGroupConfig;
    performanceInsightsEnabled?: boolean;
  };
}

export class DfPsqlRdsConstruct extends Construct {
  private db: DbInstance;

  constructor(scope: Construct, id: string, config: DfPsqlRdsConfig) {
    super(scope, id);

    const psqlSG = new SecurityGroup(this, `${id}-psql-sg`, {
      provider: config.provider,
      name: `${id}-psql`,
      vpcId: config.vpc.vpcId,
      ingress: [
        {
          protocol: 'tcp',
          fromPort: 5432,
          toPort: 5432,
          cidrBlocks: config.securityGroup.allowedCidrBlocks,
          description: 'allow incoming psql connections',
        },
      ],
      egress: [
        {
          protocol: '-1',
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ['0.0.0.0/0'],
          description: 'allow all outbound traffic',
        },
      ],
      tags: {
        Name: `${id}-psql`,
      },
    });

    const key = new DfAliasedKeyConstruct(scope, `${id}-psqlkey`, {
      name: `${id}-psql`,
      description: 'The KMS key for encypting the DB',
      provider: config.provider,
    });

    this.db = new DbInstance(this, `${id}-psql-instance`, {
      provider: config.provider,
      identifier: config.dbOptions.rdsInstanceName.toLowerCase(),
      engine: 'postgres',
      dbName: config.dbOptions.dbName || 'postgres',
      engineVersion: config.dbOptions.dbVersion,
      storageType: 'gp3',
      allocatedStorage: config.dbOptions.allocatedStorage,
      instanceClass: config.dbOptions.instanceClass,
      username: config.dbOptions.username || 'postgres',
      password: config.dbOptions.password,
      dbSubnetGroupName: config.vpc.dbSubnetGroup.name,
      vpcSecurityGroupIds: [psqlSG.id],
      multiAz: config.dbOptions.multiAz || false,
      kmsKeyId: key.arn,
      storageEncrypted: true,
      applyImmediately:
        config.dbOptions.applyImmediately || config.dbOptions.multiAz || false,
      skipFinalSnapshot: config.dbOptions.finalSnapshotName ? false : true,
      finalSnapshotIdentifier: config.dbOptions.finalSnapshotName || undefined,
      tags: {
        'backup-policy': config.dbOptions.backupPolicy ?? 'root-ou-rds',
        'customer-data': config.dbOptions.customerData ? 'true' : 'false',
        Name: `${id}-psql`,
      },
      iops: config.dbOptions.iops || undefined,
      autoMinorVersionUpgrade: config.dbOptions.autoMinorVersionUpgrade,
      parameterGroupName: config.dbOptions.paramaterGroupConfig
        ? new DbParameterGroup(this, `${config.dbOptions.dbName}-pg`, {
            ...config.dbOptions.paramaterGroupConfig,
            ...{ provider: config.provider },
            tags: { Name: config.dbOptions.dbName },
          }).name
        : undefined,
      performanceInsightsEnabled: config.dbOptions.performanceInsightsEnabled,
    });
  }

  public get dbResource(): DbInstance {
    return this.db;
  }
}
