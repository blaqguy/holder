import { Route53VpcAssociationAuthorization } from '@cdktf/provider-aws/lib/route53-vpc-association-authorization';
import { Route53ZoneAssociation } from '@cdktf/provider-aws/lib/route53-zone-association';
import { AccountProviderConfig, Constants } from '@dragonfly/utils';
import { DataTerraformRemoteStateS3 } from 'cdktf';
import { NetworkInstanceConfig } from '../environments/abstractSharedNetworkEnvironment';
import { RemoteStack } from '@dragonfly/stacks';

interface PhzAttachmentProps {
  requestingStack: RemoteStack;
  vpcId: string;
  networkInstance: NetworkInstanceConfig;
  region: Constants.AWS_REGION_ALIASES;
  accountProviderConfig: AccountProviderConfig;
}

/**
 *
 */
export class PhzAttachment {
  /**
   *
   * @param {PhzAttachmentProps} config
   */
  constructor(config: PhzAttachmentProps) {
    const sharedNetworkProvider = config.requestingStack.createAwsProvider({
      supportedRegion: config.region,
      forAccount: config.accountProviderConfig,
    });

    const remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      config.requestingStack,
      `remote-state-phz-association-to-${config.networkInstance.remoteStateId}`,
      config.networkInstance.s3BackendProps
    );

    const r53AssociationAuthorization = new Route53VpcAssociationAuthorization(
      config.requestingStack,
      'R53VpcAssociationAuthorization',
      {
        provider: sharedNetworkProvider,
        vpcId: config.vpcId,
        zoneId: remoteStateSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
        ),
      }
    );

    new Route53ZoneAssociation(config.requestingStack, 'R53ZoneAssociation', {
      dependsOn: [r53AssociationAuthorization],
      vpcId: config.vpcId,
      zoneId: remoteStateSharedNetworkStack.getString(
        Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
      ),
      vpcRegion: Constants.AWS_REGION_MAP[config.region],
    });
  }
}
