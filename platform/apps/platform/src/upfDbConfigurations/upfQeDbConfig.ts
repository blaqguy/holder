import { UpfConfig, UpfDbConfig } from './upfConfig';

/**
 * Class defining the upf db configurations
 */
export abstract class UpfQeDbConfig extends UpfConfig {
  public static configuration: UpfDbConfig = {
    upf01: {
      id: 'qe-OracleUpdInstance'.toLowerCase(),
      route53Name: 'uobxqeoracleupd01.qe',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.2xlarge',
      performanceInsightsEnabled: true,
      createBucket: false,
      parameterGroupConfig: {
        name: 'qe-OracleUpdInstance-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
    },
    upf02: {
      id: 'qe-OracleUpdInstance-2'.toLowerCase(),
      route53Name: 'uobxqeoracleupd02.qe',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.2xlarge',
      performanceInsightsEnabled: true,
      createBucket: false,
      parameterGroupConfig: {
        name: 'qe-OracleUpdInstance-2-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
    },
    upf03: {
      id: 'qe-OracleUpdInstance-3'.toLowerCase(),
      route53Name: 'uobxqeoracleupd03.qe',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.2xlarge',
      performanceInsightsEnabled: true,
      createBucket: false,
      parameterGroupConfig: {
        name: 'qe-OracleUpdInstance-3-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
    },
    upf04: {
      id: 'qe-OracleUpdInstance-4'.toLowerCase(),
      route53Name: 'uobxqeoracleupd04.qe',
      engine: 'oracle-se2',
      engineVersion: '19',
      storageType: 'gp3',
      allocatedStorage: 100,
      instanceClass: 'db.t3.2xlarge',
      performanceInsightsEnabled: true,
      createBucket: false,
      parameterGroupConfig: {
        name: 'qe-OracleUpdInstance-4-upf-params'.toLowerCase(),
        family: 'oracle-se2-19',
        parameter: [],
      },
    },
  };
}
