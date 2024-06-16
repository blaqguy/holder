import { Ec2ClientVpnAuthorizationRule } from '@cdktf/provider-aws/lib/ec2-client-vpn-authorization-rule';
import {
  DfClientVpnStack,
  DfClientVpnStackConfig,
  StackConfig,
} from '../stacks';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { RegionConfig } from '@dragonfly/constructs';
import { Construct } from 'constructs';

/* eslint-disable require-jsdoc */
export class DfNonProdClientVpnStack extends DfClientVpnStack {
  constructor(
    stackName: string,
    protected stackConfig: StackConfig,
    protected config: DfClientVpnStackConfig
  ) {
    super(stackName, stackConfig, config);
  }

  protected authorizationRules(
    clientVpnEndpoint: string,
    region: RegionConfig<AwsProvider>,
    regionConstructIndex: number,
    nodeScope: Construct
  ) {
    new Ec2ClientVpnAuthorizationRule(
      nodeScope,
      `AllowAllNonProd-${regionConstructIndex}`,
      {
        provider: region.provider,
        clientVpnEndpointId: clientVpnEndpoint,
        targetNetworkCidr: '10.0.0.0/8',
        authorizeAllGroups: true,
        description: `Allows access to all users on the VPN`,
      }
    );
  }
}
