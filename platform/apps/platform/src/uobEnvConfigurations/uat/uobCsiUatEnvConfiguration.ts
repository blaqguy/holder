import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobCsiEnvConfiguration {
  public static configuration: environment = {
    csi: {
      properties: {
        constructNamePattern: '',
        clusterName: 'csi-cluster',
        fiName: 'csi',
        useDbConfigs: true,
      },
      tiers: {
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 350,
              deviceName: '/dev/sdg',
            },
            {
              volumeName: 'Apps',
              volumeSize: 200,
              deviceName: '/dev/sdh',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rpt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 't3.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 30,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        bat: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'batch-Platform',
              volumeSize: 50,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
      dbConfigs: [
        {
          id: 'oracleInstance'.toLowerCase(),
          route53Name: 'dbcsiu1.uat',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'uob-oracle-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBCSI',
          sopsDbProperty: 'csiuatapp',
          timezone: 'America/New_York',
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
  };
}
