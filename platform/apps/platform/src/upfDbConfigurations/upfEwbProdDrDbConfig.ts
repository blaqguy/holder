import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfEwbProdDrDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upfDr01: {
      id: 'ewbk-prod-upf-dr-01',
      dbName: 'D1UPEWBK',
      sopsDbProperty: 'ewbkproddrupf',
      route53Name: 'dbu1ewbk-dr.prod',
      availabilityZone: 'us-west-2a',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      prodCustomerData: true,
      optionGroupName: 'ewbk-prod-upf-dr-01-option-group-est',
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
      ],
    },
    upfDr02: {
      id: 'ewbk-prod-upf-dr-02',
      dbName: 'D2UPEWBK',
      sopsDbProperty: 'ewbkproddrupf',
      route53Name: 'dbu2ewbk-dr.prod',
      availabilityZone: 'us-west-2b',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      prodCustomerData: true,
      optionGroupName: 'ewbk-prod-upf-dr-02-option-group-est',
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
      ],
    },
  };
}
