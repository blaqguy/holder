import { OracleStackConfig } from '@dragonfly/constructs';
import { DfAccounts } from '@dragonfly/utils';
import { UpfConfig } from './upfConfig';

export interface UpfDbConfig {
  [key: string]: OracleStackConfig;
}
/**
 * Class defining the upf db configurations
 */
export abstract class UpfCsiDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'dbu1csiu1'.toLowerCase(),
      route53Name: 'dbu1csiu1.uat',
      engine: 'oracle-ee',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D1UPCSU1',
      sopsDbProperty: 'csiuatupf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      parameterGroupConfig: {
        name: 'dbu1csiu1-upf-01-upf-params'.toLowerCase(),
        family: 'oracle-ee-19',
        parameter: [],
      },
      timezone: 'America/New_York',
      availabilityZone: 'us-east-2a',
    },
    upf02: {
      id: 'dbu2csiu1'.toLowerCase(),
      route53Name: 'dbu2csiu1.uat',
      engine: 'oracle-ee',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 50,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
      dbName: 'D2UPCSU1',
      sopsDbProperty: 'csiuatupf',
      prodCustomerData: true,
      additionalSgCidrBlocks: [
        DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
      ],
      parameterGroupConfig: {
        name: 'dbu2csiu1-upf-01-upf-params'.toLowerCase(),
        family: 'oracle-ee-19',
        parameter: [],
      },
      timezone: 'America/New_York',
      availabilityZone: 'us-east-2b',
    },
  };
}
