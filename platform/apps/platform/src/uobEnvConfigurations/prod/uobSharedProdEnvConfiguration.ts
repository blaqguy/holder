import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobSharedProdEnvConfiguration {
  public static configuration: environment = {
    sharedProd: {
      properties: {
        constructNamePattern: '',
        clusterName: 'shared-prod-cluster',
        fiName: 'shared',
      },
      tiers: {
        bld: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 't3.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 350,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
            {
              volumeName: 'Data',
              volumeSize: 400,
              deviceName: '/dev/sdh',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
          },
          tierIngresses: [
            {
              description: 'Allow SSH from Tools',
              fromPort: 22,
              toPort: 22,
              protocol: 'tcp',
              cidrBlocks: [
                DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from EWB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxprod${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        lbs: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-0cc02ad7f8bd303bd'],
          instanceType: 't3.medium',
          volumes: [
            {
              volumeName: 'liquiBase',
              volumeSize: 100,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
          },
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from EWB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxprod${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
    },
  };
}
