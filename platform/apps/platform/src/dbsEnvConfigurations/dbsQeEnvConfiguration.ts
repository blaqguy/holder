import { environment } from '@dragonfly/stacks';
import { QE_APP_REDUCED, QE_MQ_REDUCED, QE_WEB_REDUCED } from './defaultTier';

/**
 * Class defining the uob env configurations
 */
export abstract class DbsQeEnvConfiguration {
  public static configuration: environment = {
    i3bku3uat: {
      properties: {
        constructNamePattern: '',
        fiName: 'i3bku3uat',
        clusterName: 'i3bku3uat-cluster',
      },
      tiers: {
        web: QE_WEB_REDUCED,
        app: QE_APP_REDUCED,
        mq: QE_MQ_REDUCED,
        db: QE_APP_REDUCED,
      },
    },
  };
}
