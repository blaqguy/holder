import { App, S3BackendConfig } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';
import { Constants } from '@dragonfly/utils';

export interface NetworkInstanceConfig {
  environmentName: string;
  s3BackendProps: S3BackendConfig;
  remoteStateId: string;
}

/**
 *
 */
export abstract class AbstractSharedNetworkEnvironment extends AbstractEnvironment {
  /**
   *
   * @param {App} app - Root CDK app
   */
  constructor(protected app: App) {
    super(app);
  }

  /**
   * @param {Constants.AWS_REGION_ALIASES} regionAlias -
   */
  public static regionalNetworkConfig(
    regionAlias: Constants.AWS_REGION_ALIASES
  ): NetworkInstanceConfig {
    throw new Error('Not implemented');
  }
}
