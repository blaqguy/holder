import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfSpokeVpcConstruct } from '../vpc';
import { DfBaseRdsConstruct } from './dfBaseRdsConstruct';
import { Constants } from '@dragonfly/utils';

describe('Base Rds Construct', () => {
  it('\r\nShould set up a Security group and a db subnet group', () => {
    const cidrBlock = '10.1.0.0/20';
    const envName = 'Dev';

    Testing.synthScope((mockStack) => {
      const vpcConstruct = new DfSpokeVpcConstruct(mockStack, 'myid', {
        vpcCidr: '10.1.0.0/8',
        provider: null,
        federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
      });
      new DfBaseRdsConstruct(envName, mockStack, `myid-RdsInstance`, {
        id: 'myId',
        subnetIds: [cidrBlock],
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 100,
        vpcResource: vpcConstruct,
        accountDefinition: {
          name: 'name',
          accountType: 'prod',
          accountNumber: '',
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
        instanceClass: 'db.m6i.2xlarge',
        rdsCredentials: {
          username: 'foo',
          password: 'bar',
        },
      });
    });
  });
});
