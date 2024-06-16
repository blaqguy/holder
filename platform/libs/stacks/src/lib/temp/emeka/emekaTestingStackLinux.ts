import { Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../../stacks';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import {
  DfAliasedKeyConstruct,
  DfAttachedEbsVolume,
  DfPrivateInstanceConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Fn } from 'cdktf';
import path from 'path';

interface EmekaTestingStackConfig {
  vpc: DfSpokeVpcConstruct;
}

export class EmekaTestingStackLinux extends RemoteStack {
  constructor(
    stackName: string,
    protected stackConfig: StackConfig,
    props: EmekaTestingStackConfig
  ) {
    super(stackName, stackConfig);

    const trustPolicy = Utils.createTrustPolicyDocument(
      this,
      'emeka-testing-trust-policy',
      ['ec2.amazonaws.com']
    );

    const iamRole = new IamRole(this, 'emeka-testing-role', {
      name: 'emeka-testing',
      assumeRolePolicy: trustPolicy.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess',
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
      tags: {
        Name: 'emeka-testing',
      },
    });

    const sg = new SecurityGroup(this, 'emeka-testing-SG', {
      description: 'emeka-testing security group',
      name: 'emeka-testing',
      vpcId: props.vpc.vpcId,
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
        Name: 'emeka-testing',
      },
    });

    const kms = new DfAliasedKeyConstruct(this, 'emeka-testing-kms-key', {
      name: 'emeka-testing',
      description: `KMS Key used by emeka-testing resources`,
    });

    const ec2 = DfPrivateInstanceConstruct.linuxInstanceFactory({
      scope: this,
      name: 'emeka-testing',
      constructProps: {
        vpc: props.vpc,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: 'ami-00c86b7c4413a60e1',
          instanceType: 't3.medium',
          keyName: 'emeka-testing',
          rootBlockDevice: {
            volumeSize: 30,
            volumeType: 'gp3',
            encrypted: true,
            kmsKeyId: kms.key.arn,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: {
            hostname: 'emeka-testing',
            'ansible-managed': 'true',
            application: 'emeka-testing',
          },
          disableApiTermination: false,
        },
        options: {
          createKeyPair: true,
          securityGroup: {
            resource: sg,
          },
          instanceProfileRole: iamRole,
        },
      },
    });

    new DfAttachedEbsVolume(this, 'emeka-testing-instanceDir', {
      volume: {
        name: 'emeka-testing-instance-dir',
        size: 30,
        type: 'gp3',
      },
      attachment: {
        deviceName: '/dev/xvdf',
      },
      deps: {
        instance: ec2,
        encrypted: true,
        key: kms,
      },
    });
  }
}
