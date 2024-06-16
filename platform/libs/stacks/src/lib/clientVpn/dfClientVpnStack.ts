import {
  DfClientVpnConstruct,
  DfGatewayVpcConstruct,
  RegionConfig,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import {
  AccountDefinition,
  AccountProviderConfig,
  Constants,
  Utils,
} from '@dragonfly/utils';
import { TerraformOutput } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Construct } from 'constructs';

export interface DfClientVpnStackConfig {
  gatewayVpcs: {
    legacy: {
      vpcConstruct: DfGatewayVpcConstruct;
      vpcCidrBlock: string;
    };
    primary: {
      vpcConstruct: DfGatewayVpcConstruct;
      vpcCidrBlock: string;
    };
    recovery: {
      vpcConstruct: DfGatewayVpcConstruct;
      vpcCidrBlock: string;
    };
  };
  cvpnCidrs: {
    legacy: string;
    primary: string;
    recovery: string;
  };
  masterAccountProviderConfig: AccountProviderConfig;
  R53Cname: string;
  account: AccountDefinition;
}

/* eslint-disable require-jsdoc */
export abstract class DfClientVpnStack extends RemoteStack {
  constructor(
    stackName: string,
    protected stackConfig: StackConfig,
    protected config: DfClientVpnStackConfig
  ) {
    super(stackName, stackConfig);

    const cvpn = new DfClientVpnConstruct(this, 'client-vpn', {
      regionalConfig: {
        legacy: {
          provider: null,
          vpc: config.gatewayVpcs.legacy.vpcConstruct,
          gatewayVpcCidr: config.gatewayVpcs.legacy.vpcCidrBlock,
          vpnCidrBlock: config.cvpnCidrs.legacy,
        },
        primary: {
          provider: this.primaryProvider,
          vpc: config.gatewayVpcs.primary.vpcConstruct,
          gatewayVpcCidr: config.gatewayVpcs.primary.vpcCidrBlock,
          vpnCidrBlock: config.cvpnCidrs.primary,
        },
        recovery: {
          provider: this.recoveryProvider,
          vpc: config.gatewayVpcs.recovery.vpcConstruct,
          gatewayVpcCidr: config.gatewayVpcs.recovery.vpcCidrBlock,
          vpnCidrBlock: config.cvpnCidrs.recovery,
        },
      },
      federatedAccountId: this.stackConfig.federatedAccountId,
      masterAccountProvider: this.createAwsProvider({
        supportedRegion: Utils.getRegionAliasFromRegion(
          Constants.AWS_REGION_MAP[Constants.AWS_REGION_ALIASES.LEGACY]
        ),
        forAccount: config.masterAccountProviderConfig,
      }),
      R53Cname: config.R53Cname,
      account: config.account,
      authRuleCallback: this.authorizationRules,
    });

    new TerraformOutput(this, Constants.CROSS_STACK_OUTPUT_CVPN_ENDPOINT_IDS, {
      value: cvpn.clientVpnEndpointsId,
    });
  }

  protected abstract authorizationRules(
    clientVpnId: string,
    region: RegionConfig<AwsProvider>,
    regionConstructIndex: number,
    nodeScope: Construct
  );
}
