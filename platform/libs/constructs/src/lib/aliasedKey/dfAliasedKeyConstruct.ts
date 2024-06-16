import { KmsAlias } from '@cdktf/provider-aws/lib/kms-alias';
import { KmsKey } from '@cdktf/provider-aws/lib/kms-key';
import { KmsReplicaKey } from '@cdktf/provider-aws/lib/kms-replica-key';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DragonflyKms } from '@dragonfly/components';
import { Construct } from 'constructs';

export interface DfKeyProps {
  name: string;
  description: string;
  provider?: AwsProvider;
  policy?: string;
  multiRegion?: boolean;
  recoveryProvider?: AwsProvider;
}

/**
 * Aliased Key Construct
 */
export class DfAliasedKeyConstruct extends Construct {
  public readonly key: KmsKey;
  public readonly alias: KmsAlias;
  public readonly backupKey: KmsReplicaKey;

  /**
   *
   * @constructor
   * @param {Construct} scope - The parent stack
   * @param {string} id - A logical identifier for the key
   * @param {DfKeyProps} props - Properties of the key
   */
  constructor(scope: Construct, id: string, props: DfKeyProps) {
    super(scope, id);

    this.key = DragonflyKms.dragonflyKmsKey(this, id, {
      provider: props.provider,
      description: props.description,
      deletionWindowInDays: 7,
      enableKeyRotation: true,
      policy: props.policy ? props.policy : undefined,
      multiRegion: props.multiRegion ? props.multiRegion : false,
      tags: { Name: props.name },
    });

    this.alias = new KmsAlias(this, `${id}KeyAlias`, {
      provider: props.provider,
      name: `alias/${props.name}`,
      targetKeyId: this.key.id,
    });

    if (props.multiRegion) {
      this.backupKey = new KmsReplicaKey(this, id, {
        provider: props.recoveryProvider,
        description: props.description,
        deletionWindowInDays: 7,
        primaryKeyArn: this.key.arn,
      });
    }
  }

  /**
   * @return {string} - A Token representing the terraform resource's ARN
   */
  public get arn() {
    return this.key.arn;
  }

  /**
   * @return {string} - A Token representing the terraform resource's ID
   */
  public get id() {
    return this.key.id;
  }

  public getReplicaKey() {
    return this.backupKey;
  }
}
