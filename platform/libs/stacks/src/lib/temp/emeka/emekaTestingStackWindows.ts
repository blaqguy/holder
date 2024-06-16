import {
  DfPrivateInstanceConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../../stacks';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Constants, Utils } from '@dragonfly/utils';
import { FsxWindowsFileSystem } from '@cdktf/provider-aws/lib/fsx-windows-file-system';

interface EmekaTestingStackWindowsConfig {
  stackName: string;
  region: Constants.AWS_REGION_ALIASES;
  stackConfig: StackConfig;
  vpc: DfSpokeVpcConstruct;
  directoryId: string;
}

export class EmekaTestingStackWindows extends RemoteStack {
  private fsx: FsxWindowsFileSystem;

  constructor(config: EmekaTestingStackWindowsConfig) {
    super(config.stackName, config.stackConfig);

    const provider = this.getProviderForRegion(config.region);

    const trustPolicy = Utils.createTrustPolicyDocument(
      this,
      'emeka-testing-trust-policy',
      ['ec2.amazonaws.com'],
      provider
    );

    const iamRole = new IamRole(this, `emeka-testing-role-${config.region}`, {
      provider,
      name: `emeka-testing-${config.region}`,
      assumeRolePolicy: trustPolicy.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonSSMDirectoryServiceAccess',
      ],
      tags: {
        Name: `emeka-testing-${config.region}`,
      },
    });

    const sg = new SecurityGroup(this, `emeka-testing-SG-${config.region}`, {
      provider,
      description: 'emeka testing security group',
      name: `emeka-testing-SG-${config.region}`,
      vpcId: config.vpc.vpcId,
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          description: 'allow all',
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      tags: {
        Name: `emeka-testing-${config.region}`,
      },
    });

    DfPrivateInstanceConstruct.windowsInstanceFactory({
      scope: this,
      name: `emeka-testing-windows-${config.region}`,
      constructProps: {
        vpc: config.vpc,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          disableApiTermination: false,
          ami: this.getWindowsAmi(Constants.AWS_REGION_MAP[config.region]),
          instanceType: 't3.medium',
          keyName: 'emeka-testing-windows',
          rootBlockDevice: {
            volumeSize: 30,
          },
          tags: {
            hostname: 'emeka-testing-windows',
          },
        },
        options: {
          provider: provider,
          instanceProfileRole: iamRole,
          createKeyPair: true,
          securityGroup: { resource: sg },
          subnet: {
            azIndex: 0,
          },
        },
      },
    });

    this.fsx = new FsxWindowsFileSystem(this, 'emeka-test-fsx', {
      provider,
      deploymentType: 'MULTI_AZ_1',
      activeDirectoryId: config.directoryId,
      securityGroupIds: [sg.id],
      preferredSubnetId: config.vpc.adDataSubnetIds[0],
      subnetIds: [config.vpc.adDataSubnetIds[0], config.vpc.adDataSubnetIds[1]],
      throughputCapacity: 32,
      storageType: 'SSD',
      storageCapacity: 1024,
      tags: {
        Name: 'emeka-test-fsx',
      },
      auditLogConfiguration: {
        fileAccessAuditLogLevel: 'SUCCESS_AND_FAILURE',
        fileShareAccessAuditLogLevel: 'SUCCESS_AND_FAILURE',
      },
      automaticBackupRetentionDays: 30,
      skipFinalBackup: false,
    });
  }

  /**
   *
   * @param {string} region
   * @return {string}
   */
  private getWindowsAmi(region: string): string {
    switch (region) {
      case Constants.AWS_REGION_MAP.DFPRIMARY:
        return Constants.MANAGED_AMI_IDS.DFPRIMARY[
          Constants.AMIS.WINDOWS_2022_DEFAULT_V4
        ];

      case Constants.AWS_REGION_MAP.DFRECOVERY:
        return Constants.MANAGED_AMI_IDS.DFRECOVERY[
          Constants.AMIS.WINDOWS_2022_DEFAULT_V4
        ];

      case Constants.AWS_REGION_MAP.LEGACY:
        return Constants.MANAGED_AMI_IDS.LEGACY[
          Constants.AMIS.WINDOWS_2022_DEFAULT_V4
        ];
    }
  }

  public get fsxArn(): string {
    return this.fsx.arn;
  }
}
