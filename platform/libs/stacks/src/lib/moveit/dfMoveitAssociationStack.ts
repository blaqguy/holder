import { Constants } from '@dragonfly/utils';
import {
  DfSpokeVpcStack,
  MoveitServiceStack,
  RemoteStack,
  StackConfig,
} from '../stacks';
import { FsxWindowsFileSystem } from '@cdktf/provider-aws/lib/fsx-windows-file-system';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DfFsxDataSyncTask } from '@dragonfly/constructs';

interface MoveitConfig {
  directoryIds: {
    primary: string;
    recovery: string;
  };
  moveitStack: MoveitServiceStack;
}

interface fsxConfig {
  securityGroupStackId: string;
  provider: AwsProvider;
  deploymentRegion: string;
  fsxStackId: string;
  directoryId: string;
}

/**
 * Stack to deploy MOVEit Ssm Parameters, Ssm Associations, and Fsx file system
 */
export class MoveitAssociationStack extends RemoteStack {
  /**
   * Constructs an instance of the DFMoveitAssociationStack
   * @param {string} stackId The ID of the stack
   * @param {StackConfig} stackConfig The configuration of the stack
   * @param {PlatformSecrets} sopsData - Sops data
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    protected vpcMap: {
      [x: string]: DfSpokeVpcStack;
    },
    protected moveitConfig: MoveitConfig
  ) {
    super(stackId, stackConfig);
    this.addDependency(this.moveitConfig.moveitStack);

    const primaryFsx = this.createFsx({
      securityGroupStackId: 'moveit-fsx-sg',
      provider: this.primaryProvider,
      deploymentRegion: Constants.AWS_REGION_MAP.DFPRIMARY,
      fsxStackId: 'Moveit-Fsx',
      directoryId: this.moveitConfig.directoryIds.primary,
    });

    const recoveryFsx = this.createFsx({
      securityGroupStackId: 'moveit-fsx-sg-recovery',
      provider: this.recoveryProvider,
      deploymentRegion: Constants.AWS_REGION_MAP.DFRECOVERY,
      fsxStackId: 'Moveit-Fsx-Recovery',
      directoryId: this.moveitConfig.directoryIds.recovery,
    });

    new DfFsxDataSyncTask(this, 'moveit', {
      providers: {
        source: this.primaryProvider,
        destination: this.recoveryProvider,
      },
      fsxArns: {
        source: primaryFsx.moveitFsx.arn,
        destination: recoveryFsx.moveitFsx.arn,
      },
      vpcs: {
        source: this.vpcMap[Constants.AWS_REGION_MAP.DFPRIMARY].vpcConstruct,
        destination: this.vpcMap[Constants.AWS_REGION_MAP.DFRECOVERY].vpcConstruct,
      },
      DataSyncTaskName: 'moveit',
      accountId: this.stackConfig.federatedAccountId,
    });
  }

  /**
   * Creates the Moveit ssm associations for the transfer and automation servers in the primary and recovery regions
   * @param {object} config - The primary region
   * @return {Array<SecurityGroup | FsxWindowsFileSystem>} - The security group and fsx file system
   */
  private createFsx(
    config: fsxConfig
  ): { fsxSecurityGroup: SecurityGroup, moveitFsx: FsxWindowsFileSystem } {
    const fsxSecurityGroup = new SecurityGroup(
      this,
      config.securityGroupStackId,
      {
        provider: config.provider,
        name: 'moveit-fsx-sg',
        description: `Security group for moveit Fsx`,
        vpcId: this.vpcMap[config.deploymentRegion].vpcConstruct.vpcId,
        ingress: [
          {
            fromPort: 53,
            toPort: 53,
            protocol: 'udp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Domain Name System (DNS) fsx connections',
          },
          {
            fromPort: 88,
            toPort: 88,
            protocol: 'udp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Kerberos authentication fsx connections',
          },
          {
            fromPort: 123,
            toPort: 123,
            protocol: 'udp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Network Time Protocol (NTP) fsx connections',
          },
          {
            fromPort: 389,
            toPort: 389,
            protocol: 'udp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Lightweight Directory Access Protocol (LDAP) fsx connections',
          },
          {
            fromPort: 464,
            toPort: 464,
            protocol: 'udp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Change/Set password fsx connections',
          },
          {
            fromPort: 53,
            toPort: 53,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Domain Name System (DNS) fsx connections',
          },
          {
            fromPort: 88,
            toPort: 88,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Kerberos authentication fsx connections',
          },
          {
            fromPort: 135,
            toPort: 135,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Distributed Computing Environment / End Point Mapper (DCE / EPMAP) fsx connections',
          },
          {
            fromPort: 389,
            toPort: 389,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Lightweight Directory Access Protocol (LDAP) fsx connections',
          },
          {
            fromPort: 445,
            toPort: 445,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Directory Services SMB file sharing fsx connections',
          },
          {
            fromPort: 464,
            toPort: 464,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Change/Set password fsx connections',
          },
          {
            fromPort: 636,
            toPort: 636,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Lightweight Directory Access Protocol over TLS/SSL (LDAPS) fsx connections',
          },
          {
            fromPort: 3268,
            toPort: 3268,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Microsoft Global Catalog fsx connections',
          },
          {
            fromPort: 3269,
            toPort: 3269,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Microsoft Global Catalog over SSL fsx connections',
          },
          {
            fromPort: 5985,
            toPort: 5985,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow WinRM 2.0 (Microsoft Windows Remote Management) fsx connections',
          },
          {
            fromPort: 9389,
            toPort: 9389,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description:
              'Allow Microsoft AD DS Web Services, PowerShell fsx connections',
          },
          {
            fromPort: 49152,
            toPort: 65535,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Ephemeral ports for RPC fsx connections',
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
          Name: 'moveit-fsx',
        },
      }
    );

    // Create the moveit FSx for windows for the ssm association
    const moveitFsx = new FsxWindowsFileSystem(this, config.fsxStackId, {
      provider: config.provider,
      deploymentType: 'MULTI_AZ_1',
      securityGroupIds: [fsxSecurityGroup.id],
      preferredSubnetId:
        this.vpcMap[config.deploymentRegion].vpcConstruct.adDataSubnetIds[0],
      subnetIds: [
        this.vpcMap[config.deploymentRegion].vpcConstruct.adDataSubnetIds[0],
        this.vpcMap[config.deploymentRegion].vpcConstruct.adDataSubnetIds[1],
      ],
      throughputCapacity: 32,
      activeDirectoryId: config.directoryId,
      storageType: 'SSD',
      storageCapacity: 1024,
      tags: {
        Name: 'moveit-fsx',
        'customer-data': 'true',
      },
      auditLogConfiguration: {
        fileAccessAuditLogLevel: 'SUCCESS_AND_FAILURE',
        fileShareAccessAuditLogLevel: 'SUCCESS_AND_FAILURE',
      },
      automaticBackupRetentionDays: 30,
      skipFinalBackup: false,
    });

    return { fsxSecurityGroup, moveitFsx };
  }
}
