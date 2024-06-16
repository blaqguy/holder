import { OracleStackConfig } from '@dragonfly/constructs';

export interface UpfDbConfig {
  [key: string]: OracleStackConfig;
}

/**
 *
 */
export abstract class UpfConfig {
  public static configuration: UpfDbConfig;

  /**
   *
   * @return {string[]}
   */
  public static upfFQDNS() {
    return Object.entries(this.configuration).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([_dbId, oracleStackConfig]) => {
        return `${oracleStackConfig.route53Name}.dragonflyft.com`;
      }
    );
  }
}
