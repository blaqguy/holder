import {
  DfPrivateInstanceConstruct,
} from '@dragonfly/constructs';
import {
  AccountProviderConfig,
  Constants,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import {
  DfSpokeVpcStack,
  DfToolsVpcStack,
  RemoteStack,
  StackConfig,
} from '../stacks';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { S3BackendConfig } from 'cdktf';

interface DfSvnStackConfig {
  regionAlias: Constants.AWS_REGION_ALIASES;
  sopsData: PlatformSecrets;
  vpc: DfSpokeVpcStack | DfToolsVpcStack;
  masterAccountProviderConfig: AccountProviderConfig;
  sharedNetworkAccountProviderConfig: AccountProviderConfig;
  networkInstanceS3BackendProps: S3BackendConfig;
}

/**
 * SVN Stack Stack
 */
export class DfSvnStack extends RemoteStack {
  public static readonly STACK_ID = 'SvnStack';

  private svnInstance: DfPrivateInstanceConstruct;
  private instanceRole: IamRole;

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   */
  public constructor(
    protected stackId: string,
    protected stackConfig: StackConfig,
    protected svnStackConfig: DfSvnStackConfig
  ) {
    super(stackId, stackConfig);
    const provider = this.getProviderForRegion(svnStackConfig.regionAlias);

    this.instanceRole = new IamRole(this, 'svn-instance-role', {
      provider: provider,
      name: 'svn-instance-role',
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
      tags: { Name: 'svn-instance-role' },
    });

    this.svnInstance = DfPrivateInstanceConstruct.linuxInstanceFactory({
      scope: this,
      name: Utils.createStackResourceId(this.stackId, 'svn-linux-instance'),
      constructProps: {
        vpc: svnStackConfig.vpc.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.SVN_MASTER_IMAGE
          ],
          instanceType: 't2.large',
          keyName: 'svn-linux-instance',
          rootBlockDevice: {
            volumeSize: 800,
            deleteOnTermination: false,
          },
          tags: {
            Name: 'svn',
            hostname: 'svn',
            'config-management-playbook': 'svn',
            'ansible-managed': 'true',
            application: 'svn',
          },
        },
        options: {
          createKeyPair: true,
          securityGroup: {
            ingresses: [
              {
                fromPort: 443,
                toPort: 443,
                protocol: 'tcp',
                cidrBlocks: [Constants.VPC_CIDR_BLOCK_ANY_SPOKE],
              },
              {
                fromPort: 80,
                toPort: 80,
                protocol: 'tcp',
                cidrBlocks: [Constants.VPC_CIDR_BLOCK_ANY_SPOKE],
              },
            ],
          },
          instanceProfileRole: this.instanceRole,
        },
      },
    });
  }

  /**
   * @return {DfPrivateInstanceConstruct} - svnInstanceConstruct
   */
  public get svnInstanceConstruct(): DfPrivateInstanceConstruct {
    return this.svnInstance;
  }
}
