import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { EfsFileSystem } from '@cdktf/provider-aws/lib/efs-file-system';
import { EfsFileSystemPolicy } from '@cdktf/provider-aws/lib/efs-file-system-policy';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DragonflyServiceKmsKey } from '@dragonfly/components';
import { DfSpokeVpcConstruct, DfToolsVpcConstruct } from '../vpc';
import { Construct } from 'constructs';
import { EfsMountTarget } from '@cdktf/provider-aws/lib/efs-mount-target';
import { EfsAccessPoint } from '@cdktf/provider-aws/lib/efs-access-point';
import { EfsReplicationConfiguration } from '@cdktf/provider-aws/lib/efs-replication-configuration';
import { Constants } from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export interface DfEfsReplicaConfig {
  recoveryVpc?: DfSpokeVpcConstruct;
  recoveryProvider?: AwsProvider;
}

export interface DfEfsConfig {
  readonly cidrBlocks?: string[];
  readonly securityGroups?: string[];
  readonly throughputMode?: string;
  readonly forContainer?: boolean;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  accessPoints?: DfEfsAccessPoint[];
  replicaConfig?: DfEfsReplicaConfig;
  provider?: AwsProvider;
  backupPolicy?: string;
}

export interface DfEfsAccessPoint {
  posixUser: {
    gid: number;
    uid: number;
  };
  rootDirectory: {
    path: string;
    creationInfo: {
      ownerGid: number;
      ownerUid: number;
      permissions: string;
    };
  };
}

/**
 * EFS Construct
 */
export class DfEfsConstruct extends Construct {
  private efsKey: DragonflyServiceKmsKey;
  private efs: EfsFileSystem;
  private efsAccessPoints: EfsAccessPoint[];
  private efsSecurityGroup: SecurityGroup;
  private efsPolicy: EfsFileSystemPolicy;
  private _replicationConfig: EfsReplicationConfiguration;

  public datasource: {
    region: DataAwsRegion;
    account: DataAwsCallerIdentity;
  } = {
    region: null,
    account: null,
  };

  /**
   *
   * @param {Construct} scope - The CDK Stack
   * @param {string} id - EFS id
   * @param {DfEfsConfig} efsConfig - EFS config
   */
  constructor(scope: Construct, id: string, efsConfig: DfEfsConfig) {
    super(scope, id);

    this.getDataSources(efsConfig.provider);

    this.efsKey = new DragonflyServiceKmsKey(this, id, {
      provider: efsConfig.provider,
    });

    this.efs = new EfsFileSystem(this, `${id}-Efs`, {
      provider: efsConfig.provider,
      encrypted: true,
      kmsKeyId: this.efsKey.arn,
      performanceMode: 'generalPurpose',
      throughputMode: efsConfig.throughputMode || 'bursting',
      tags: {
        Name: `${id}-Efs`,
        'backup-policy': efsConfig.backupPolicy ?? 'root-ou-efs',
      },
      lifecyclePolicy: [
        {
          transitionToIa: 'AFTER_7_DAYS',
        },
        {
          transitionToPrimaryStorageClass: 'AFTER_1_ACCESS',
        },
      ],
    });

    /*
     * This efs policy allows clients read and write access to the file system
     * and allows root access to the file system only when clients connect using tls
     */
    this.efsPolicy = new EfsFileSystemPolicy(this, `${id}-efsPolicy`, {
      provider: efsConfig.provider,
      fileSystemId: this.efs.id,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: [
              'elasticfilesystem:ClientMount',
              'elasticfilesystem:ClientWrite',
              'elasticfilesystem:ClientRootAccess',
            ],
            Principal: {
              AWS: '*',
            },
            Effect: 'Allow',
            Resource: [this.efs.arn],
            Condition: {
              Bool: {
                'aws:SecureTransport': 'true',
              },
            },
          },
        ],
      }),
    });

    this.efsSecurityGroup = new SecurityGroup(this, `${id}-Efs-SecurityGroup`, {
      provider: efsConfig.provider,
      name: id,
      description: `Efs Security Group for ${id}`,
      vpcId: efsConfig.vpc.vpcId,
      ingress: [
        {
          fromPort: 2049,
          toPort: 2049,
          protocol: 'tcp',
          cidrBlocks: efsConfig.cidrBlocks,
          securityGroups: efsConfig.securityGroups,
          description: `Efs Security Group for ${id}`,
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
        Name: `${id}Efs`,
      },
    });

    efsConfig.vpc.dataSubnetIds.forEach((subnet, index) => {
      new EfsMountTarget(this, `${id}-${index}`, {
        provider: efsConfig.provider,
        fileSystemId: this.efs.id,
        securityGroups: [this.efsSecurityGroup.id],
        subnetId: subnet,
      });
    });

    if (efsConfig.accessPoints) {
      this.efsAccessPoints = efsConfig.accessPoints.map(
        (accessPoint: DfEfsAccessPoint, index) => {
          let prefix = `${id}-${index}`;
          if (index === 0) {
            prefix = id;
          }
          return new EfsAccessPoint(this, `${prefix}-EfsAccessPoint`, {
            provider: efsConfig.provider,
            fileSystemId: this.efs.id,
            posixUser: accessPoint.posixUser || {
              gid: 0,
              uid: 0,
            },
            rootDirectory: accessPoint.rootDirectory || {
              path: '/',
              creationInfo: {
                ownerGid: 1000,
                ownerUid: 1000,
                permissions: '755',
              },
            },
            tags: {
              Name: `${prefix}-EfsAccessPoint`,
            },
          });
        }
      );
    }

    if (efsConfig.replicaConfig) {
      this._replicationConfig = new EfsReplicationConfiguration(
        this,
        `${id}-efs-replication`,
        {
          provider: efsConfig.provider,
          sourceFileSystemId: this.efs.id,
          destination: {
            region: Constants.AWS_REGION_MAP.DFRECOVERY,
          },
        }
      );

      const replicaEfsSecurityGroup = new SecurityGroup(
        this,
        `${id}-Efs-Recovery-Security-Group`,
        {
          provider: efsConfig.replicaConfig.recoveryProvider,
          name: id,
          description: `Efs Recovery Security Group for ${id}`,
          vpcId: efsConfig.replicaConfig.recoveryVpc.vpcId,
          ingress: [
            {
              fromPort: 2049,
              toPort: 2049,
              protocol: 'tcp',
              cidrBlocks: [efsConfig.replicaConfig.recoveryVpc.vpcCidrBlock],
              description: `Efs Security Group for ${id}`,
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
            Name: `${id}Efs`,
          },
        }
      );

      efsConfig.replicaConfig.recoveryVpc.dataSubnetIds.forEach(
        (subnet, index) => {
          new EfsMountTarget(this, `replica-${id}-${index}`, {
            provider: efsConfig.replicaConfig.recoveryProvider,
            fileSystemId: this._replicationConfig.destination.fileSystemId,
            securityGroups: [replicaEfsSecurityGroup.id],
            subnetId: subnet,
          });
        }
      );
    }
  }

  /**
   * Creates data sources for region and account
   * @param {AwsProvider} provider provider for the DfEfsConstruct
   */
  private getDataSources(provider: AwsProvider) {
    this.datasource.region = new DataAwsRegion(this, 'region', {
      provider: provider,
    });
    this.datasource.account = new DataAwsCallerIdentity(this, 'account', {
      provider: provider,
    });
  }

  /**
   * @return {string} - A token representing the id attribute of the EFS terraform resource
   */
  public get efsId(): string {
    return this.efs.id;
  }

  /**
   * @return {string} - A token representing the arn attribute of the EFS terraform resource
   */
  public get efsArn(): string {
    return this.efs.arn;
  }

  /**
   * @return {string} - A token representing the id attribute of the EFS access point terraform resource
   */
  public get accessPointIds(): string[] {
    return this.efsAccessPoints.map((accessPoint) => {
      return accessPoint.id;
    });
  }

  /**
   * @return {string} - A token representing the id attribute of the EFS access point terraform resource
   */
  public get accessPoints(): EfsAccessPoint[] {
    return this.efsAccessPoints;
  }

  /**
   * @return {string} - A token representing the id attribute of the EFS security group terraform resource
   */
  public get efsAddress(): string {
    return this.efs.dnsName;
  }

  /**
   * @return {EfsReplicationConfiguration} - EFS replication config
   */
  public get replicationConfig(): EfsReplicationConfiguration {
    return this._replicationConfig;
  }
}
