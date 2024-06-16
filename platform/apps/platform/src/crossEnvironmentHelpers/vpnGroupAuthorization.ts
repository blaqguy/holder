import {
  DfSpokeVpcStack,
  DfToolsVpcStack,
  StackConfig,
} from '@dragonfly/stacks';
import { Constants, AccountProviderConfig } from '@dragonfly/utils';
import { DataTerraformRemoteStateS3, Fn, S3BackendConfig } from 'cdktf';
import { Ec2ClientVpnAuthorizationRule } from '@cdktf/provider-aws/lib/ec2-client-vpn-authorization-rule';

interface VpnGroupAuthorizationConfig {
  spokeVpc: DfSpokeVpcStack | DfToolsVpcStack;
  cvpnS3BackendConfig: S3BackendConfig;
  region: Constants.AWS_REGION_ALIASES;
  accountProviderConfig: AccountProviderConfig;
  stackConfig: StackConfig;
  secondarySpokeVpc?: DfSpokeVpcStack | DfToolsVpcStack;
  tertiarySpokeVpc?: DfSpokeVpcStack | DfToolsVpcStack;
}
/**
 * Vpn Group Auth Class
 */
export class VpnGroupAuthorization {
  /**
   *
   * @param {VpnGroupAuthorizationConfig} config
   */
  constructor(config: VpnGroupAuthorizationConfig) {
    const remoteStateNonProdSharedNetworkStack = new DataTerraformRemoteStateS3(
      config.spokeVpc,
      `remote-state-vpn-group-auth-to-${config.region}-cvpn`,
      config.cvpnS3BackendConfig
    );

    const authGroupConfigs = [];
    // Create auth group for AWS admins
    authGroupConfigs.push({
      authorizedGroupName: 'AWS Admins',
      authroizedGroupDescription: 'Aws Admins',
      authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_ADMINS,
    });

    // Create auth group for AWS Security
    authGroupConfigs.push({
      authorizedGroupName: 'AWS Security',
      authroizedGroupDescription: 'Aws Security',
      authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_SECURITY,
    });

    // * Create auth group for default environment admin
    const defaultAuthGroup =
      Constants.OU[config.stackConfig.accountDefinition.organizationalUnit]
        .adminAuthorizationGroup;
    if (defaultAuthGroup) {
      authGroupConfigs.push(defaultAuthGroup);
    }

    // * Create any additional authorization group
    config.stackConfig.accountDefinition.additionalAuthorizedGroupConfigs.forEach(
      (x) => {
        authGroupConfigs.push(x);
      }
    );

    let cvpnEndpointId;
    if (config.region === Constants.AWS_REGION_ALIASES.LEGACY) {
      cvpnEndpointId = Fn.element(
        remoteStateNonProdSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_CVPN_ENDPOINT_IDS
        ),
        0
      );
    } else if (config.region === Constants.AWS_REGION_ALIASES.DF_PRIMARY) {
      cvpnEndpointId = Fn.element(
        remoteStateNonProdSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_CVPN_ENDPOINT_IDS
        ),
        1
      );
    } else {
      cvpnEndpointId = Fn.element(
        remoteStateNonProdSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_CVPN_ENDPOINT_IDS
        ),
        2
      );
    }

    // * Now create auth groups for main vpc
    authGroupConfigs.forEach((authorizedGroupConfig) => {
      new Ec2ClientVpnAuthorizationRule(
        config.spokeVpc,
        `${authorizedGroupConfig.authorizedGroupName}-${config.spokeVpc.environment}-VPNAccess`,
        {
          provider: config.spokeVpc.createAwsProvider({
            supportedRegion: config.region,
            forAccount: config.accountProviderConfig,
          }),
          clientVpnEndpointId: cvpnEndpointId,
          targetNetworkCidr:
            authorizedGroupConfig.authorizedCidr ?? config.spokeVpc.cidr,
          accessGroupId: authorizedGroupConfig.authorizedGroupId,
          description: authorizedGroupConfig.authroizedGroupDescription,
        }
      );
    });

    // * Now create auth groups for secondary vpc
    if (config.secondarySpokeVpc) {
      authGroupConfigs.forEach((authorizedGroupConfig) => {
        if (!authorizedGroupConfig.authorizedCidr) {
          new Ec2ClientVpnAuthorizationRule(
            config.spokeVpc,
            `${authorizedGroupConfig.authorizedGroupName}-${config.secondarySpokeVpc.environment}-VPNAccess-secondary-${config.region}`,
            {
              provider: config.spokeVpc.createAwsProvider({
                supportedRegion: config.region,
                forAccount: config.accountProviderConfig,
              }),
              clientVpnEndpointId: cvpnEndpointId,
              targetNetworkCidr:
                authorizedGroupConfig.authorizedCidr ??
                config.secondarySpokeVpc.cidr,
              accessGroupId: authorizedGroupConfig.authorizedGroupId,
              description: authorizedGroupConfig.authroizedGroupDescription,
            }
          );
        }
      });
    }

    // * Now create auth groups for tertiary vpc
    if (config.tertiarySpokeVpc) {
      authGroupConfigs.forEach((authorizedGroupConfig) => {
        if (!authorizedGroupConfig.authorizedCidr) {
          new Ec2ClientVpnAuthorizationRule(
            config.spokeVpc,
            `${authorizedGroupConfig.authorizedGroupName}-${config.tertiarySpokeVpc.environment}-VPNAccess-tertiary-${config.region}`,
            {
              provider: config.spokeVpc.createAwsProvider({
                supportedRegion: config.region,
                forAccount: config.accountProviderConfig,
              }),
              clientVpnEndpointId: cvpnEndpointId,
              targetNetworkCidr:
                authorizedGroupConfig.authorizedCidr ??
                config.tertiarySpokeVpc.cidr,
              accessGroupId: authorizedGroupConfig.authorizedGroupId,
              description: authorizedGroupConfig.authroizedGroupDescription,
            }
          );
        }
      });
    }
  }
}
