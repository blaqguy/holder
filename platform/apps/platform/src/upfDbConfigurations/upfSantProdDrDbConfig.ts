import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfSantProdDrDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upfDr01: {
      id: 'sant01-upf-dr-01',
      route53Name: 'dbu1sant-dr.prod',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D1UPSANT',
      sopsDbProperty: 'sant01drupf',
      prodCustomerData: true,
      optionGroupName: 'sant01-upf-dr-01-option-group-est',
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
      ],
      availabilityZone: 'us-west-2a',
    },
    upfDr02: {
      id: 'sant01-upf-dr-02',
      route53Name: 'dbu2sant-dr.prod',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D2UPSANT',
      sopsDbProperty: 'sant01drupf',
      prodCustomerData: true,
      optionGroupName: 'sant01-upf-dr-02-option-group-est',
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
      ],
      availabilityZone: 'us-west-2b',
    },
  };
}
