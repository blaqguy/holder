import { IamInstanceProfile } from '@cdktf/provider-aws/lib/iam-instance-profile';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import {
  Instance,
  InstanceConfig,
  InstanceNetworkInterface,
} from '@cdktf/provider-aws/lib/instance';
import {
  SecurityGroup,
  SecurityGroupIngress,
} from '@cdktf/provider-aws/lib/security-group';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import {
  AccountDefinition,
  AccountProviderConfig,
  Constants,
  DfAccounts,
} from '@dragonfly/utils';
import { Construct } from 'constructs';
import {
  DfAliasedKeyConstruct,
  DfAttachedEbsVolume,
  DfKeyPairConstruct,
} from '../constructs';
import { DfSecurityGroupConstruct } from '../securityGroup/dfSecurityGroupConstruct';
import {
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
  ReDfInspectionVpcConstruct,
} from '../vpc';
import { Fn } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import path from 'path';

interface Route53Config {
  region: Constants.AWS_REGION_ALIASES;
  accountProviderConfig: AccountProviderConfig;
  dnsName: string;
  envSubdomain: string;
}

export interface DfPrivateInstanceConstructProps {
  vpc?: DfSpokeVpcConstruct | ReDfInspectionVpcConstruct | DfToolsVpcConstruct;
  // Config for the EC2 instance
  instanceResourceConfig: InstanceConfig;
  accountDefinition: AccountDefinition;
  // Helper options that add extra logic to the construct
  options?: {
    createKeyPair?: boolean;
    volumes?: {
      volumeName: string;
      volumeSize: number;
      volumeKey?: DfAliasedKeyConstruct;
      deviceName: string;
      encrypted?: boolean;
      volumeType?: 'gp3';
    }[];
    securityGroup?: {
      resource?: SecurityGroup | SecurityGroup[];
      ports?: {
        tcp: Array<number | [number, number]>;
        udp: Array<number | [number, number]>;
      };
      ingresses?: SecurityGroupIngress[];
    };
    subnet?: {
      resource?: Subnet;
      azIndex?: number;
    };
    instanceProfileRole?: IamRole;
    overrideInTransitSubnet?: boolean;
    userData?: {
      templateEnabled?: boolean;
      template: string;
      params: { [key: string]: string };
    };
    provider?: AwsProvider;
    region?: Constants.AWS_REGION_ALIASES;
    networkInterface?: InstanceNetworkInterface[];
    iamInstanceProfileNameOverride?: string;
    recoveredInstance?: boolean;
  };
  backupPolicy?: string;
  route53Config?: Route53Config; // Used for adding route53 records to windows workstation stacks
}

interface DfPrivateInstanceConstructNamedConstructorParams {
  scope: Construct;
  name: string;
  constructProps: DfPrivateInstanceConstructProps;
}

/**
 * PrivateInstanceStack stack
 */
export class DfPrivateInstanceConstruct extends Construct {
  private scope: Construct;
  private constructProps: DfPrivateInstanceConstructProps;
  public readonly constructName: string;
  private instanceSecurityGroupResource: SecurityGroup | SecurityGroup[];
  private keyPairConstruct: DfKeyPairConstruct;
  private instanceKeyPairName: string;
  private instanceProfile: string | undefined;
  private instanceSubnetResource: Subnet;
  private _instanceResource: Instance;
  private instanceUserData: string;

  /**
   *
   */
  constructor({
    scope,
    name,
    constructProps,
  }: DfPrivateInstanceConstructNamedConstructorParams) {
    super(scope, name);

    // https://github.com/Microsoft/TypeScript/issues/5326
    this.scope = scope;
    this.constructName = name;
    this.constructProps = constructProps;

    this.instanceSecurityGroupResource =
      this.constructProps.options?.securityGroup?.resource ??
      this.createSecurityGroup();

    this.instanceKeyPairName = this.constructProps.options?.createKeyPair
      ? this.createKeyPair().keyName
      : this.constructProps.instanceResourceConfig.keyName;

    this.instanceProfile = this.constructProps.instanceResourceConfig
      ?.iamInstanceProfile
      ? this.constructProps.instanceResourceConfig.iamInstanceProfile
      : this.createInstanceProfile()?.name || undefined;

    if (
      this.constructProps.vpc instanceof DfSpokeVpcConstruct ||
      this.constructProps.vpc instanceof DfToolsVpcConstruct
    ) {
      this.instanceSubnetResource =
        // See if we should override in transit subnet, this is a deprecated flag
        this.constructProps.options?.overrideInTransitSubnet
          ? this.constructProps.vpc.transitSubnets[0]
          : this.constructProps.options?.subnet?.resource ??
            this.constructProps.vpc.appSubnets[
              this.constructProps.options?.subnet?.azIndex || 0
            ];
    } else {
      // Must be of Inspection VPC type
      this.instanceSubnetResource = this.constructProps.options
        ?.overrideInTransitSubnet
        ? this.constructProps.vpc.transitSubnets[0]
        : this.constructProps.options?.subnet?.resource ??
          this.constructProps.vpc.transitSubnets[
            this.constructProps.options?.subnet?.azIndex || 0
          ];
    }

    let osTags;

    switch (
      Constants.OS_FAMILY_MAP[this.constructProps.instanceResourceConfig.ami]
    ) {
      case 'windows':
        osTags = {
          os: 'windows',
        };

        this.instanceUserData = this.constructProps.options?.userData
          ?.templateEnabled
          ? Fn.templatefile(
              this.constructProps.options.userData.template,
              this.constructProps.options.userData.params
            )
          : this.constructProps.instanceResourceConfig.userData ??
            Fn.file(
              `${path.resolve(
                __dirname,
                'buildAssets/scripts'
              )}/install-ssm-agent.ps1`
            );

        break;
      case 'linux':
        osTags = {
          os: 'linux',
        };

        this.instanceUserData = this.constructProps.options?.userData
          ?.templateEnabled
          ? Fn.templatefile(
              this.constructProps.options.userData.template,
              this.constructProps.options.userData.params
            )
          : this.constructProps.instanceResourceConfig.userData ??
            Fn.file(
              `${path.resolve(
                __dirname,
                'buildAssets/scripts'
              )}/install-ssm-agent.sh`
            );
        // * Ensure required tags for config management are set
        if (
          !this.constructProps.instanceResourceConfig.tags?.hostname ||
          !this.constructProps.instanceResourceConfig.tags?.[
            'ansible-managed'
          ] ||
          !this.constructProps.instanceResourceConfig.tags?.application
        ) {
          throw new Error(
            'Linux instance is missing required tags: hostname, ansible-managed, and application'
          );
        }

        break;
      default:
        if (this.constructProps.options.recoveredInstance) {
          console.warn(
            'Not tagging recovered instance: ' +
              this.constructProps.instanceResourceConfig.ami
          );
        } else {
          throw new Error(
            `DFT ERROR: Unknown AMI: ${this.constructProps.instanceResourceConfig.ami}`
          );
        }
    }

    // These policies are created in dfBackupPoliciesStack.ts
    switch (constructProps.accountDefinition.accountType) {
      case 'prod': {
        this.constructProps.backupPolicy = 'prod-ou-ec2';
        break;
      }
      case 'uat': {
        this.constructProps.backupPolicy = 'uat-ou-ec2';
        break;
      }
      case 'ist': {
        this.constructProps.backupPolicy = 'ist-ou-ec2';
        break;
      }
      default: {
        this.constructProps.backupPolicy = 'root-ou-ec2';
        break;
      }
    }

    const overrides = {
      provider: this.constructProps.options?.provider,
      iamInstanceProfile: this.instanceProfile,
      rootBlockDevice: {
        ...this.constructProps.instanceResourceConfig.rootBlockDevice,
        volumeType:
          this.constructProps.instanceResourceConfig.rootBlockDevice
            ?.volumeType ?? 'gp3',
      },
      keyName: this.instanceKeyPairName,
      vpcSecurityGroupIds: Array.isArray(this.instanceSecurityGroupResource)
        ? this.instanceSecurityGroupResource.map((sg) => sg.id)
        : [this.instanceSecurityGroupResource.id],
      subnetId: this.instanceSubnetResource.id,
      userData: this.instanceUserData,
      disableApiTermination:
        this.constructProps.instanceResourceConfig.disableApiTermination ??
        true,
      metadataOptions: {
        httpEndpoint: 'enabled',
        httpTokens: 'required',
        // Setting hop limit to 2 instead of default of 1 based on "Considerations" section in aws instancedata docs - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
        httpPutResponseHopLimit: 2,
      },
      tags: {
        Name: this.constructName,
        'backup-policy': this.constructProps.backupPolicy,
        configured: 'False',
        ...this.constructProps.instanceResourceConfig.tags,
        ...osTags,
      },
    };

    this._instanceResource = new Instance(this, 'Instance', {
      ...this.constructProps.instanceResourceConfig,
      ...overrides,
      lifecycle: {
        ...this.constructProps.instanceResourceConfig.lifecycle,
        ignoreChanges: [
          'tags["configured"]',
          ...(this.constructProps.instanceResourceConfig.lifecycle
            ?.ignoreChanges ?? []),
        ],
      },
    });

    this.constructProps.options?.volumes?.forEach((volumeConfig) => {
      this.attachVolume(this, volumeConfig, this.constructName);
    });
  }

  /**
   *
   * @param {string} keyName Name of KeyPair
   * @return {KeyPair}
   */
  private createKeyPair() {
    this.keyPairConstruct = new DfKeyPairConstruct(this, this.constructName, {
      keyName: this.constructProps.instanceResourceConfig.keyName,
      provider: this.constructProps.options?.provider,
    });
    return this.keyPairConstruct.getKeyPairResource();
  }

  /**
   *
   * @return {IamInstanceProfile}
   */
  private createInstanceProfile(): IamInstanceProfile {
    return this.constructProps.options?.instanceProfileRole
      ? new IamInstanceProfile(this, `InstanceProfile`, {
          provider: this.constructProps.options?.provider,
          name:
            this.constructProps.options?.iamInstanceProfileNameOverride ??
            `${this.constructName}-InstanceProfile`,
          role: this.constructProps.options?.instanceProfileRole.name,
          tags: { Name: `${this.constructName}-instance-profile` },
        })
      : new IamInstanceProfile(this, `default-instance-profile`, {
          provider: this.constructProps.options?.provider,
          name:
            this.constructProps.options?.iamInstanceProfileNameOverride ??
            `${this.constructName}-default-instance-profile`,
          role: new IamRole(
            this,
            `default-instance-role-${this.constructName}`,
            {
              provider: this.constructProps.options?.provider,
              name:
                this.constructProps.options?.iamInstanceProfileNameOverride ??
                `default-instance-role-${this.constructName}`,
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
                'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
                'arn:aws:iam::aws:policy/AmazonSSMDirectoryServiceAccess',
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
              tags: { Name: `default-instance-role-${this.constructName}` },
            }
          ).name,
          tags: { Name: `${this.constructName}-instance-profile` },
        });
  }

  /**
   * @return {SecurityGroup}
   */
  private createSecurityGroup(): SecurityGroup {
    return new DfSecurityGroupConstruct(this, 'SG', {
      provider: this.constructProps.options?.provider,
      name: this.constructName,
      vpcConstruct: this.constructProps.vpc,
      extraPorts: this.constructProps.options?.securityGroup?.ports ?? {
        tcp: [],
        udp: [],
      },
      accountDefinition: this.constructProps.accountDefinition,
      additionalIngress: [
        {
          description: 'Allow all from PUPI CIDR Range',
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: [
            DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary.additionalCidrs.join(
              ','
            ),
          ],
        },
        ...(this.constructProps.options?.securityGroup?.ingresses ?? []),
      ],
    }).securityGroupResource;
  }

  /**
   *
   * @param {DfPrivateInstanceConstruct} instance
   * @param {{string, number, string}} config
   * @param {string} instanceName
   */
  private attachVolume(
    instance: DfPrivateInstanceConstruct,
    config: {
      volumeName: string;
      volumeSize: number;
      volumeKey?: DfAliasedKeyConstruct;
      deviceName: string;
      encrypted?: boolean;
      volumeType?: 'gp3';
    },
    instanceName: string
  ) {
    new DfAttachedEbsVolume(
      this.scope,
      `${instanceName}-${config.volumeName}-EBS`,
      {
        volume: {
          name: `${instanceName}-${config.volumeName}`,
          type: config.volumeType ?? 'gp3',
          size: config.volumeSize,
        },
        attachment: {
          deviceName: config.deviceName,
        },
        deps: {
          instance: instance,
          key: config.volumeKey,
          encrypted: config.encrypted,
        },
        provider: this.constructProps.options.provider,
      }
    );
  }

  /**
   * Forces the AZ of the instance to be the same as the AZ of the subnet
   *
   * @return {string}
   */
  public get instanceAz(): string {
    return this.instanceSubnetResource.availabilityZone;
  }

  /**
   * @return {Instance}
   */
  public get instanceResource(): Instance {
    return this._instanceResource;
  }

  /**
   * @return {SecurityGroup}
   */
  public get securityGroupResources(): SecurityGroup[] {
    if (Array.isArray(this.instanceSecurityGroupResource)) {
      return this.instanceSecurityGroupResource;
    }
    return [this.instanceSecurityGroupResource];
  }

  /**
   * @return {string}
   */
  public get securityGroupResource(): SecurityGroup {
    if (Array.isArray(this.instanceSecurityGroupResource)) {
      return this.instanceSecurityGroupResource[0];
    }
    return this.instanceSecurityGroupResource;
  }

  /**
   * @param {DfPrivateInstanceConstructNamedConstructorParams} factoryOptions
   * @return {DfPrivateInstanceConstruct}
   */
  public static windowsInstanceFactory(
    factoryOptions: DfPrivateInstanceConstructNamedConstructorParams
  ): DfPrivateInstanceConstruct {
    factoryOptions.constructProps.instanceResourceConfig = {
      ...factoryOptions.constructProps.instanceResourceConfig,
      ...{
        ami:
          factoryOptions.constructProps.instanceResourceConfig.ami ??
          Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default'],
      },
    };

    return new DfPrivateInstanceConstruct(factoryOptions);
  }

  /**
   * @param {DfPrivateInstanceConstructNamedConstructorParams} factoryOptions
   * @return {DfPrivateInstanceConstruct}
   */
  public static linuxInstanceFactory(
    factoryOptions: DfPrivateInstanceConstructNamedConstructorParams
  ): DfPrivateInstanceConstruct {
    factoryOptions.constructProps.instanceResourceConfig = {
      ...factoryOptions.constructProps.instanceResourceConfig,
      ...{
        ami:
          factoryOptions.constructProps.instanceResourceConfig.ami ??
          'ami-09d3b3274b6c5d4aa',
      },
    };
    return new DfPrivateInstanceConstruct(factoryOptions);
  }

  /**
   *
   */
  public get instancePubKey() {
    if (this.keyPairConstruct) {
      return this.keyPairConstruct.getPubKey();
    }
  }
}
