import { SecurityGroupIngress } from '@cdktf/provider-aws/lib/security-group';
import {
  DfAliasedKeyConstruct,
  PublicIngressLbConfig,
  OracleStackConfig,
  CustomerLbConfig,
} from '@dragonfly/constructs';
import { WafConfig } from '../../stacks';
export const tierTypes =
  'app' ||
  'web' ||
  'bld' ||
  'rt' ||
  'lbs' ||
  'mq' ||
  'msi' ||
  'rpt' ||
  'sim' ||
  'bat' ||
  'db';

export interface environment {
  [key: string]: environmentConfig;
}

export interface environmentConfig {
  properties: clusterProperties;
  tiers: {
    [key: string]: tierProperties;
  };
  dbConfigs?: OracleStackConfig[]; // TODO: TEMPORARILY MAKE THIS OPTIONAL FOR TESTING BUT THIS NEEDS TO BE REQUIRED FOR THE ORACLE CONFIG TO BE USED
}

/**
 * Interface that define sthe properties a cluster can have
 */
export interface clusterProperties {
  constructNamePattern: string;
  fiName: string;
  clusterName: string;
  active?: boolean;
  publicIngressPartial?: {
    recordProps: {
      recordName: string;
      skipSubDomain?: boolean;
      skipDomain?: boolean;
      constructName?: string;
      rootZoneNameOverride?: string;
    };
    wafConfig?: WafConfig;
    albProps?: PublicIngressLbConfig['albProps'];
    bucketName?: string;
    certImported?: boolean;
    deployToXL?: boolean;
    msiTargetTierOverride?: boolean;
    deploySeparateWafStack?: boolean;
  }[];
  useDbConfigs?: boolean;
  activeRegion?: 'recovery' | 'default';
  disableAnsibleManagement?: boolean;
}

/**
 * Interface that defines the properties of a tier
 */
export interface tierProperties {
  count: number;
  ami: string;
  recoveryAmiIds?: string[];
  instanceType: string;
  volumes: volumeProperties[];
  instanceResourceConfig: any;
  tierIngresses: SecurityGroupIngress[];
  templateEnabled: boolean;
  hostnamePattern?: string;
  hostnamePatternOverride?: string[];
  amiPatternOverride?: string[];
  userDataFileName: string;
  customerMappings?: {
    customerSubdomain: string;
    props: CustomerLbConfig['lbProps'];
  }[];
  createVolumesInRecovery?: boolean;
}

/**
 * Interface that defines the properties of a volume
 */
export interface volumeProperties {
  volumeName: string;
  volumeSize: number;
  deviceName: string;
  volumeKey?: DfAliasedKeyConstruct;
  encrypted?: boolean;
  volumeType?: 'gp3';
}
