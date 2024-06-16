import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfSantProdDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'sant01-upf-01',
      route53Name: 'dbu1sant.prod',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 250,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D1UPSANT',
      sopsDbProperty: 'dbup1santu1upf',
      prodCustomerData: true,
      optionGroupName: 'sant01-upf-01-est-se2'.toLowerCase(),
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
      ],
      availabilityZone: 'us-east-2b',
    },
    upf02: {
      id: 'sant01-upf-02',
      route53Name: 'dbu2sant.prod',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D2UPSANT',
      sopsDbProperty: 'dbup2santu1upf',
      prodCustomerData: true,
      optionGroupName: 'sant01-upf-02-est-se2'.toLowerCase(),
      timezone: 'America/New_York',
      additionalSgCidrBlocks: [
        DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
      ],
      availabilityZone: 'us-east-2c',
    },
  };
}
