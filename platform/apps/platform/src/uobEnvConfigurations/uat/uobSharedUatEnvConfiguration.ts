import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobSharedUatEnvConfiguration {
  public static configuration: environment = {
    sharedUat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'shared-uat-cluster',
        fiName: 'shared',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'eastwestbanku3',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'eastwestbanku3-uat-allow-list',
            },
            albProps: {
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'eastwestbanku3-uat-public-logging',
            deploySeparateWafStack: true,
          },
        ],
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
            },
            {
              volumeName: 'Data',
              volumeSize: 400,
              deviceName: '/dev/sdh',
              encrypted: true,
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
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxuat${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        lbs: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 't3.medium',
          volumes: [
            {
              volumeName: 'liquiBase',
              volumeSize: 800,
              deviceName: '/dev/sdg',
              encrypted: true,
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
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxuat${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-0a1ee785db31813e9', 'ami-0c1cda7c0cd9e0970'],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 350,
              deviceName: '/dev/sdg',
              encrypted: true,
            },
            {
              volumeName: 'Apps',
              volumeSize: 200,
              deviceName: '/dev/sdh',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from EWB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.recovery,
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.recovery,
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.recovery,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxuat${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-054f8d05abff0b839', 'ami-0b537a361afacbc25'],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from EWB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.recovery,
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.recovery,
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.recovery,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxuat${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        sim: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: true,
            disableApiStop: true,
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            'uobxcuat${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
      },
    },
  };
}
