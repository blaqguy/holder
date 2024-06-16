import { DfBaseVpcConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../../sharedStackTypes/remoteStack';

export interface DfBaseVpcConfig {
  vpcCidrBlock: string;
}

/**
 * Base VPC Stack
 */
export class DfBaseVpcStack extends RemoteStack {
  public readonly vpcConstruct: DfBaseVpcConstruct;

  /**
   *
   * @param {string} stackUuid - ""
   * @param {StackConfig} stackConfig - ""
   * @param {VpcConfig} vpcConfig - ""
   */
  constructor(
    stackUuid: string,
    protected stackConfig: StackConfig,
    private vpcConfig: DfBaseVpcConfig
  ) {
    super(`${stackUuid}-VPC`, stackConfig);
  }

  /**
   * @return {string} - The VPC Cidr
   */
  public get cidr() {
    return this.vpcConfig.vpcCidrBlock;
  }
}
