import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfStateStreetUatDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'ssbt-upf-01',
      route53Name: 'dbu1ssu1.uat',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 250,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D1UPSSU1',
      sopsDbProperty: 'dbssbtupf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      availabilityZone: 'us-east-2b',
    },
    upf02: {
      id: 'ssbt-upf-02',
      route53Name: 'dbu2ssu1.uat',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D2UPSSU1',
      sopsDbProperty: 'dbssbtupf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      availabilityZone: 'us-east-2c',
    },
  };
}
