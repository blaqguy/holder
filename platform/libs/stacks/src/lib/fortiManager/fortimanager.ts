import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import {
  DfAliasedKeyConstruct,
  DfAttachedEbsVolume,
  DfPrivateInstanceConstruct,
  DfPublicIngressConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { Constants, Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { S3BackendConfig } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

/**
 * @interface FortigateManagerConfig - The configuration for the Palo Alto Panorama stack
 * @property {Constants.AWS_REGION_ALIASES} region - The Region to deploy the stack to
 * @property {DfToolsVpcConstruct} vpc - The VPC for the stack
 */
interface FortigateManagerConfig {
  /**
   * The VPC for the stack
   */
  vpcs: {
    primary: DfToolsVpcConstruct;
    recovery: DfToolsVpcConstruct;
  };
  networkInstanceS3BackendProps: S3BackendConfig;
  recoveryNetworkInstanceS3BackendProps: S3BackendConfig;
}

/**
 * Creates an instance of DfFortiManager.
 * Deploys N number of Palo Alto Panorama instances along with the required dependencies.
 */
export class DfFortiManager extends RemoteStack {
  private iamRole: IamRole;
  private privateHostedZone: DataAwsRoute53Zone;
  private sharedNetworkProvider: AwsProvider;

  /**
   *
   * @param {string} stackName: The name of the stack
   * @param {StackConfig} stackConfig:  The configuration of the stack
   * @param {PaloAltoPanoramaConfig} config: The configuration for the Fortigate Fortimanager stack
   */
  constructor(
    private readonly stackName: string,
    protected stackConfig: StackConfig,
    config: FortigateManagerConfig
  ) {
    super(stackName, stackConfig);

    // Hardcoded region since I'm using the provider for R53 which is a Global Resource
    this.sharedNetworkProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        Constants.AWS_REGION_MAP[Constants.AWS_REGION_ALIASES.LEGACY]
      ),
      forAccount: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const trustPolicy = Utils.createTrustPolicyDocument(
      this,
      'fortimanager-trust-policy',
      ['ec2.amazonaws.com']
    );

    this.iamRole = new IamRole(this, 'fortimanager-role', {
      name: 'fortimanager',
      assumeRolePolicy: trustPolicy.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess',
      ],
      tags: {
        Name: 'fortimanager',
      },
    });

    this.privateHostedZone = new DataAwsRoute53Zone(
      this,
      'dragonfly-private-zone',
      {
        provider: this.sharedNetworkProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );

    const primaryFortiInstance = this.createFortiResources(
      this.primaryProvider,
      config.vpcs.primary,
      Constants.MANAGED_AMI_IDS.DFPRIMARY[Constants.AMIS.FORTIGATE_FORTIMANAGER]
    );

    // const recoveryFortiInstance = this.createFortiResources(
    //   this.recoveryProvider,
    //   config.vpcs.recovery,
    //   Constants.MANAGED_AMI_IDS.DFRECOVERY[
    //     Constants.AMIS.FORTIGATE_FORTIMANAGER
    //   ],
    //   'recovery'
    // );

    new DfPublicIngressConstruct(
      this,
      'fortigate-nlb',
      {
        providers: {
          constructProvider: this.primaryProvider,
          networkProvider: this.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getSharedNetworkAccountProviderConfig(),
          }),
          masterProvider: this.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getMasterAccountProviderConfig(),
          }),
          route53Provider: this.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getSharedNetworkAccountProviderConfig(),
          }),
          recoveryProvider: this.recoveryProvider,
        },
        networkBackendProps: config.networkInstanceS3BackendProps,
        recoveryNetworkBackendProps:
          config.recoveryNetworkInstanceS3BackendProps,
        certDomainName: `fortimanager.dragonflyft.com`,
        r53RecordName: `fortimanager.dragonflyft.com`,
        albName: 'fortigateNlb',
        instancesForTargetGroup: [primaryFortiInstance],
        wafId: null,
        shared: {},
        ipWhitelist: [],
        deployToXL: true,
      },
      null,
      true,
      this.stackConfig.accountDefinition
    );
  }

  /**
   *
   * @param {AwsProvider} provider
   * @param {DfToolsVpcConstruct} vpc
   * @param {string} ami
   * @param {string} suffix
   * @return {DfPrivateInstanceConstruct}
   */
  private createFortiResources(
    provider: AwsProvider,
    vpc: DfToolsVpcConstruct,
    ami: string,
    suffix?: string
  ): DfPrivateInstanceConstruct {
    const fortiSG = new SecurityGroup(this, `forti-SG0`, {
      provider: provider,
      vpcId: vpc.vpcId,
      description: 'fortimanager security group',
      name: 'fortimanager',
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
          description: 'allow ssh access',
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
        {
          fromPort: 161,
          toPort: 161,
          description: 'allow snmp access',
          protocol: 'udp',
          cidrBlocks: [vpc.vpcCidrBlock],
        }
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
        Name: 'fortimanager',
      },
    });

    const fortimanagerKmsKey = new DfAliasedKeyConstruct(
      this,
      `fortimanager-kms-key-0`,
      {
        name: 'fortimanager',
        description: `KMS Key used by fortimanager resources`,
        provider: provider,
      }
    );

    const instanceName = suffix
      ? `fortimanager-01-${suffix}`
      : `fortimanager-01`;

    const fortimanagerInstance =
      DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: instanceName,
        constructProps: {
          vpc: vpc,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: ami,
            instanceType: 'm5.2xlarge',
            keyName: 'fortimanager',
            rootBlockDevice: {
              volumeSize: 81,
              volumeType: 'gp3',
              encrypted: true,
              kmsKeyId: fortimanagerKmsKey.key.arn,
            },
            tags: {
              hostname: instanceName,
              'ansible-managed': 'false',
              application: 'fortimanager',
            },
          },
          options: {
            createKeyPair: true,
            securityGroup: {
              resource: fortiSG,
            },
            subnet: {
              resource: vpc.appSubnets[0],
            },
            provider: provider,
            instanceProfileRole: this.iamRole,
          },
        },
      });

    new DfAttachedEbsVolume(this, `fortimanager-instancedir-0`, {
      provider: provider,
      volume: {
        name: 'fortimanager-secondary-volume',
        size: 100,
        type: 'gp3',
      },
      attachment: {
        deviceName: '/dev/xvdf',
      },
      deps: {
        instance: fortimanagerInstance,
        encrypted: true,
        key: fortimanagerKmsKey,
      },
    });

    new Route53Record(this, `forti-dns-records-0`, {
      provider: this.sharedNetworkProvider,
      name: `${instanceName}.dragonflyft.com.`,
      type: 'A',
      records: [fortimanagerInstance.instanceResource.privateIp],
      zoneId: this.privateHostedZone.id,
      ttl: 300,
    });

    return fortimanagerInstance;
  }
}
