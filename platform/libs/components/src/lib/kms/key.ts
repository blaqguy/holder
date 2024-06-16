import { KmsKeyConfig, KmsKey } from '@cdktf/provider-aws/lib/kms-key';
import { Construct } from 'constructs';

/**
 * Creates a KMS Key with various properties enforced
 *
 * @param {Construct} scope - The Parent Stack owning this Key
 * @param {string} id - A human readable identifier for the key
 * @param {KmsKeyConfig} props - Kms Key Config Properties from the CDK
 *
 * @return {KmsKey} - The KMS Key resource
 */
export function dragonflyKmsKey(
  scope: Construct,
  id: string,
  props: KmsKeyConfig
): KmsKey {
  return new KmsKey(scope, `${id}KmsKey`, {
    ...props,
    ...{
      tags: {
        Name: id,
      },
    },
  });
}
