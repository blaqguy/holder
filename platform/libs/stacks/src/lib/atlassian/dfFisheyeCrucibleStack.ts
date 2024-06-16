import { AccountProviderConfig, Constants, Utils } from '@dragonfly/utils';
import { DfWafStack, RemoteStack, StackConfig } from '../stacks';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import {
  DfAliasedKeyConstruct,
  DfAttachedEbsVolume,
  DfPrivateInstanceConstruct,
  DfPsqlRdsConstruct,
  DfPublicIngressConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Fn, S3BackendConfig } from 'cdktf';
import path from 'path';
import { password as FisheyeCruciblePassword } from '@cdktf/provider-random';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';

export interface DfFisheyeCrucibleStackConfig {
  provider: AwsProvider;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  instanceType: string;
  sharedNetworkBackendProps: S3BackendConfig;
  recoverySharedNetworkBackendProps: S3BackendConfig;
  sharedNetworkProviderConfig: AccountProviderConfig;
  masterProviderConfig: AccountProviderConfig;
}

/* eslint-disable require-jsdoc */
export class DfFisheyeCrucibleStack extends RemoteStack {
  private fisheyeCrucibleInstance: DfPrivateInstanceConstruct;
  private fisheyeCrucibleDB: DfPsqlRdsConstruct;

  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private config: DfFisheyeCrucibleStackConfig
  ) {
    super(stackName, stackConfig);

    const trustPolicy = Utils.createTrustPolicyDocument(
      this,
      'fisheye-crucible-trust-policy',
      ['ec2.amazonaws.com'],
      config.provider
    );

    const iamRole = new IamRole(this, 'fisheye-crucible-role', {
      provider: config.provider,
      name: 'fisheye-crucible',
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
          }),
        },
      ],
      tags: {
        Name: 'fisheye-crucible',
      },
    });

    const fisheyeCrucibleSG = new SecurityGroup(this, 'fisheye-crucible-SG', {
      provider: config.provider,
      description: 'fisheye-crucible security group',
      name: 'fisheye-crucible',
      vpcId: config.vpc.vpcId,
      ingress: [
        {
          fromPort: 22,
          toPort: 22,
          description: 'allow ssh access',
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
        {
          fromPort: 8060,
          toPort: 8060,
          description: 'allow http access',
          protocol: 'tcp',
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
        Name: 'fisheye-crucible',
      },
    });

    const fisheyeCrucibleKmsKey = new DfAliasedKeyConstruct(
      this,
      'fisheye-crucible-kms-key',
      {
        name: 'fisheye-crucible',
        description: `KMS Key used by fisheye-crucible resources`,
        provider: config.provider,
      }
    );

    this.fisheyeCrucibleInstance =
      DfPrivateInstanceConstruct.linuxInstanceFactory({
        scope: this,
        name: 'fisheye-crucible',
        constructProps: {
          vpc: config.vpc,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
              Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
            ],
            instanceType: 'c5.2xlarge',
            keyName: 'fisheye-crucible',
            rootBlockDevice: {
              volumeSize: 50,
              volumeType: 'gp3',
              encrypted: true,
              kmsKeyId: fisheyeCrucibleKmsKey.key.arn,
            },
            userData: Fn.file(
              `${path.resolve(
                __dirname,
                'buildAssets/scripts'
              )}/install-ssm-agent.sh`
            ),
            tags: {
              hostname: 'fisheye-crucible',
              'ansible-managed': 'true',
              application: 'fisheye-crucible',
            },
          },
          options: {
            createKeyPair: true,
            securityGroup: {
              resource: fisheyeCrucibleSG,
            },
            provider: config.provider,
            instanceProfileRole: iamRole,
          },
        },
      });

    new DfAttachedEbsVolume(this, 'fisheye-crucible-instanceDir', {
      provider: config.provider,
      volume: {
        name: 'fisheye-crucible-instance-dir',
        size: 250,
        type: 'gp3',
      },
      attachment: {
        deviceName: '/dev/xvdf',
      },
      deps: {
        instance: this.fisheyeCrucibleInstance,
        encrypted: true,
        key: fisheyeCrucibleKmsKey,
      },
    });

    const fisheyeWaf = new DfWafStack('fisheyeWaf', this.stackConfig, {
      ipv4WhiteList: Constants.FISHEYE_WHITELIST_IPV4,
      ipv6WhiteList: Constants.FISHEYE_WHITELIST_IPV6,
      listName: 'fisheyeWhitelist',
    });
    new DfPublicIngressConstruct(
      this,
      'fisheye',
      null,
      {
        providers: {
          constructProvider: this.primaryProvider,
          networkProvider: this.createAwsProvider({
            supportedRegion: Utils.getRegionAliasFromRegion(
              this.primaryProvider.region
            ),
            forAccount: config.sharedNetworkProviderConfig,
          }),
          masterProvider: this.createAwsProvider({
            supportedRegion: Utils.getRegionAliasFromRegion(
              this.primaryProvider.region
            ),
            forAccount: config.masterProviderConfig,
          }),
          route53Provider: this.createAwsProvider({
            supportedRegion: Utils.getRegionAliasFromRegion(
              this.primaryProvider.region
            ),
            forAccount: config.sharedNetworkProviderConfig,
          }),
          recoveryProvider: this.recoveryProvider,
        },
        networkBackendProps: config.sharedNetworkBackendProps,
        recoveryNetworkBackendProps: config.recoverySharedNetworkBackendProps,
        certDomainName: `fisheye-crucible.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        r53RecordName: `fisheye-crucible.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        albName: 'fisheye-public-ALB',
        instancesForTargetGroup: [this.fisheyeCrucibleInstance],
        wafId: fisheyeWaf.webAclArn,
        shared: {},
        albProps: {
          targetPort: 8060,
          targetProtocol: 'HTTP',
          healthCheck: {
            path: '/',
            port: '8060',
            protocol: 'HTTP',
          },
          skipInternalRecord: true,
        },
      },
      false,
      this.stackConfig.accountDefinition
    );
    this.addDependency(fisheyeWaf);

    const fisheyeCruciblePassword = new FisheyeCruciblePassword.Password(
      this,
      'fisheye-crucible-password',
      {
        length: 16,
        special: false,
      }
    );

    new SsmParameter(this, 'fisheye-crucible-param', {
      provider: config.provider,
      name: 'fisheye-crucible-password',
      type: 'SecureString',
      value: fisheyeCruciblePassword.result,
      description: 'Fisheye Crucible RDS password',
      tags: { Name: 'fisheye-crucible-password' },
    });

    this.fisheyeCrucibleDB = new DfPsqlRdsConstruct(this, 'fisheye-rds', {
      provider: config.provider,
      vpc: config.vpc,
      securityGroup: {
        allowedCidrBlocks: ['0.0.0.0/0'],
      },
      dbOptions: {
        rdsInstanceName: 'fisheye',
        dbVersion: '14.9',
        allocatedStorage: 100,
        instanceClass: 'db.t3.medium',
        dbName: 'fisheye',
        username: 'fisheye',
        password: fisheyeCruciblePassword.result,
        autoMinorVersionUpgrade: false,
      },
    });
  }

  public get fisheyeCrucibleInstanceResource() {
    return this.fisheyeCrucibleInstance;
  }

  public get fisheyeDbResource() {
    return this.fisheyeCrucibleDB.dbResource;
  }
}
