import {
  DfSharedInternalAlbConstruct,
  SharedInternalAlbConfig,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants, Utils } from '@dragonfly/utils';

interface EbHelperStackConfig {
  stackName: string;
  stackConfig: StackConfig;
  deploymentRegionAlias: Constants.AWS_REGION_ALIASES;
  sharedAlbConfig: Omit<
    SharedInternalAlbConfig,
    | 'scope'
    | 'id'
    | 'provider'
    | 'masterAccountProvider'
    | 'sharedNetworkAccountProvider'
  >;
}

export class EbHelperStack extends RemoteStack {
  constructor(config: EbHelperStackConfig) {
    super(config.stackName, config.stackConfig);

    new DfSharedInternalAlbConstruct({
      scope: this,
      id: config.stackName,
      provider: this.getProviderForRegion(config.deploymentRegionAlias),
      certificateDomainConfig: config.sharedAlbConfig.certificateDomainConfig,
      subjectAlternativeNamesToPortsMap:
        config.sharedAlbConfig.subjectAlternativeNamesToPortsMap,
      masterAccountProvider: this.createAwsProvider({
        supportedRegion: Utils.getRegionAliasFromRegion(
          Constants.AWS_REGION_MAP[config.deploymentRegionAlias]
        ),
        forAccount: Utils.getMasterAccountProviderConfig(),
      }),
      vpc: config.sharedAlbConfig.vpc,
      sharedNetworkAccountProvider: this.createAwsProvider({
        supportedRegion: Utils.getRegionAliasFromRegion(
          Constants.AWS_REGION_MAP[config.deploymentRegionAlias]
        ),
        forAccount: Utils.getSharedNetworkAccountProviderConfig(),
      }),
    });
  }
}
