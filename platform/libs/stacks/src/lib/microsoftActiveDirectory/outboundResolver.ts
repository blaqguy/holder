import { AccountProviderConfig, Constants } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { DfMicrosoftActiveDirectory } from './microsoftActiveDirectoryStack';
import { DataTerraformRemoteStateS3, Fn, S3BackendConfig } from 'cdktf';
import { DirectoryServiceSharedDirectory } from '@cdktf/provider-aws/lib/directory-service-shared-directory';
import { DirectoryServiceSharedDirectoryAccepter } from '@cdktf/provider-aws/lib/directory-service-shared-directory-accepter';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Route53ResolverEndpoint } from '@cdktf/provider-aws/lib/route53-resolver-endpoint';
import { Route53ResolverRule } from '@cdktf/provider-aws/lib/route53-resolver-rule';
import { Route53ResolverRuleAssociation } from '@cdktf/provider-aws/lib/route53-resolver-rule-association';
import { DataAwsDirectoryServiceDirectory } from '@cdktf/provider-aws/lib/data-aws-directory-service-directory';
import {
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';

/**
 * Represents configuration options for creating a Microsoft Active Directory outbound resolver.
 * @property {string} stackId - The ID of the stack.
 * @property {StackConfig} stackConfig - The stack configuration.
 * @property {boolean} deployToTools - Whether to deploy to the tools account.
 * @property {string} targetAccountId - The target account ID.
 * @property {DfSpokeVpcConstruct | DfToolsVpcConstruct} resolverVpcs - The VPCs for the resolver.
 * @property {AccountProviderConfig} accountProviderConfig - The account provider configuration.
 * @property {S3BackendConfig} dfMicrosoftActiveDirectoryBackendConfig - The Microsoft Active Directory backend configuration.
 * @property {DfMicrosoftActiveDirectory} dfMicrosoftActiveDirectoryStack - The Microsoft Active Directory stack.
 */
interface MicrosoftOutboundResolverConfig {
  /**
   * The ID of the stack.
   */
  stackId: string;
  /**
   * The stack configuration.
   */
  stackConfig: StackConfig;
  /**
   * Whether to deploy to the tools account.
   */
  deployToTools: boolean;
  /**
   * The target account ID.
   */
  targetAccountId?: string;
  /**
   * The VPCs for the resolver.
   */
  resolverVpcs: {
    legacyVpc?: DfSpokeVpcConstruct | DfToolsVpcConstruct;
    primaryVpc?: DfSpokeVpcConstruct | DfToolsVpcConstruct;
    recoveryVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  };
  /**
   * The account provider configuration.
   */
  accountProviderConfig?: AccountProviderConfig;
  /**
   * The Microsoft Active Directory backend configuration.
   */
  dfMicrosoftActiveDirectoryBackendConfig?: S3BackendConfig;
  /**
   * The Microsoft Active Directory stack.
   */
  dfMicrosoftActiveDirectoryStack?: DfMicrosoftActiveDirectory;
}

/**
 * Represents a Microsoft Active Directory outbound resolver.
 * Also creates the domain join ssm association.
 * @see - This is dependent on the Microsoft Active Directory stack.
 * @extends {RemoteStack}
 */
export class MicrosoftOutboundResolver extends RemoteStack {
  private remoteStateMicrosoftActiveDirectory?: DataTerraformRemoteStateS3;
  private shareDirectories: {
    [region: string]: DirectoryServiceSharedDirectory;
  } = {};
  private sharedDirectories: {
    [region: string]: DirectoryServiceSharedDirectoryAccepter;
  } = {};

  /**
   *
   * @param {MicrosoftOutboundResolverConfig} config - The configuration for the Microsoft Active Directory outbound resolver.
   */
  constructor(config: MicrosoftOutboundResolverConfig) {
    super(config.stackId, config.stackConfig);

    // Ensure that the required configuration is provided
    if (
      !config.deployToTools &&
      !config.dfMicrosoftActiveDirectoryBackendConfig
    ) {
      throw new Error(
        'You must pass in an instance of dfMicrosoftActiveDirectoryBackendConfig if deployToTools is false'
      );
    } else if (
      config.deployToTools &&
      !config.dfMicrosoftActiveDirectoryStack
    ) {
      throw new Error(
        'You must pass in an instance of dfMicrosoftActiveDirectory if deployToTools is true'
      );
    }

    const sharingConfig = [
      {
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        terraformOutput:
          Constants.CROSS_STACK_OUTPUT_RECOVERY_MICROSOFT_DIRECTORY_ID,
        stackProvider: this.recoveryProvider,
        vpc: config.resolverVpcs.recoveryVpc,
        ...(config.deployToTools && {
          microsoftDirectoryId:
            config.dfMicrosoftActiveDirectoryStack
              .recoveryMicrosoftActiveDirectoryId,
        }),
      },
    ];

    // Some accounts don't use the primary region. Conditionally add it to the sharingConfig
    if (config.resolverVpcs.primaryVpc) {
      sharingConfig.unshift({
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        terraformOutput:
          Constants.CROSS_STACK_OUTPUT_PRIMARY_MICROSOFT_DIRECTORY_ID,
        stackProvider: this.primaryProvider,
        vpc: config.resolverVpcs.primaryVpc,
        ...(config.deployToTools && {
          microsoftDirectoryId:
            config.dfMicrosoftActiveDirectoryStack
              .primaryMicrosoftActiveDirectoryId,
        }),
      });
    }
    if (config.resolverVpcs.legacyVpc) {
      // Same here, some accounts don't use the legacy region. Conditionally add it to the sharingConfig
      sharingConfig.unshift({
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        terraformOutput:
          Constants.CROSS_STACK_OUTPUT_LEGACY_MICROSOFT_DIRECTORY_ID,
        stackProvider: null,
        vpc: config.resolverVpcs.legacyVpc,
        ...(config.deployToTools && {
          microsoftDirectoryId:
            config.dfMicrosoftActiveDirectoryStack
              .legacyMicrosoftActiveDirectoryId,
        }),
      });
    }

    // Share Microsoft Directory with target account in our three active regions if not deploying to tools account
    sharingConfig.forEach(
      ({
        region,
        terraformOutput,
        stackProvider,
        vpc,
        microsoftDirectoryId,
      }) => {
        if (!config.deployToTools) {
          const toolsProvider = this.createAwsProvider({
            supportedRegion: region,
            forAccount: config.accountProviderConfig,
          });

          this.remoteStateMicrosoftActiveDirectory =
            new DataTerraformRemoteStateS3(
              this,
              `df-microsoft-ad-remote-state-${region}`,
              config.dfMicrosoftActiveDirectoryBackendConfig
            );

          this.shareDirectories[region] = new DirectoryServiceSharedDirectory(
            this,
            `df-microsoft-ad-shared-directory-${region}`,
            {
              provider: toolsProvider,
              directoryId:
                this.remoteStateMicrosoftActiveDirectory.getString(
                  terraformOutput
                ),
              target: {
                id: config.targetAccountId,
              },
            }
          );

          this.sharedDirectories[region] =
            new DirectoryServiceSharedDirectoryAccepter(
              this,
              `df-microsoft-ad-shared-directory-accepter-${region}`,
              {
                provider: stackProvider,
                sharedDirectoryId:
                  this.shareDirectories[region].sharedDirectoryId,
              }
            );
        }

        // Deploy the Outbound Resolver
        const resolverSecurityGroup = new SecurityGroup(
          this,
          `outbound-resolver-sg-${region}`,
          {
            provider: stackProvider,
            name: 'microsoft-ad-outbound-resolver',
            vpcId: vpc.vpcId,
            ingress: [
              {
                fromPort: 0,
                toPort: 0,
                protocol: 'tcp',
                cidrBlocks: ['0.0.0.0/0'],
                description: 'Allow all traffic to resolver endpoint',
              },
            ],
            egress: [
              {
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0'],
                description: 'Allow all outbound traffic',
              },
            ],
            tags: {
              Name: 'microsoft-ad-outbound-resolver',
            },
          }
        );

        const resolver = new Route53ResolverEndpoint(
          this,
          `outbound-resolver-${region}`,
          {
            provider: stackProvider,
            name: 'dragonfly-internal',
            direction: 'OUTBOUND',
            securityGroupIds: [resolverSecurityGroup.id],
            ipAddress: [
              {
                subnetId: vpc.appSubnetIds[0],
              },
              {
                subnetId: vpc.appSubnetIds[1],
              },
              {
                subnetId: vpc.appSubnetIds[2],
              },
            ],
            tags: { Name: 'dragonfly-internal' },
          }
        );

        /**
         * If we're deploying to tools, pass in instance of Microsoft AD stack and pull DNS IPs from there
         * Value of the DNS ips isn't known till deploy time so we have to use Fn.element to get the value as it's a TF list
         * The replicas don't export there DNS IPs so I'm just going to do a data lookup for all the DNS IPs
         */
        const directoryDnsIps = new DataAwsDirectoryServiceDirectory(
          this,
          `df-microsoft-ad-dns-ips-${region}`,
          {
            provider: stackProvider,
            directoryId: config.deployToTools
              ? microsoftDirectoryId
              : this.sharedDirectories[region].sharedDirectoryId,
          }
        ).dnsIpAddresses;

        const resolverRule = new Route53ResolverRule(
          this,
          `outbound-resolver-rule-${region}`,
          {
            provider: stackProvider,
            domainName: Constants.MICROSOFT_ACTIVE_DIRECTORY_DOMAIN_NAME,
            name: 'dragonfly-internal',
            ruleType: 'FORWARD',
            resolverEndpointId: resolver.id,
            targetIp: [
              {
                ip: Fn.element(directoryDnsIps, 0),
                port: 53,
              },
              {
                ip: Fn.element(directoryDnsIps, 1),
                port: 53,
              },
            ],
            tags: { Name: 'dragonfly-internal' },
          }
        );

        new Route53ResolverRuleAssociation(
          this,
          `outbound-resolver-rule-association-${region}`,
          {
            provider: stackProvider,
            resolverRuleId: resolverRule.id,
            vpcId: vpc.vpcId,
          }
        );

        // Domain join document
        new SsmAssociation(this, `df-domain-join-${region}`, {
          provider: stackProvider,
          name: 'AWS-JoinDirectoryServiceDomain',
          associationName: 'domain-join-windows',
          parameters: {
            directoryId: config.deployToTools
              ? microsoftDirectoryId
              : this.sharedDirectories[region].sharedDirectoryId,
            directoryName: Constants.MICROSOFT_ACTIVE_DIRECTORY_DOMAIN_NAME,
          },
          targets: [
            {
              key: 'tag:os',
              values: ['windows'],
            },
          ],
        });
      }
    );
  }

  /**
   * Return primary shared directory id
   */
  public get primarySharedDirectoryId() {
    return this.sharedDirectories[Constants.AWS_REGION_ALIASES.DF_PRIMARY]
      ?.sharedDirectoryId;
  }

  /**
   * Return recovery shared directory id
   */
  public get recoverySharedDirectoryId() {
    return this.sharedDirectories[Constants.AWS_REGION_ALIASES.DF_RECOVERY]
      ?.sharedDirectoryId;
  }

  /**
   * Return legacy shared directory id
   */
  public get legacySharedDirectoryId() {
    return this.sharedDirectories[Constants.AWS_REGION_ALIASES.LEGACY]
      ?.sharedDirectoryId;
  }
}
