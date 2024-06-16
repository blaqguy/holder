import { AccountFactoryForTerraform } from '@dragonfly/generated';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';

/**
 * Account factory Module
 */
export class DfAccountFactoryStack extends RemoteStack {
  private static readonly STACK_ID = 'AccountFactoryStack';

  /**
   *
   * @param {StackConfig} stackConfig - Stack Config
   */
  constructor(protected stackConfig: StackConfig) {
    super(DfAccountFactoryStack.STACK_ID, stackConfig);

    new AccountFactoryForTerraform(this, 'MasterAccountFactoryModule', {
      ctManagementAccountId: this.stateAccountId,
      logArchiveAccountId: '506625313654',
      auditAccountId: '235848468354',
      aftManagementAccountId: '836063030363',
      ctHomeRegion: 'us-east-1',
      tfBackendSecondaryRegion: 'us-east-2',

      terraformDistribution: 'oss',
      vcsProvider: 'bitbucket',

      aftFeatureCloudtrailDataEvents: true,
      aftFeatureDeleteDefaultVpcsEnabled: true,
      aftFeatureEnterpriseSupport: false,

      accountCustomizationsRepoName: 'dragonnflyft/account-customization-ops',
      accountCustomizationsRepoBranch: 'master',

      accountProvisioningCustomizationsRepoBranch: 'master',
      accountProvisioningCustomizationsRepoName:
        'dragonflyft/account-provisioning-customization-ops',

      accountRequestRepoName: 'dragonflyft/account-request-ops',
      accountRequestRepoBranch: 'master',

      maximumConcurrentCustomizations: 3,
      aftMetricsReporting: true,
      cloudwatchLogGroupRetention: '7',
      terraformVersion: '1.2.9',
    });
  }
}
