import { KeyPair } from '@cdktf/provider-aws/lib/key-pair';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import { PrivateKey } from '@cdktf/provider-tls/lib/private-key';
import { Utils } from '@dragonfly/utils';
import { Construct } from 'constructs';

interface KeyPairConfig {
  keyName: string;
  provider?: AwsProvider;
  index?: number;
  recoveryProvider?: AwsProvider;
}

/**
 * DfKeyPairConstruct
 */
export class DfKeyPairConstruct {
  protected keyPair: KeyPair;
  private key: PrivateKey;
  public readonly keyPairParameter: SsmParameter;

  /**
   * @param {Construct} scope - Scope to create instances in
   * @param {string} id - Name to give value in SSM
   * @param {KeyPairConfig} keyPairConfig - Configuration object for key pair creation
   */
  constructor(scope: Construct, id: string, keyPairConfig: KeyPairConfig) {
    // Adding this privateKeyId logic to include add an index to the resource id if passed in
    const privateKeyId = keyPairConfig.index
      ? Utils.createConstructResourceId(`AccessKey`, keyPairConfig.index)
      : Utils.createConstructResourceId(`AccessKey`);
    this.key = new PrivateKey(scope, privateKeyId, {
      algorithm: 'RSA',
      rsaBits: 4096,
    });

    // Adding this ssmParameter logic to include add an index to the resource id if passed in
    const ssmParameterId = keyPairConfig.index
      ? Utils.createConstructResourceId(`PrivateKey`, keyPairConfig.index)
      : Utils.createConstructResourceId(`PrivateKey`);

    this.keyPairParameter = new SsmParameter(scope, ssmParameterId, {
      provider: keyPairConfig.provider,
      name: `${id}-private-key`,
      type: 'SecureString',
      value: this.key.privateKeyPem,
      tags: { Name: `${id}-private-key` },
    });

    // Adding this keyPair logic to include add an index to the resource id if passed in
    const keyPairId = keyPairConfig.index
      ? Utils.createConstructResourceId(`KeyPair`, keyPairConfig.index)
      : Utils.createConstructResourceId(`KeyPair`);

    this.keyPair = new KeyPair(scope, keyPairId, {
      provider: keyPairConfig.provider,
      keyName: keyPairConfig.keyName,
      publicKey: this.key.publicKeyOpenssh,
      tags: { Name: keyPairConfig.keyName },
    });

    if (keyPairConfig.recoveryProvider) {
      new SsmParameter(scope, `${ssmParameterId}-recovery`, {
        provider: keyPairConfig.recoveryProvider,
        name: `${id}-private-key`,
        type: 'SecureString',
        value: this.key.privateKeyPem,
        tags: { Name: `${id}-private-key` },
      });

      new KeyPair(scope, `${keyPairId}Recovery`, {
        provider: keyPairConfig.recoveryProvider,
        keyName: keyPairConfig.keyName,
        publicKey: this.key.publicKeyOpenssh,
        tags: { Name: keyPairConfig.keyName },
      });
    }
  }

  /**
   *
   * @return {KeyPair}
   */
  public getKeyPairResource(): KeyPair {
    return this.keyPair;
  }

  /**
   *
   * @return {KeyPair}
   */
  public get keyName(): string {
    return this.keyPair.keyName;
  }

  /**
   *
   * @return {string}
   */
  public getPubKey(): string {
    return this.key.publicKeyOpenssh;
  }
}
