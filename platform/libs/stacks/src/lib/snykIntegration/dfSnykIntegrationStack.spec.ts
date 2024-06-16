import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { DfIamRoleConstruct } from '@dragonfly/constructs';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfSnykIntegrationStack } from './dfSnykIntegrationStack';
import { DfAccounts } from '@dragonfly/utils';

describe('Private Instance Stack', () => {
  it('\r\nShould set up a Security group, TlsProvider, KeyPair, \r\nPrivate key, instance and the factory method', () => {
    const mockApp = Testing.app();
    const sopsData = {
      DD_API_KEY: 'test',
      RDS_CONFIG_CREDS: {
        testingStack: {
          username: 'test-admin',
          password: 'password',
        },
      },
    };
    mockApp.node.setContext('sopsData', sopsData);

    const snykIntegrationStack = new DfSnykIntegrationStack({
      envName: 'Dev',
      envSubdomain: 'dev',
      scope: mockApp,
      federatedAccountId: '123',
      handler: [],
      providerRoleName: 'AWSControlTowerExecution',
      accountDefinition: DfAccounts.getDevAccountDef(),
      customerDefinition: DfAccounts.getCustomerByAccountDefinition(
        DfAccounts.getDevAccountDef()
      ),
    });
    const synthedMockStack = Testing.synth(snykIntegrationStack);

    expect(snykIntegrationStack.dfSnykIamRole).toBeDefined();
    expect(
      snykIntegrationStack.dfSnykIamRole instanceof DfIamRoleConstruct
    ).toBe(true);
    expect(synthedMockStack).toHaveResourceWithProperties(
      IamRolePolicyAttachment,
      {
        policy_arn: 'arn:aws:iam::aws:policy/SecurityAudit',
      }
    );
  });
});
