import { KmsAlias } from '@cdktf/provider-aws/lib/kms-alias';
import { KmsKey } from '@cdktf/provider-aws/lib/kms-key';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfAliasedKeyConstruct } from './dfAliasedKeyConstruct';

describe('Alias Key Testing', () => {
  it('\r\nShould create a DragonflyKey and a KeyAlias to go with it', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      // Create some object that is synth'able
      new DfAliasedKeyConstruct(mockStack, 'dfAliasedKeyConstruct', {
        name: 'mykey',
        description: 'mydesc',
      });
    });

    expect(synthedMockStack).toHaveResourceWithProperties(KmsKey, {
      description: 'mydesc',
      deletion_window_in_days: 7,
      enable_key_rotation: true,
    });
    expect(synthedMockStack).toHaveResourceWithProperties(KmsAlias, {
      name: 'alias/mykey',
    });
  });
});
