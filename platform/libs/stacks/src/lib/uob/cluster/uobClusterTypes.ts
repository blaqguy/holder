import { CustomerDefinition, PlatformSecrets } from '@dragonfly/utils';
import { UobHelperStack } from '../uobHelperStack';
import { UobStack } from '../uobStack';
import { TierConstructor } from '../tier/uobTierTypes';
import { environmentConfig } from '../tier/uobEnvConfiguration';
import { S3BackendConfig } from 'cdktf';
import { PublicIngressLbConfig } from '@dragonfly/constructs';

/**
 * Represents named parameters for the UobCluster constructor.
 * @interface UobClusterNamedParameters
 */
export interface UobClusterNamedParameters {
  /**
   * Name of cluster primarily used to distinguish multiple clusters deployed a single environment
   * @type {string}
   */
  clusterName?: string;

  /**
   * An instance of the UobHelperStack class used to create the cluster.
   * @type {UobHelperStack}
   */
  helper: UobHelperStack;

  /**
   * An instance of the UobStack class used to create the cluster.
   * @type {UobStack}
   */
  uobStack: UobStack;

  /**
   * An instance of the PlatformSecrets class used to create the cluster.
   * @type {PlatformSecrets}
   */
  sopsData: PlatformSecrets;

  /**
   * An array of tier constructor classes used to create the cluster.
   * @type {TierConstructor[]}
   * @default []
   */
  tierClasses?: TierConstructor[];

  clusterConfiguration?: environmentConfig;

  /**
   * Configuration options for creating an instance of the Public Ingress Class used in the cluster.
   * @type {PublicIngressLbConfig}
   */
  publicIngressConfig?: PublicIngressLbConfig;

  // TODO: TEMPORARILY MAKE THIS OPTIONAL FOR TESTING BUT THIS NEEDS TO BE REQUIRED FOR THE ORACLE CONFIG DATASUBNETS AND THE VPC ITELF TO BE USED
  // vpcStack?: DfSpokeVpcStack;
  networkInstanceBackend?: S3BackendConfig;
  recoveryNetworkInstanceBackend?: S3BackendConfig;
  paloNetworkBackend?: S3BackendConfig;
  customerDefinition?: CustomerDefinition;
}
