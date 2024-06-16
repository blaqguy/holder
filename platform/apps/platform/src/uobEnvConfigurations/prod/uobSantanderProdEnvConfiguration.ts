import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobSantanderProdEnvConfiguration {
  public static configuration: environment = {
    sant01: {
      properties: {
        constructNamePattern: '',
        clusterName: 'sant-prod-cluster',
        fiName: 'sant',
        activeRegion: 'default',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'santander',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'santander-prod-allow-list',
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
            bucketName: 'santander-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
        ],
      },
      tiers: {
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-0e451e5d73ca6b9b2', 'ami-085100a6e1e0d6187'],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: [
            'ami-0ddc09eec63a86e97',
            'ami-0c3e7eb6dc0d4dc62',
            'ami-097d2d0d4dad4fc65',
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
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
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSantanderProdAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        app: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: [
            'ami-03ad872b4c09b60fc',
            'ami-0199e434863a3a842',
            'ami-0025c8aa4534305b4',
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rpt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-03adadeb9dca1460f', 'ami-0870510bf72b60724'],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}prod${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: Array(2).fill(
            Constants.MANAGED_AMI_IDS.DFRECOVERY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ]
          ),
          instanceType: 'r6i.large',
          createVolumesInRecovery: true, // Recovery RT isn't snapshots of primary instances that already have volumes, so tell uobTier.ts to create volumes
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          instanceResourceConfig: {},
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        bat: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-0d5dc34f8bda24eb1', 'ami-0aea2172437b6c547'],
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-0f574f6e27e26d109', 'ami-0328d6cfc60f16936'],
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
          },
          tierIngresses: [
            {
              description:
                'TEMP - Allow all traffic from SANTANDER PROD Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSantanderProdAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared Prod Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          customerMappings: [
            {
              customerSubdomain: 'mq.santander',
              props: {
                targetGroups: [
                  {
                    constructName: 'mq-sant-prod-1417',
                    targetPort: 1417,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1417,
                        lbProtocol: 'TCP',
                        name: 'mq-sant-prod-1417',
                      },
                    ],
                  },
                ],
              },
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
      dbConfigs: [
        {
          id: 'sant01-uob-01',
          route53Name: 'dbsant.prod',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 600,
          instanceClass: 'db.m6i.2xlarge',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'sant01-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBSANT',
          sopsDbProperty: 'dbsantuob',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
  };
}
