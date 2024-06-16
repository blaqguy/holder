import { OracleStackConfig } from '@dragonfly/constructs';
import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig } from './upfConfig';

export interface UpfDbConfig {
  [key: string]: OracleStackConfig;
}
/**
 * Class defining the upf db configurations
 */
export abstract class UpfSantUatDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'sant-uat-upf-01'.toLowerCase(),
      route53Name: 'dbu1snu1.uat',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D1UPSNU1',
      sopsDbProperty: 'dbu1snu1upf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      parameterGroupConfig: {
        name: 'sant-uat-upf-01-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
      optionGroupName: 'sant-uat-upf-01-est-se2'.toLowerCase(),
      timezone: 'America/New_York',
    },
    upf02: {
      id: 'sant-uat-upf-02'.toLowerCase(),
      route53Name: 'dbu2snu1.uat',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D2UPSNU1',
      sopsDbProperty: 'dbu2snu1upf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      parameterGroupConfig: {
        name: 'sant-uat-upf-02-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
      optionGroupName: 'sant-uat-upf-02-est-se2'.toLowerCase(),
      timezone: 'America/New_York',
    },
    upf03: {
      id: 'dbu1snu2'.toLowerCase(),
      route53Name: 'dbu1snu2.uat',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D1UPSNU2',
      sopsDbProperty: 'santuat2',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      parameterGroupConfig: {
        name: 'dbu1snu2-upf-01-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
      timezone: 'America/New_York',
      availabilityZone: 'us-east-2a',
      optionGroupName: 'dbu1snu2-est-se2',
    },
    upf04: {
      id: 'dbu2snu2'.toLowerCase(),
      route53Name: 'dbu2snu2.uat',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D2UPSNU2',
      sopsDbProperty: 'santuat2',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      parameterGroupConfig: {
        name: 'dbu2snu2-upf-01-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
      timezone: 'America/New_York',
      availabilityZone: 'us-east-2b',
      optionGroupName: 'dbu2snu2-est-se2',
    },
  };
}
