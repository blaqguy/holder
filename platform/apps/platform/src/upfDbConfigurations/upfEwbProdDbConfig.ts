import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfEwbProdDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'ewbk-prod-upf-01'.toLowerCase(),
      dbName: 'D1UPEWBK',
      sopsDbProperty: 'dbu1ewbkupf',
      route53Name: 'dbu1ewbk.prod',
      availabilityZone: 'us-east-2a',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      prodCustomerData: true,
      optionGroupName: 'ewbk-prod-upf-01-option-group-est-se2'.toLowerCase(),
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
      ],
    },
    upf02: {
      id: 'ewbk-prod-upf-02'.toLowerCase(),
      dbName: 'D2UPEWBK',
      sopsDbProperty: 'dbu2ewbkupf',
      route53Name: 'dbu2ewbk.prod',
      availabilityZone: 'us-east-2c',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      prodCustomerData: true,
      optionGroupName: 'ewbk-prod-upf-02-option-group-est-se-2'.toLowerCase(),
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
      ],
    },
  };
}
