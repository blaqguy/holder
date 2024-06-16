import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfPerformanceDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'performance-OracleUpdInstance'.toLowerCase(),
      route53Name: 'uobxprforacleupd01.prf',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
    },
    upf02: {
      id: 'stprf-OracleUpdInstance'.toLowerCase(),
      route53Name: 'stprforacleupd02.prf',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
    },
    upf03: {
      id: 'ptprf-OracleUpdInstance'.toLowerCase(),
      route53Name: 'ptprforacleupd03.prf',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.medium',
      performanceInsightsEnabled: true,
      createBucket: false,
    },
  };
}
