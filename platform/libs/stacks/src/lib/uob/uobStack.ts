import {
  DfAliasedKeyConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig, UobTierType } from '../stacks';
import { AssetType, TerraformAsset } from 'cdktf';
import path from 'path';
import { Constants } from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export interface UobStackProps {
  primaryVpc?: DfSpokeVpcConstruct;
  recoveryVpc?: DfSpokeVpcConstruct;
  vpc?: DfSpokeVpcConstruct;
}

/**
 * UOB Stack
 */
export class UobStack extends RemoteStack {
  private userDataAssets: TerraformAsset;
  private provider: AwsProvider;
  private _kmsEncryptionKey: DfAliasedKeyConstruct;
  private _kmsEncryptionKeyRecovery: DfAliasedKeyConstruct;

  /**
   *
   * @param {string} stackName - Name of stack
   * @param {StackConfig} stackConfig - StackConfig for the env
   * @param {UobStackConfig} config - Properties of the stack
   * @param {Constants.AWS_REGION_ALIASES} region - Region of the stack
   */
  constructor(
    stackName: string,
    public readonly stackConfig: StackConfig,
    public stackProps: UobStackProps,
    public region: Constants.AWS_REGION_ALIASES = Constants.AWS_REGION_ALIASES
      .LEGACY
  ) {
    super(stackName, stackConfig);
    this.userDataAssets = new TerraformAsset(this, 'userDataScripts', {
      path: path.resolve(__dirname, 'uobScripts'),
      type: AssetType.DIRECTORY,
    });

    // Retrieves the current provider based on the region passed in
    this.provider = this.getProviderForRegion(region);
    this._kmsEncryptionKey = this.createEncryptionKey(stackName, this.provider);
    if (stackProps.recoveryVpc) {
      this._kmsEncryptionKeyRecovery = this.createEncryptionKey(
        `${stackName}-recovery`,
        this.getProviderForRegion(stackConfig.accountDefinition.recoveryRegion)
      );
    }
  }

  /**
   *
   * @param {UobClusterNodeType} tier
   * @return {string}
   */
  public getUserDataTemplateForTier(tier: UobTierType): string {
    return `${this.userDataAssets.path}/${tier}.sh.tftpl`;
  }

  /**
   * Creates the ebs volume encryption key
   * @param {String} stackName - Index number to create a dynamic Encryption key per region
   * @param {AwsProvider} provider - Current stack provider
   * @return {DfAliasedKeyConstruct} - The AwsProvider that matches the passed in region
   */
  private createEncryptionKey(
    stackName: string,
    provider: AwsProvider
  ): DfAliasedKeyConstruct {
    return new DfAliasedKeyConstruct(this, `${stackName}-kms-key`, {
      name: `${stackName}-encryption-key`,
      description: 'The KMS key for encypting the Uob Ebs Volumes',
      provider: provider,
    });
  }

  public get vpc() {
    return this.stackProps.vpc;
  }

  public get primaryVpc() {
    return this.stackProps.primaryVpc;
  }

  public get recoveryVpc() {
    return this.stackProps.recoveryVpc;
  }

  /**
   * @return {DfAliasedKeyConstruct}
   */
  public get kmsEncryptionKey(): DfAliasedKeyConstruct {
    return this._kmsEncryptionKey;
  }

  public get kmsEncryptionKeyRecovery(): DfAliasedKeyConstruct {
    return this._kmsEncryptionKeyRecovery;
  }

  /**
   * @return {AwsProvider}
   */
  public getProvider() {
    return this.provider;
  }

  /**
   * @return {string} - The region of the provider
   */
  public getProviderRegion() {
    return this.provider.region;
  }
}
