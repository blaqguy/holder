import {
  Ec2TransitGatewayConfig,
  Ec2TransitGateway,
} from '@cdktf/provider-aws/lib/ec2-transit-gateway';
import { Construct } from 'constructs';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DragonflyTransitGatewayConfig
  extends Omit<Ec2TransitGatewayConfig, 'autoAcceptSharedAttachments'> {}

/**
 * The DragonflyTransitGateway
 */
export class DragonflyTransitGateway extends Ec2TransitGateway {
  /**
   *
   * @param {Construct} scope - The parent stack indended to own this gateway
   * @param {string} name - The name of the transit gateway
   * @param {DragonflyTransitGatewayConfig} config - A base Ec2TransitGatewayConfig with autoAcceptSharedAttachments removed
   */
  constructor(
    scope: Construct,
    name: string,
    config: DragonflyTransitGatewayConfig
  ) {
    super(scope, name, {
      ...config,
      autoAcceptSharedAttachments: 'enable',
      defaultRouteTableAssociation: 'disable',
      defaultRouteTablePropagation: 'disable',
      dnsSupport: 'enable',
      vpnEcmpSupport: 'enable',
    });
  }
}
