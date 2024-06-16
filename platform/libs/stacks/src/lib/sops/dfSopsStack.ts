import { DfAliasedKeyConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';

/**
 *
 */
export class DfSopsStack extends RemoteStack {
  private sopsKey: DfAliasedKeyConstruct;
  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   */
  constructor(private stackName: string, protected stackConfig: StackConfig) {
    super(stackName, stackConfig);

    // Creates the KMS Key that will be used for sops secrets.yaml for secret values
    this.sopsKey = new DfAliasedKeyConstruct(this, stackName, {
      name: 'df-sops-key',
      description: 'SOPS Kms Key',
    });
  }

  /**
   * @return {DfAliasedKeyConstruct}
   */
  public get dfSopsKmsKey(): DfAliasedKeyConstruct {
    return this.sopsKey;
  }
}
