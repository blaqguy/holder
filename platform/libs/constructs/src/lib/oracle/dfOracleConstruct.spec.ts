import { Testing } from 'cdktf';
import { DfOracleConstruct } from './dfOracleConstruct';
import 'cdktf/lib/testing/adapters/jest';
import { DfSpokeVpcConstruct } from '../vpc';
import { Constants } from '@dragonfly/utils';

describe('Oracle construct', () => {
  it('Should create resources in Oracle construct', () => {
    Date.now = jest.fn(() => new Date(Date.UTC(2017, 7, 9, 8)).valueOf());

    const synthedMockStack = Testing.synthScope((mockStack) => {
      const sopsData = {
        RDS_CONFIG_CREDS: {
          testingStack: {
            username: 'test-admin',
            password: 'password',
          },
        },
      };
      mockStack.node.setContext('sopsData', sopsData);

      const vpcConstruct = new DfSpokeVpcConstruct(
        mockStack,
        'mockVpcConstruct',
        {
          vpcCidr: '10.1.1.1/16',
          provider: null,
          federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
        }
      );

      new DfOracleConstruct(mockStack, {
        environment: 'test',
        id: 'oracle-test',
        subnetIds: vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        accountDefinition: {
          name: 'name',
          accountNumber: '',
          accountType: 'prod',
          alias: '',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: null,
          recoveryRegion: null,
          ouId: '',
          organizationalUnit: '',
          additionalAuthorizedGroupConfigs: [],
          vpcCidrs: {
            main: {
              legacy: '',
              primary: '',
              recovery: '',
            },
          },
          networkType: 'sharedNetwork',
        },
        storageType: 'gp3',
        allocatedStorage: 100,
        vpcResource: vpcConstruct,
        instanceClass: 'db.m6i.large',
        performanceInsightsEnabled: true,
        createBucket: true,
      });
    });

    expect(synthedMockStack).toMatchSnapshot();
  });
});
