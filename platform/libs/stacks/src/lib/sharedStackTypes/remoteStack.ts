import { ArchiveProvider } from '@cdktf/provider-archive/lib/provider';
import {
  AwsProvider,
  AwsProviderConfig,
} from '@cdktf/provider-aws/lib/provider';
import { NewrelicProvider } from '@cdktf/provider-newrelic/lib/provider';
import { RandomProvider } from '@cdktf/provider-random/lib/provider';
import { TlsProvider } from '@cdktf/provider-tls/lib/provider';
import {
  AccountDefinition,
  AccountProviderConfig,
  Constants,
  CustomerDefinition,
  DfAccounts,
  DfMultiRegionDeployment,
  DfMultiRegionDeploymentBase,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import { S3Backend, S3BackendConfig, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';

export interface StackConfig {
  envName: string;
  envSubdomain: string;
  scope: Construct;
  federatedAccountId: string;
  handler: RemoteStack[];
  providerRoleName: string;
  accountDefinition: AccountDefinition;
  customerDefinition: CustomerDefinition;
}

/**
 * Remote stack base class
 */
export class RemoteStack
  extends TerraformStack
  implements DfMultiRegionDeployment
{
  private backend: S3Backend;
  private s3BackendProps: S3BackendConfig;

  /**
   *
   * @param {string} stackUuid - Stack Config
   * @param {StackConfig} stackConfig - Handler that adds the stack being created currently to the handler object. For use in env files
   */
  constructor(protected stackUuid: string, protected stackConfig: StackConfig) {
    super(stackConfig.scope, `${stackConfig.envName}-${stackUuid}`);

    stackConfig.handler.push(this);
    this.s3BackendProps = Utils.createS3BackendProps(
      this.stackUuid,
      stackConfig.envName
    );
    this.stackUuid = [stackConfig.envName, this.stackUuid].join('-');

    this.backend = new S3Backend(this, this.s3BackendProps);

    // Create aws providers
    this.attatchDefaultProviders();
  }

  /**
   *
   * @param {Constants.AWS_REGION_ALIASES} region
   */
  public switchRegion(region: Constants.AWS_REGION_ALIASES): void {
    DfMultiRegionDeploymentBase.basicMultiRegionAspect(this, region);
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} region - Current stack region
   * @return {AwsProvider} - The AwsProvider that matches the passed in region
   */
  public getProviderForRegion(
    region: Constants.AWS_REGION_ALIASES
  ): AwsProvider {
    switch (region) {
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return this.primaryProvider;
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return this.recoveryProvider;
      case Constants.AWS_REGION_ALIASES.LEGACY:
        return null;
      case Constants.AWS_REGION_ALIASES.DF_SYDNEY:
        return this.sydneyProvider;
    }
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} region - Current stack region
   * @return {AwsProvider} - The AwsProvider that matches the passed in region
   */
  public getIngressCidrForRegion(region: Constants.AWS_REGION_ALIASES): string {
    switch (region) {
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        return DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
          .primary.gatewayVpcCidr;
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        return DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
          .recovery.gatewayVpcCidr;
      case Constants.AWS_REGION_ALIASES.LEGACY:
        return DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
          .legacy.gatewayVpcCidr;
    }
  }

  /**
   * @return {string} - Account id that manages TF state
   */
  protected get stateAccountId(): string {
    return Constants.STATE_ACCOUNT_ID;
  }

  /**
   * @return {string} - Role name to access state
   */
  protected get stateRoleName(): string {
    return Constants.STATE_ROLE_NAME;
  }

  /**
   *
   */
  public get environment(): string {
    return this.stackConfig.envName;
  }

  /**
   * @return {string} - Returns the stackUuid
   */
  public get getStackUuid(): string {
    return this.stackUuid;
  }

  /**
   * @param {string} overrideKeyValue
   * @return {S3BackendConfig}
   */
  public s3BackendPropsResource(): S3BackendConfig {
    return this.s3BackendProps;
  }

  /**
   * @return {AwsProvider}
   */
  public get primaryProvider(): AwsProvider {
    return Utils.getAwsProvider(
      this,
      'aws',
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   * @return {AwsProvider}
   */
  public get recoveryProvider(): AwsProvider {
    return Utils.getAwsProvider(
      this,
      'aws',
      Constants.AWS_REGION_ALIASES.DF_RECOVERY
    );
  }

  /**
   * @return {AwsProvider}
   */
  public get sydneyProvider(): AwsProvider {
    return Utils.getAwsProvider(
      this,
      'aws',
      Constants.AWS_REGION_ALIASES.DF_SYDNEY
    );
  }

  /**
   * @return {boolean}
   */
  public isInPlatformSandboxEnvironments(): boolean {
    return Constants.PLATFORM_SANDBOX_ACCOUNT_NUMBERS.includes(
      this.stackConfig.federatedAccountId
    );
  }

  /**
   *
   * @param {TerraformStack} stack
   *
   */
  private attatchDefaultProviders() {
    this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.LEGACY,
    });
    this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
    });
    this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
    });
    this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.DF_SYDNEY,
    });

    new TlsProvider(this, `TlsProvider`);
    // Retrieve sops data that contains secret Datadog api and app key
    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    /**
     * The archive provider is used to create zip files for use in SSM associations
     * See dfConfigManagementStack and dfSsmAnsibleAssociaitonConstruct
     */
    new ArchiveProvider(this, 'archive-provider');

    new NewrelicProvider(this, 'newrelic-provider', {
      region: 'US',
      accountId: sopsData.NEW_RELIC_ACCOUNT_ID,
      apiKey: sopsData.NEW_RELIC_API_KEY,
    });

    new RandomProvider(this, 'random-provider');
  }

  /**
   *
   * @param {any} param0
   * @return {any}
   */
  public createAwsProvider({
    supportedRegion,
    forAccount,
  }: {
    supportedRegion: Constants.AWS_REGION_ALIASES;
    forAccount?: AccountProviderConfig;
  }): AwsProvider {
    try {
      return Utils.getAwsProvider(
        this,
        forAccount.accountName,
        supportedRegion
      );
    } catch (e) {
      return this._createAwsProvider({
        supportedRegion: supportedRegion,
        forAccount: forAccount,
      });
    }
  }

  /**
   *
   * @param {any} param0
   * @return {any}
   */
  private _createAwsProvider({
    supportedRegion,
    forAccount,
  }: {
    supportedRegion: Constants.AWS_REGION_ALIASES;
    forAccount?: AccountProviderConfig;
  }): AwsProvider {
    const roleArn = forAccount
      ? `arn:aws:iam::${forAccount.accountId}:role/${forAccount.accountProvisionRole}`
      : `arn:aws:iam::${this.stackConfig.federatedAccountId}:role/${this.stackConfig.providerRoleName}`;
    const props: AwsProviderConfig = {
      region: Constants.AWS_REGION_MAP[supportedRegion],
      assumeRole: [
        {
          roleArn: roleArn,
          externalId: 'provisioning',
          sessionName: 'terraformer-terraforming',
        },
      ],
    };

    const accountNameToUse: string = forAccount
      ? forAccount.accountName
        ? forAccount.accountName
        : 'aws'
      : 'aws';

    // If we're making the us-east-1 AWS provider then return it without an alias
    // This is because the default provider for all infrastrcuture prior to creation of
    // the Dragonfly Primary and Dragonfly Recovery accounts is us-east-1
    if (accountNameToUse === 'aws' && supportedRegion === 'LEGACY') {
      return new AwsProvider(
        this,
        Utils.awsProviderAliasHelper(accountNameToUse, supportedRegion),
        props
      );
    }

    return new AwsProvider(
      this,
      Utils.awsProviderAliasHelper(accountNameToUse, supportedRegion),
      {
        ...{
          alias: Utils.awsProviderAliasHelper(
            accountNameToUse,
            supportedRegion
          ),
        },
        ...props,
      }
    );
  }
}
