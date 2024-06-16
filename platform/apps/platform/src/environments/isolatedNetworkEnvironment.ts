import { App, TerraformStack } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';
import { DfIsolatedVpcStack } from '@dragonfly/stacks';
import { Constants } from '@dragonfly/utils';

export interface EnvironmentConfig {
  app: App;
  vpcCidrPrimary: string;
  vpcCidrRecovery: string;
  envName: string;
  envTier: 'uat' | 'prod' | 'dev' | 'tools';
}

/**
 *
 */
export abstract class IsolatedNetworkEnvironment extends AbstractEnvironment {
  protected vpcPrimary: DfIsolatedVpcStack;
  protected vpcRecovery: DfIsolatedVpcStack;
  protected vpcCidrPrimary: string;
  protected vpcCidrRecovery: string;
  protected envName: string;
  protected envTier: 'uat' | 'prod' | 'dev' | 'tools';

  /**
   * @param {EnvironmentConfig} environmentConfig
   */
  constructor(environmentConfig) {
    super(environmentConfig.app);
    this.vpcCidrPrimary = environmentConfig.vpcCidrPrimary;
    this.vpcCidrRecovery = environmentConfig.vpcCidrRecovery;
    this.envName = environmentConfig.envName;
    this.envTier = environmentConfig.envTier;
  }

  /**
   * VPC CIDR
   */
  protected static get VPC_CIDR(): string {
    throw new Error('Not implemented');
  }

  /**
   *
   * @param {NetworkStackConfig} networkStackConfig
   * @return {TerraformStack[]}
   */
  protected createNetworkStacks(): TerraformStack[] {
    if (this.vpcCidrPrimary && this.vpcCidrRecovery) {
      this.vpcPrimary = new DfIsolatedVpcStack(
        `primary-vpc`,
        this.stackConfig,
        {
          vpcCidrBlock: this.vpcCidrPrimary,
        },
        {
          envName: this.envName,
          envTier: this.envTier,
        }
      );

      this.vpcRecovery = new DfIsolatedVpcStack(
        `recovery-vpc`,
        this.stackConfig,
        {
          vpcCidrBlock: this.vpcCidrRecovery,
        },
        {
          envName: this.envName,
          envTier: this.envTier,
        }
      );

      this.vpcPrimary.switchRegion(Constants.AWS_REGION_ALIASES.DF_PRIMARY);

      this.vpcRecovery.switchRegion(Constants.AWS_REGION_ALIASES.DF_RECOVERY);
    }
    return this.handler;
  }
}
