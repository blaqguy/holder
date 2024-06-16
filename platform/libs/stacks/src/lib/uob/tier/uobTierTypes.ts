import { SecurityGroupIngress } from '@cdktf/provider-aws/lib/security-group';
import { DfPrivateInstanceConstructProps } from '@dragonfly/constructs';
import { AccountDefinition, PlatformSecrets } from '@dragonfly/utils';
import { UobHelperStack } from '../uobHelperStack';
import { UobStack } from '../uobStack';
import { UobTier } from './uobTier';
import { clusterProperties, tierProperties } from './uobEnvConfiguration';

/**
 * An array of all possible UOB tier types.
 */
export const UOB_TIERS = [
  'bld',
  'msi',
  'rpt',
  'mq',
  'rt',
  'cfm',
  'app',
  'web',
  'lbs',
  'sim',
  'bat',
  'db',
] as const;

/**
 * A type alias representing the union of all possible UOB tier types.
 */
export type UobTierType = (typeof UOB_TIERS)[number];

/**
 * A type for a tier constructor function that creates a new UobTier instance.
 */
export type TierConstructor = {
  new (params: UobTierCtor): UobTier;
};

/**
 * Named parameters for creating a new UOB tier instance.
 */
export interface CreateUobTierNamedParameters {
  /**
   * The type of UOB tier to create.
   */
  tier: UobTierType;

  /**
   * Options for creating the UOB tier instance.
   */
  tierOptions: {
    /**
     * The number of instances to create for this tier.
     */
    count: number;

    /**
     * An optional array of security group ingress rules to apply to the tier instances.
     */
    tierIngresses?: SecurityGroupIngress[];

    /**
     * An optional object specifying the TCP and UDP ports to open on the tier instances.
     */
    tierPorts?: {
      tcp: Array<number | [number, number]>;
      udp: Array<number | [number, number]>;
    };
  };

  /**
   * The properties to use when creating each instance in the UOB tier.
   */
  instanceProps: DfPrivateInstanceConstructProps;
}

/**
 * Constants used to configure a UOB tier.
 */
export interface UobTierConstants {
  /**
   * The type of UOB tier to configure.
   */
  tier?: UobTierType;

  /**
   * The number of instances to create for this tier.
   */
  count?: number;

  /**
   * The AMI to use for each instance in the tier.
   */
  ami?: string;

  /**
   * The instance type to use for each instance in the tier.
   */
  instanceType?: string;

  /**
   * User data parameters to include when launching each instance in the tier.
   */
  userDataParams?: { [key: string]: string };

  /**
   * The volumes to attach to each instance in the tier.
   */
  volumes?: {
    volumeName: string;
    volumeSize: number;
    deviceName: string;
    encrypted?: boolean;
    volumeType?: 'gp3';
  }[];
}

/**
 * Named parameters for constructing a UOB tier.
 */
export interface UobTierCtor {
  /**
   * The UOB helper stack to use.
   */
  uobHelper: UobHelperStack;

  /**
   * The UOB stack to use.
   */
  uobStack: UobStack;

  /**
   * The SOPS data to use.
   */
  sopsData: PlatformSecrets;

  accountDefinition: AccountDefinition;

  tierType?: UobTierType;

  tierConfiguration?: tierProperties;

  sharedProperties?: clusterProperties;
}
