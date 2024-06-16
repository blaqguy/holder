import { Vpc, VpcConfig } from '@cdktf/provider-aws/lib/vpc';
import { Construct } from 'constructs';

// omit enableDnsHostnames and enableDnsSupport
export interface DragonflyVpcConfig
  extends Omit<VpcConfig, 'enableDnsHostnames' | 'enableDnsSupport'> {
  cidrBlock: string;
}

/**
 * Dragonfly VPC wrapper for CDK Vpc
 */
export class DragonflyVpc extends Vpc {
  /**
   *
   * @param {Construct} scope - The parent stack intended to own this VPC
   * @param {string} name - The name for the VPC
   * @param {DragonflyVpcConfig} config - A base VpcConfig with enableDnsHostnames and enableDnsSupport omitted
   */
  constructor(scope: Construct, name: string, config: DragonflyVpcConfig) {
    super(scope, name, {
      ...config,
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });
  }
}
