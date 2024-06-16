import { DfAliasedKeyConstruct, DfPrivateInstanceConstruct, DfSpokeVpcConstruct, DfToolsVpcConstruct } from "@dragonfly/constructs";
import { RemoteStack, StackConfig } from "../stacks"
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Constants } from "@dragonfly/utils";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";

export interface DfNewRelicNetworkMonitorStackConfig {
  provider: AwsProvider;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  regionAlias: Constants.AWS_REGION_ALIASES;
}

export class DfNewRelicNetworkMonitorStack extends RemoteStack {
  private networkMonitorInstance: DfPrivateInstanceConstruct;
  private instanceRole: IamRole;


  constructor(stackUuid: string, stackConfig: StackConfig, config: DfNewRelicNetworkMonitorStackConfig) {
    super(stackUuid, stackConfig);
    const networkMonitorKey = new DfAliasedKeyConstruct(
      this,
      'newrelic-network-monitor-kms-key',
      {
        name: 'newrelic-network-monitor',
        description: `KMS Key for Network Monitor Instance`,
        provider: config.provider,
      }
    );

    this.instanceRole = new IamRole(this, 'newrelic-network-monitor-instance-role', {
      provider: config.provider,
      name: `newrelic-network-monitor-instance-role-${config.regionAlias}`.toLowerCase(),
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
      inlinePolicy: [
        {
          name: 'ansible-ec2-tagging',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ec2:CreateTags',
                  'ec2:DeleteTags',
                  'ec2:DescribeTags',
                ],
                Resource: '*',
              },
            ],
          })
        }
      ],         
      tags: { Name: 'newrelic-network-monitor-instance-role' },
    });


    this.networkMonitorInstance = DfPrivateInstanceConstruct.linuxInstanceFactory({
      scope: this,
      name: 'newrelic-network-monitor',
      constructProps: {
        vpc: config.vpc,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS[config.regionAlias][
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 't3.small',
          keyName: 'newrelic-network-monitor',
          rootBlockDevice: {
            volumeSize: 150,
            volumeType: 'gp3',
            encrypted: true,
            kmsKeyId: networkMonitorKey.key.arn,
          },
          tags: {
            hostname: 'newrelic-network-monitor',
            'ansible-managed': 'true',
            application: 'newrelic-network-monitor',
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
              udp: [5143, 1620, 161], // 5143 - Syslog, 1620 - SNMP Traps - 161 - SNMP
            },
          },
        },
      },
    });
  }
}
