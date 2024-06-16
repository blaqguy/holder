import { Constants, PlatformSecrets } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import {
  DfAliasedKeyConstruct,
  DfPrivateInstanceConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';

export interface DfNetworkSensorStackConfig {
  provider: AwsProvider;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  instanceType: string;
  regionAlias: Constants.AWS_REGION_ALIASES;
  sopsData: PlatformSecrets;
}

/**
 * Network Sensor Service Stack
 */
export class DfNetworkSensorStack extends RemoteStack {
  private networkSensorInstance: DfPrivateInstanceConstruct;
  private instanceRole: IamRole;

  /**
   *
   * @param {string} stackName - Stack Name
   * @param {StackConfig} stackConfig - Config for the stack
   * @param {DfNetworkSensorStackConfig} config - service configuration
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private config: DfNetworkSensorStackConfig
  ) {
    super(stackName, stackConfig);

    const networkSensorKmsKey = new DfAliasedKeyConstruct(
      this,
      'network-sensor-kms-key',
      {
        name: 'network-sensor',
        description: `KMS Key for Network Sensor instance`,
        provider: config.provider,
      }
    );

    this.instanceRole = new IamRole(this, 'network-sensor-instance-role', {
      provider: config.provider,
      name: `network-sensor-instance-role-${config.regionAlias}`.toLowerCase(),
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonElasticFileSystemReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonVPCReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
      ],
      tags: { Name: 'network-sensor-instance-role' },
    });

    this.networkSensorInstance =
      DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: 'network-sensor',
        constructProps: {
          vpc: config.vpc,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: Constants.MANAGED_AMI_IDS[config.regionAlias][
              Constants.AMIS.NETWORK_SENSOR
            ],
            instanceType: 't3.medium',
            keyName: 'network-sensor',
            rootBlockDevice: {
              volumeSize: 150,
              volumeType: 'gp3',
              encrypted: true,
              kmsKeyId: networkSensorKmsKey.key.arn,
            },
            tags: {
              hostname: 'network-sensor',
              'config-management-playbook':
                `network-sensor-${config.regionAlias}`.toLowerCase(),
              'ansible-managed': 'false', // Proprietary appliance, can't be managed by Ansible
              application: 'network-sensor',
            },
          },
          options: {
            createKeyPair: true,
            provider: config.provider,
            instanceProfileRole: this.instanceRole,
            iamInstanceProfileNameOverride: this.instanceRole.name,
            securityGroup: {
              ports: {
                tcp: [], 
                udp: [5140, 5515, 5555], // Brite rsyslog collector. 5140 for RHEL, 5515 for Palo, 5555 for Debian
              },
            },
          },
        },
      });
  }
}
