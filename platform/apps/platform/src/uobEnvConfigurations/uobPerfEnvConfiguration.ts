import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobPerfEnvConfiguration {
  public static configuration: environment = {
    sharedPerformance: {
      properties: {
        constructNamePattern:
          'uob-mod-${UobTier.TOKENS.tier}-${UobTier.TOKENS.instanceIndex}',
        clusterName: 'shared-performance-cluster',
        fiName: 'shared',
        disableAnsibleManagement: true,
      },
      tiers: {
        bld: {
          count: 1,
          ami: 'ami-0aa547e8d99fcca89',
          instanceType: 't3.medium',
          volumes: [
            {
              volumeName: 'controllerSupport',
              volumeSize: 350,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
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
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
      dbConfigs: [
        {
          id: 'uob-01',
          route53Name: 'uobxprforacle01.prf',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 3500,
          instanceClass: 'db.m6i.4xlarge',
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
          additionalOptions: [
            {
              optionName: 'STATSPACK',
            },
          ],
        },
        {
          // Temporarily stopped in RDS console
          id: 'performance-OracleInstance-Blue'.toLowerCase(),
          route53Name: 'uobxprforacle02.prf',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 3500,
          instanceClass: 'db.m6i.4xlarge',
          performanceInsightsEnabled: true,
          snapshotIdentifier: 'performance-2023-03-27-backup',
          parameterGroupConfig: {
            name: 'uob-oracle-se2-19-blue',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          additionalOptions: [
            {
              optionName: 'STATSPACK',
            },
          ],
        },
        {
          id: 'uob-02',
          route53Name: 'uobxprforacle03.prf',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 3500,
          instanceClass: 'db.m6i.4xlarge',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'uob-oracle-se2-02',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '3000',
              },
            ],
          },
          createBucket: false,
          additionalOptions: [
            {
              optionName: 'STATSPACK',
            },
          ],
        },
      ],
    },
    tprf: {
      properties: {
        constructNamePattern:
          'uob-mod-${UobTier.TOKENS.tier}-${UobTier.TOKENS.instanceIndex}',
        fiName: 'tprf',
        clusterName: 'tprf-cluster',
        disableAnsibleManagement: true,
      },
      tiers: {
        app: {
          count: 3,
          ami: 'ami-04fa32d10612fc3a7',
          instanceType: 'r6i.2xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        lbs: {
          count: 1,
          ami: 'ami-0b0c1ca62e7aa2d55',
          instanceType: 't3.2xlarge',
          volumes: [
            {
              volumeName: 'liquiBase',
              volumeSize: 800,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 1,
          ami: 'ami-0e64accd47ebae70d',
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 350,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        msi: {
          count: 3,
          ami: 'ami-0f4c62dee8260462e',
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [DfAccounts.getPerfAccountDef().vpcCidrs.main.legacy],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rpt: {
          count: 2,
          ami: 'ami-031753703b6aa5e24',
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 2,
          ami: 'ami-0a1bae75ac7a56c18',
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        web: {
          count: 2,
          ami: 'ami-05dee0639bda28ca9',
          instanceType: 't3.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxprf${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
    },
    stprf: {
      properties: {
        constructNamePattern: '',
        fiName: 'stprf',
        clusterName: 'stprf-cluster',
      },
      tiers: {
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        app: {
          count: 4,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.2xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rpt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [DfAccounts.getPerfAccountDef().vpcCidrs.main.legacy],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 50,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
            {
              volumeName: 'Apps',
              volumeSize: 50,
              deviceName: '/dev/sdh',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
    },
    ptprf: {
      properties: {
        constructNamePattern: '',
        fiName: 'ptprf',
        clusterName: 'ptprf-cluster',
      },
      tiers: {
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        app: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.2xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rpt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [DfAccounts.getPerfAccountDef().vpcCidrs.main.legacy],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 50,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
            {
              volumeName: 'Apps',
              volumeSize: 50,
              deviceName: '/dev/sdh',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
            disableApiTermination: true,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
    },
  };
}
