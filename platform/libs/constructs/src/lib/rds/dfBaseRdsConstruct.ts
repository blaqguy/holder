import { Construct } from 'constructs';
import { DbSubnetGroup } from '@cdktf/provider-aws/lib/db-subnet-group';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DfSpokeVpcConstruct, DfToolsVpcConstruct } from '../vpc';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { AccountDefinition, DfAccounts } from '@dragonfly/utils';
import { DfAliasedKeyConstruct } from '../constructs';

export interface RdsCredentials {
  username: string;
  password: string;
}

export interface ParameterGroupParams {
  name: string;
  value: string;
  applyMethod?: string;
}

export interface RdsReplicaConfig {
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  replicaProvider: AwsProvider;
  replicaClusterParameterGroupName?: string;
  replicaClusterParameters?: ParameterGroupParams[];
  replicaClusterFamily: string;
  replicaKmsKeyArn?: string;
  instanceIdentifierOverride?: string;
  clusterIdentifierOverride?: string;
}

export interface BaseRdsConfig {
  id: string;
  subnetIds: string[];
  engine?: string;
  engineVersion?: string;
  storageType?: string;
  allocatedStorage: number;
  vpcResource: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  instanceClass: string;
  accountDefinition: AccountDefinition;
  snapshotId?: string;
  rdsCredentials: RdsCredentials;
  databaseName?: string;
  clusterParameterGroupName?: string;
  kmsKey?: DfAliasedKeyConstruct;
  multiAz?: boolean;
  applyImmediately?: boolean;
  replicaConfig?: RdsReplicaConfig;
  sopsDbProperty?: string;
  primaryProvider?: AwsProvider;
  backupPolicy?: string;
  prodCustomerData?: boolean;
  additionalSubnets?: string[];
  backupRetentionPeriod?: number;
  multiRegion?: boolean;
  kmsNameOverride?: string;
}

/**
 * Base Rds Stack
 */
export class DfBaseRdsConstruct extends Construct {
  protected dbSubnetGroup: DbSubnetGroup;
  protected dbSecurityGroup: SecurityGroup;

  /**
   *
   * @param {string} envName - Environment that will own this stack
   * @param {Construct} scope - Root CDK app
   * @param {string} id - Id to use for construct id
   * @param {RdsConfig} rdsConfig - The config for RDS
   */
  public constructor(
    envName: string,
    scope: Construct,
    id: string,
    rdsConfig: BaseRdsConfig
  ) {
    super(scope, id);

    this.dbSubnetGroup = new DbSubnetGroup(
      this,
      `${envName}-${rdsConfig.id}-rdsGroup`,
      {
        provider: rdsConfig.primaryProvider,
        name: `${envName}-${rdsConfig.id}-rdsSubnetGroup`.toLowerCase(),
        subnetIds: rdsConfig.subnetIds,
        tags: { Name: rdsConfig.id },
      }
    );

    rdsConfig.additionalSubnets = rdsConfig.additionalSubnets
      ? rdsConfig.additionalSubnets
      : [];

    this.dbSecurityGroup = new SecurityGroup(
      this,
      `${rdsConfig.id}-rdsSecurityGroup`,
      {
        provider: rdsConfig.primaryProvider,
        name: `${rdsConfig.id}-rdsSecurityGroup`,
        vpcId: rdsConfig.vpcResource.vpcId,
        ingress: [
          {
            fromPort: 1521,
            toPort: 1521,
            protocol: 'tcp',
            cidrBlocks: [
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .primary.gatewayVpcCidr,
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .legacy.gatewayVpcCidr,
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .recovery.gatewayVpcCidr,
              rdsConfig.vpcResource.vpcCidrBlock,
            ],
            description: 'Allow incoming Client VPN and local VPC connections',
          },
          {
            fromPort: 5432,
            toPort: 5432,
            protocol: 'tcp',
            cidrBlocks: [
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .primary.gatewayVpcCidr,
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .legacy.gatewayVpcCidr,
              DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                .recovery.gatewayVpcCidr,
              rdsConfig.vpcResource.vpcCidrBlock,
              ...rdsConfig.additionalSubnets,
            ],
            description: 'Allow incoming Client VPN and local VPC connections',
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
  }
}
