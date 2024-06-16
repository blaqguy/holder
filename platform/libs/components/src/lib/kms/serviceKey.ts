import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import { KmsKeyConfig, KmsKey } from '@cdktf/provider-aws/lib/kms-key';
import { Construct } from 'constructs';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DragonflyKmsKeyConfig
  extends Omit<KmsKeyConfig, 'enableKeyRotation'> {}

/**
 * Kms Key intended to be used by an autonomous service
 */
export class DragonflyServiceKmsKey extends KmsKey {
  /**
   *
   *
   * @constructor
   * @param {Construct} scope - The parent stack intended to own this KmsKey resource
   * @param {string} name - A human readable name for the Key
   * @param {DragonflyKmsKeyConfig} config - KmsKeyConfig with enableKeyRotation omited
   */
  constructor(scope: Construct, name: string, config?: DragonflyKmsKeyConfig) {
    const currentAccountId = new DataAwsCallerIdentity(scope, 'account_id', {
      provider: config.provider,
    }).accountId;

    super(scope, name, {
      ...config,
      enableKeyRotation: true,
      tags: {
        ...config?.tags,
        Name: `${name}-kms-key`,
      },
    });

    if (this.policy === undefined) {
      this.addOverride(
        'policy',
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'Enable IAM User Permissions',
              Effect: 'Allow',
              Principal: {
                AWS: '*',
              },
              Action: 'kms:*',
              Resource: '*',
            },
            {
              Sid: 'Deny Cross account Kms actions',
              Effect: 'Deny',
              Principal: {
                AWS: '*',
              },
              Action: ['kms:*'],
              Resource: '*',
              Condition: {
                StringNotEquals: {
                  'kms:CallerAccount': `${currentAccountId}`,
                },
              },
            },
          ],
        })
      );
    }
  }
}
