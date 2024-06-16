import { DirectoryServiceDirectory } from '@cdktf/provider-aws/lib/directory-service-directory';
import { RemoteStack, StackConfig } from '../stacks';
import {
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { TerraformOutput } from 'cdktf';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { CloudwatchLogResourcePolicy } from '@cdktf/provider-aws/lib/cloudwatch-log-resource-policy';
import { DirectoryServiceLogSubscription } from '@cdktf/provider-aws/lib/directory-service-log-subscription';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import { DirectoryServiceRegion } from '@cdktf/provider-aws/lib/directory-service-region';
import { createSupportInstances } from './supportInstances';

/**
 * Represents configuration options for creating a Microsoft Active Directory stack.
 * @property {string} domainName - The name of the domain.
 * @property {object} vpcs - The VPCs for the primary and replica domain controllers.
 */
interface DfMicrosoftActiveDirectoryConfig {
  /**
   * The name of the domain
   */
  domainName: string;
  /**
   * The VPCs for the primary and replica domain controllers.
   */
  vpcs: {
    primaryDomainControllersVpc: DfToolsVpcConstruct;
    replicaDomainControllersVpcs: {
      [Constants.AWS_REGION_ALIASES.DF_RECOVERY]: DfToolsVpcConstruct;
      [Constants.AWS_REGION_ALIASES.LEGACY]: DfToolsVpcConstruct;
    };
  };
}

/**
 * Represents a Microsoft Active Directory stack.
 * @see - The cross environment helper, OutboundResolver, for sharing this resource across environments and regions.
 * @extends {RemoteStack}
 */
export class DfMicrosoftActiveDirectory extends RemoteStack {
  private primaryMicrosoftActiveDirectory: DirectoryServiceDirectory;
  private replicaMicrosoftActiveDirectoryResources: DirectoryServiceRegion[] = [];
  /**
   * @param {string} stackId - The ID of the stack.
   * @param {StackConfig} StackConfig - The stack configuration.
   * @param {DfMicrosoftActiveDirectoryConfig} config - The Microsoft Active Directory configuration.
   */
  constructor(
    protected readonly stackId: string,
    protected readonly StackConfig: StackConfig,
    readonly config: DfMicrosoftActiveDirectoryConfig
  ) {
    super(stackId, StackConfig);

    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    new SsmParameter(this, 'df-microsoft-ad-pw', {
      provider: this.primaryProvider,
      name: 'df-microsoft-ad-pw',
      type: 'SecureString',
      value: sopsData.DOMAIN_ADMIN_PW,
      tags: { Name: 'df-microsoft-ad-pw' },
    });

    // Primary Domain Controllers
    this.primaryMicrosoftActiveDirectory = new DirectoryServiceDirectory(
      this,
      'df-microsoft-ad',
      {
        provider: this.primaryProvider,
        name: config.domainName,
        password: sopsData.DOMAIN_ADMIN_PW,
        type: 'MicrosoftAD',
        edition: 'Enterprise',
        vpcSettings: {
          subnetIds: config.vpcs.primaryDomainControllersVpc.appSubnetIds.slice(
            0,
            2
          ),
          vpcId: config.vpcs.primaryDomainControllersVpc.vpcId,
        },
        tags: { Name: 'df-microsoft-ad' },
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_PRIMARY_MICROSOFT_DIRECTORY_ID,
      {
        value: this.primaryMicrosoftActiveDirectory.id,
      }
    );

    /**
     * Domain Controller Replicas
     * ! These replica resource don't output the dnsIpAddresses like the primary resource does.
     * ! Will perform a lookup for them in the Outbound Resolver resource as needed
     */
    Object.entries(config.vpcs.replicaDomainControllersVpcs).forEach(
      ([regionAlias, vpc]) => {
        const replica = new DirectoryServiceRegion(
          this,
          `df-microsoft-ad-replica-${regionAlias}`,
          {
            provider: this.primaryProvider,
            directoryId: this.primaryMicrosoftActiveDirectory.id,
            regionName: Constants.AWS_REGION_MAP[regionAlias],
            vpcSettings: {
              subnetIds: vpc.appSubnetIds.slice(0, 2),
              vpcId: vpc.vpcId,
            },
            tags: { Name: `df-microsoft-ad-replica-${regionAlias}` },
          }
        );

        this.replicaMicrosoftActiveDirectoryResources.push(replica);

        new TerraformOutput(
          this,
          regionAlias === Constants.AWS_REGION_ALIASES.DF_RECOVERY
            ? Constants.CROSS_STACK_OUTPUT_RECOVERY_MICROSOFT_DIRECTORY_ID
            : Constants.CROSS_STACK_OUTPUT_LEGACY_MICROSOFT_DIRECTORY_ID,
          {
            value: replica.directoryId,
          }
        );
      }
    );

    const logGroup = new CloudwatchLogGroup(this, 'ad-logs', {
      provider: this.primaryProvider,
      name: 'microsoft-ad',
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        this.stackConfig.federatedAccountId
      )
        ? 365
        : 30,
      tags: { Name: 'microsoft-ad' },
    });

    const policyDocument = new DataAwsIamPolicyDocument(
      this,
      'ad-logs-policy',
      {
        provider: this.primaryProvider,
        statement: [
          {
            actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            effect: 'Allow',
            principals: [
              {
                identifiers: ['ds.amazonaws.com'],
                type: 'Service',
              },
            ],
            resources: [`${logGroup.arn}:*`],
          },
        ],
      }
    );

    new CloudwatchLogResourcePolicy(this, 'ad-logs-resource-policy', {
      provider: this.primaryProvider,
      policyDocument: policyDocument.json,
      policyName: 'microsoft-ad-log-policy',
    });

    new DirectoryServiceLogSubscription(this, 'ad-log-subscription', {
      provider: this.primaryProvider,
      directoryId: this.primaryMicrosoftActiveDirectory.id,
      logGroupName: logGroup.name,
    });

    createSupportInstances({
      accountDefinition: this.stackConfig.accountDefinition,
      parentStack: this,
      provider: this.primaryProvider,
      vpc: config.vpcs.primaryDomainControllersVpc,
    });
  }

  /**
   * @return {DirectoryServiceDirectory} - The primary AWS AD resource id.
   */
  public get primaryMicrosoftActiveDirectoryId(): string {
    return this.primaryMicrosoftActiveDirectory.id;
  }

  /**
   * @return {DirectoryServiceRegion} - The recovery AWS AD resource id.
   */
  public get recoveryMicrosoftActiveDirectoryId(): string {
    return this.replicaMicrosoftActiveDirectoryResources[0].directoryId;
  }

  /**
   * @return {DirectoryServiceRegion} - The legacy AWS AD resource id.
   */
  public get legacyMicrosoftActiveDirectoryId(): string {
    return this.replicaMicrosoftActiveDirectoryResources[1].directoryId;
  }
}