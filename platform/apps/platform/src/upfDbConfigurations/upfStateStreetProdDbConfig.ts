import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfStateStreetProdDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'state-street-upf-01',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 250,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'DBU1EWU3',
      sopsDbProperty: 'dbupewi3upf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
      ],
    },
  };
}
