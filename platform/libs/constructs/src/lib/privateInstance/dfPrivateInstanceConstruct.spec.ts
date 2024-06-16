import { Instance } from '@cdktf/provider-aws/lib/instance';
import { KeyPair } from '@cdktf/provider-aws/lib/key-pair';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { PrivateKey } from '@cdktf/provider-tls/lib/private-key';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfSpokeVpcConstruct } from '../vpc';
import { DfPrivateInstanceConstruct } from './dfPrivateInstanceConstruct';

describe('Private Instance Stack', () => {
  it('Should set up a Security group, TlsProvider, KeyPair, Private key, instance and the factory method', () => {
    const amiId = Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default'];
    const synthedMockStack = Testing.synthScope((mockStack) => {
      const vpcConstruct = new DfSpokeVpcConstruct(
        mockStack,
        'mockVpcConstruct',
        {
          vpcCidr: '10.1.1.1/16',
          provider: null,
          federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
        }
      );

      DfPrivateInstanceConstruct.windowsInstanceFactory({
        scope: mockStack,
        name: 'Stack2',
        constructProps: {
          vpc: vpcConstruct,
          accountDefinition: DfAccounts.getDevAccountDef(),
          instanceResourceConfig: {
            keyName: 'KeyPair',
            instanceType: 'm5.large',
            rootBlockDevice: {
              volumeSize: 50,
              volumeType: 'gp3',
              deleteOnTermination: false,
              encrypted: true,
            },
            userDataReplaceOnChange: false,
            tags: {
              Name: 'Stack2',
            },
            userData: '',
          },
          options: {
            createKeyPair: true,
            overrideInTransitSubnet: true,
          },
        },
      });
    });

    expect(synthedMockStack).toHaveResource(SecurityGroup);

    expect(synthedMockStack).toHaveResourceWithProperties(PrivateKey, {
      algorithm: 'RSA',
      rsa_bits: 4096,
    });

    expect(synthedMockStack).toHaveResourceWithProperties(KeyPair, {
      key_name: `KeyPair`,
    });

    expect(synthedMockStack).toHaveResourceWithProperties(Instance, {
      ami: amiId,
      instance_type: 'm5.large',
      root_block_device: {
        volume_size: 50,
        volume_type: 'gp3',
        delete_on_termination: false,
        encrypted: true,
      },
      user_data_replace_on_change: false,
      tags: {
        Name: `Stack2`,
        os: 'windows',
        'backup-policy': 'root-ou-ec2',
        configured: 'False'
      },
    });

    expect(synthedMockStack).toHaveResourceWithProperties(Instance, {
      ami: amiId,
    });

    expect(synthedMockStack).toMatchSnapshot();
  });
});
