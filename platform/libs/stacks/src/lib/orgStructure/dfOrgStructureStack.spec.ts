import { OrganizationsOrganizationalUnit } from '@cdktf/provider-aws/lib/organizations-organizational-unit';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfOrgStructureStack } from '../stacks';
import { DfAccounts } from '@dragonfly/utils';

describe('Org Structure Stack', () => {
  it('\r\nShould set up an organization structure', () => {
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
    const orgStructureStack = new DfOrgStructureStack(
      {
        envName: 'Master',
        envSubdomain: 'Master',
        scope: mockApp,
        federatedAccountId: '123',
        handler: [],
        providerRoleName: 'test',
        accountDefinition: DfAccounts.getDevAccountDef(),
        customerDefinition: DfAccounts.getCustomerByAccountDefinition(
          DfAccounts.getDevAccountDef()
        ),
      },
      {
        orgMap: {
          Root: {
            Sandbox: null,
            Network: null,
            Tools: null,
            Dev: null,
          },
        },
      }
    );

    const synthedMockStack = Testing.synth(orgStructureStack);
    const resourceJson = JSON.parse(synthedMockStack)['resource'];
    const resource =
      resourceJson[OrganizationsOrganizationalUnit.tfResourceType];

    expect(resource['DevPlatformUnit']).toMatchObject({
      name: 'Dev',
    });
    expect(resource['SandboxPlatformUnit']).toMatchObject({
      name: 'Sandbox',
    });
    expect(resource['NetworkPlatformUnit']).toMatchObject({
      name: 'Network',
    });
    expect(resource['ToolsPlatformUnit']).toMatchObject({
      name: 'Tools',
    });
  });
});
