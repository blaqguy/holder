import {
  DfPrivateInstanceConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { DfMicrosoftActiveDirectory } from './microsoftActiveDirectoryStack';
import { AccountDefinition, Utils } from '@dragonfly/utils';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { Constants } from '@dragonfly/utils';
import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

/**
 * Represents configuration options for creating support instances for the Microsoft Active Directory.
 * @property {DfMicrosoftActiveDirectory} parentStack - The parent stack.
 * @property {AwsProvider} provider - The provider.
 * @property {DfToolsVpcConstruct} vpc - The VPC.
 * @property {AccountDefinition} accountDefinition - The account definition.
 */
interface supportInstancesConfig {
  /**
   * The parent stack.
   */
  parentStack: DfMicrosoftActiveDirectory;
  /**
   * The provider.
   */
  provider: AwsProvider;
  /**
   * The VPC.
   */
  vpc: DfToolsVpcConstruct;
  /**
   * The account definition.
   */
  accountDefinition: AccountDefinition;
}

/**
 * Creates the management instance for the Microsoft Active Directory.
 * Creates the RDP CAL licensing server for the Microsoft Active Directory.
 * @param {supportInstancesConfig} config - The configuration for the management instance.
 */
export function createSupportInstances(config: supportInstancesConfig) {
  const trustPolicy = Utils.createTrustPolicyDocument(
    config.parentStack,
    'microsoft-ad-management',
    ['ec2.amazonaws.com'],
    config.provider
  );

  const iamRole = new IamRole(
    config.parentStack,
    'microsoft-ad-mangement-role',
    {
      provider: config.provider,
      name: 'microsoft-ad-management',
      assumeRolePolicy: trustPolicy.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'
      ],
      tags: {
        Name: 'microsoft-ad-management',
      },
    }
  );

  const instanceConfigs = [
    {
      name: 'ad-management',
      volumeSize: 30,
      instanceType: 't3.small',
      features: [
        'GPMC',
        'RSAT-AD-PowerShell',
        'RSAT-AD-AdminCenter',
        'RSAT-ADDS-Tools',
        'RSAT-DNS-Server',
      ],
    },
    {
      name: 'rdp-cal-management',
      volumeSize: 50,
      instanceType: 't3.small',
      features: [
        'GPMC',
        'RSAT-AD-PowerShell',
        'RSAT-AD-AdminCenter',
        'RSAT-ADDS-Tools',
        'RSAT-DNS-Server',
        'RDS-Gateway',
        'RDS-Connection-Broker',
        'RDS-RD-Server',
        'RDS-RD-Server-Host',
        'RDS-Licensing',
        'Web-Server',
        'Web-Windows-Auth',
        'Web-Filtering',
        'NET-Framework-45-Features',
        'NET-Framework-45-ASPNET',
        'Desktop-Experience',
        'Server-Gui-Mgmt-Infra',
        'Server-Gui-Shell',
      ],
    },
  ];

  instanceConfigs.forEach(({ name, volumeSize, instanceType, features }) => {
    DfPrivateInstanceConstruct.windowsInstanceFactory({
      scope: config.parentStack,
      name: name,
      constructProps: {
        vpc: config.vpc,
        accountDefinition: config.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default-v4'],
          keyName: name,
          instanceType: instanceType,
          rootBlockDevice: {
            volumeSize: volumeSize,
          },
          tags: {
            Name: name,
            Application: name,
          },
        },
        options: {
          createKeyPair: true,
          instanceProfileRole: iamRole,
          provider: config.provider,
          securityGroup: {
            ports: {
              tcp: [135, 137, 138, 139, [49152, 65535]],
              udp: [135, 137, 138, 139, [49152, 65535]],
            },
          },
        },
      },
    });

    new SsmAssociation(config.parentStack, `${name}-ssm-association`, {
      provider: config.provider,
      name: 'AWS-RunPowerShellScript',
      associationName: name,
      targets: [
        {
          key: 'tag:Application',
          values: [name],
        },
      ],
      parameters: {
        commands: `#Requires -RunAsAdministrator
                      $Features = $Features = "${features.join('","')}"
                      foreach ($Feature in $Features) {
                          if (-not (Get-WindowsFeature -Name $Feature).Installed) {
                              Install-WindowsFeature -Name $Feature -IncludeManagementTools -Restart
                          } else {
                              Write-Host "$Feature already installed"
                          }
                      }`,
      },
    });
  });
}
