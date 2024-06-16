import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import {
  DfAliasedKeyConstruct,
  DfAttachedEbsVolume,
  DfPrivateInstanceConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { Constants, Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';

/**
 * @interface PaloAltoPanoramaConfig - The configuration for the Palo Alto Panorama stack
 * @property {Constants.AWS_REGION_ALIASES} region - The Region to deploy the stack to
 * @property {DfToolsVpcConstruct} vpc - The VPC for the stack
 */
interface PaloAltoPanoramaConfig {
  /**
   * The VPC for the stack
   */
  vpcs: {
    primary: DfToolsVpcConstruct;
    recovery: DfToolsVpcConstruct;
  };
}

/**
 * Creates an instance of DfPaloAltoPanorama.
 * Deploys N number of Palo Alto Panorama instances along with the required dependencies.
 */
export class DfPaloAltoPanorama extends RemoteStack {
  /**
   *
   * @param {string} stackName: The name of the stack
   * @param {StackConfig} stackConfig:  The configuration of the stack
   * @param {PaloAltoPanoramaConfig} config: The configuration for the Palo Alto Panorama stack
   */
  constructor(
    private readonly stackName: string,
    protected stackConfig: StackConfig,
    config: PaloAltoPanoramaConfig
  ) {
    super(stackName, stackConfig);

    const props = [
      {
        provider: this.primaryProvider,
        vpc: config.vpcs.primary,
        ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
          Constants.AMIS.PALO_ALTO_PANORAMA
        ],
      },
      {
        provider: this.recoveryProvider,
        vpc: config.vpcs.recovery,
        ami: Constants.MANAGED_AMI_IDS.DFRECOVERY[
          Constants.AMIS.PALO_ALTO_PANORAMA
        ],
      },
    ];

    // Hardcoded region since I'm using the provider for R53 which is a Global Resource
    const sharedNetworkProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        Constants.AWS_REGION_MAP[Constants.AWS_REGION_ALIASES.LEGACY]
      ),
      forAccount: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const trustPolicy = Utils.createTrustPolicyDocument(
      this,
      'panorama-trust-policy',
      ['ec2.amazonaws.com']
    );

    const iamRole = new IamRole(this, 'panorama-role', {
      name: 'panorama',
      assumeRolePolicy: trustPolicy.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess',
      ],
      tags: {
        Name: 'panorama',
      },
    });

    const privateHostedZone = new DataAwsRoute53Zone(
      this,
      'dragonfly-private-zone',
      {
        provider: sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    props.forEach(({ provider, vpc, ami }, index) => {
      const panoramaSG = new SecurityGroup(this, `panorama-SG${index}`, {
        provider: provider,
        description: 'panorama security group',
        name: 'panorama',
        vpcId: vpc.vpcId,
        ingress: [
          {
            fromPort: 22,
            toPort: 22,
            description: 'allow ssh access',
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
          },
          {
            fromPort: 443,
            toPort: 443,
            description: 'allow https access',
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
          },
          {
            fromPort: 3978,
            toPort: 3978,
            description: 'allow panorama access',
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
          },
          {
            fromPort: 28,
            toPort: 28,
            description: 'HA connection using SSH over TCP',
            cidrBlocks: ['0.0.0.0/0'],
            protocol: 'tcp',
          },
          {
            fromPort: -1,
            toPort: -1,
            protocol: 'ICMP',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow Ping',
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
          Name: 'panorama',
        },
      });

      const panoramaKmsKey = new DfAliasedKeyConstruct(
        this,
        `panorama-kms-key-${index}`,
        {
          name: 'panorama',
          description: `KMS Key used by panorama resources`,
          provider: provider,
        }
      );

      const panoramaInstance = DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: `panorama-0${index + 1}`,
        constructProps: {
          vpc: vpc[index],
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: ami,
            instanceType: 'c5.4xlarge',
            keyName: 'panorama',
            rootBlockDevice: {
              volumeSize: 81,
              volumeType: 'gp3',
              encrypted: true,
              kmsKeyId: panoramaKmsKey.key.arn,
            },
            tags: {
              hostname: `panorama-0${index + 1}`,
              'ansible-managed': 'false',
              application: 'panorama',
            },
          },
          options: {
            createKeyPair: true,
            securityGroup: {
              resource: panoramaSG,
            },
            subnet: {
              resource: vpc.appSubnets[0],
            },
            provider: provider,
            instanceProfileRole: iamRole,
          },
        },
      });

      new DfAttachedEbsVolume(this, `panorama-instancedir-${index}`, {
        provider: provider,
        volume: {
          name: 'panorama-secondary-volume',
          size: 2048,
          type: 'gp3',
        },
        attachment: {
          deviceName: '/dev/xvdf',
        },
        deps: {
          instance: panoramaInstance,
          encrypted: true,
          key: panoramaKmsKey,
        },
      });

      new Route53Record(this, `pa-dns-records-${index}`, {
        provider: sharedNetworkProvider,
        name: `panorama-0${index + 1}.dragonflyft.com.`,
        type: 'A',
        records: [panoramaInstance.instanceResource.privateIp],
        zoneId: privateHostedZone.id,
        ttl: 300,
      });
    });
  }
}
