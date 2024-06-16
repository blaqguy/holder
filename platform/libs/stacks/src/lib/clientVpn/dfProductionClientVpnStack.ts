import { Ec2ClientVpnAuthorizationRule } from '@cdktf/provider-aws/lib/ec2-client-vpn-authorization-rule';
import {
  DfClientVpnStack,
  DfClientVpnStackConfig,
  StackConfig,
} from '../stacks';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { RegionConfig } from '@dragonfly/constructs';
import { Construct } from 'constructs';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';

/* eslint-disable require-jsdoc */
export class DfProductionClientVpnStack extends DfClientVpnStack {
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
    // Allow AWS Admins anywhere
    new Ec2ClientVpnAuthorizationRule(
      nodeScope,
      `AllowAllProd-${regionConstructIndex}`,
      {
        provider: region.provider,
        clientVpnEndpointId: clientVpnEndpoint,
        targetNetworkCidr: '10.0.0.0/8',
        accessGroupId: Constants.AUTHORIZED_GROUP_AWS_ADMINS,
        description: `Allows access to all users on the VPN`,
      }
    );

    // Allow anyone on the Prod VPN access to Tools
    Object.values(DfAccounts.getToolsAccountDef().vpcCidrs.main).forEach(
      (cidr, ruleIndex) => {
        new Ec2ClientVpnAuthorizationRule(
          nodeScope,
          `tools-access-${regionConstructIndex}-${ruleIndex}`,
          {
            provider: region.provider,
            clientVpnEndpointId: clientVpnEndpoint,
            targetNetworkCidr: cidr,
            authorizeAllGroups: true,
            description: `Allows access to all users on the VPN`,
          }
        );
      }
    );

    Object.values(DfAccounts.customers).forEach((customerConfig) => {
      customerConfig.accounts.forEach((accountConfig) => {
        let appAccessGroupId;
        let databaseAccessGroupId;

        if (
          accountConfig.ouId === Constants.UAT_OU_ID ||
          accountConfig.ouId === Constants.IST_OU_ID
        ) {
          appAccessGroupId =
            Constants.AUTHORIZED_GROUP_UAT_NETWORK_SERVER_ACCESS;
          databaseAccessGroupId =
            Constants.AUTHORIZED_GROUP_UAT_NETWORK_DB_ACCESS;
        } else if (accountConfig.ouId === Constants.PROD_OU_ID) {
          appAccessGroupId =
            Constants.AUTHORIZED_GROUP_PROD_NETWORK_SERVER_ACCESS;
          databaseAccessGroupId =
            Constants.AUTHORIZED_GROUP_PROD_NETWORK_DB_ACCESS;
        } else {
          // If its neither a UAT or PROD OU skip
          return;
        }

        [
          accountConfig.vpcCidrs.main?.primary,
          accountConfig.vpcCidrs.main?.recovery,
          // IST uses legacy as the primary region but other prod like environments don't
          accountConfig.vpcCidrs.main?.legacy,          
        ].forEach((cidr, destinationRegionIndex) => {
          // Skip auth rule logic if the CIDR equals 'na'
          if (cidr === 'na') {
            return;
          }

          Utils.getDragonflyAppSubnetsFromCidr(cidr).forEach(
            (appSubnet, subnetIndex) => {
              new Ec2ClientVpnAuthorizationRule(
                nodeScope,
                `${accountConfig.alias}-AppAccess-${regionConstructIndex}-${destinationRegionIndex}-${subnetIndex}`,
                {
                  provider: region.provider,
                  clientVpnEndpointId: clientVpnEndpoint,
                  targetNetworkCidr: appSubnet,
                  accessGroupId: appAccessGroupId,
                  description: 'Allow access to authorized App users',
                }
              );
            }
          );

          Utils.getDragonflyDataSubnetsFromCidr(cidr).forEach(
            (dataSubnet, subnetIndex) => {
              new Ec2ClientVpnAuthorizationRule(
                nodeScope,
                `${accountConfig.alias}-DataAccess-${regionConstructIndex}-${destinationRegionIndex}-${subnetIndex}`,
                {
                  provider: region.provider,
                  clientVpnEndpointId: clientVpnEndpoint,
                  targetNetworkCidr: dataSubnet,
                  accessGroupId: databaseAccessGroupId,
                  description: 'Allow access to authorized DB users',
                }
              );
            }
          );
        });
      });
    });
  }
}
