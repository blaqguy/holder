import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobIstEnvConfiguration {
  public static configuration: environment = {
    sharedIst: {
      properties: {
        constructNamePattern: '',
        clusterName: 'shared-ist-cluster',
        fiName: 'shared',
      },
      tiers: {
        bld: {
          count: 1,
          ami: 'ami-0aa547e8d99fcca89',
          instanceType: 't3.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 350,
              deviceName: '/dev/sdg',
            },
            {
              volumeName: 'Data',
              volumeSize: 400,
              deviceName: '/dev/sdh',
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
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxist${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 1,
          ami: 'ami-0a1bae75ac7a56c18',
          instanceType: 'r6i.large',
          hostnamePatternOverride: ['uobxistrt01'],
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxist${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        lbs: {
          count: 1,
          ami: 'ami-0b0c1ca62e7aa2d55',
          instanceType: 't3.medium',
          volumes: [
            {
              volumeName: 'liquiBase',
              volumeSize: 800,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobxist${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        sim: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
            disableApiTermination: true,
            disableApiStop: true,
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            'uobxcist${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
        web: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 't3.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: true,
            disableApiStop: false,
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            'uobx${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
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
            },
            {
              volumeName: 'Apps',
              volumeSize: 50,
              deviceName: '/dev/sdh',
            },
          ],
          customerMappings: [
            {
              customerSubdomain: 'mq.ewb',
              props: {
                targetGroups: [
                  {
                    constructName: 'ewb-ist-tg-1444',
                    targetPort: 1444,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1444,
                        lbProtocol: 'TCP',
                        name: 'ewb-ist-1444',
                      },
                    ],
                  },
                ],
              },
            },
            {
              customerSubdomain: 'mq.mt',
              props: {
                targetGroups: [
                  {
                    constructName: 'mq-ist-tg-1415',
                    targetPort: 1415,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1415,
                        lbProtocol: 'TCP',
                        name: 'mq-ist-rt-conn-1415',
                      },
                    ],
                  },
                  {
                    constructName: 'mq-ist-tg-1416',
                    targetPort: 1416,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1416,
                        lbProtocol: 'TCP',
                        name: 'mq-ist-wires-1416',
                      },
                    ],
                  },
                  {
                    constructName: 'mq-ist-tg-1420',
                    targetPort: 1420,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1420,
                        lbProtocol: 'TCP',
                        name: 'mq-ist-audit-1420',
                      },
                    ],
                  },
                ],
              },
            },
          ],
          instanceResourceConfig: {
            userDataReplaceOnChange: false,
            disableApiStop: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            'uobx${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
      dbConfigs: [],
    },
    ist01: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ist01-cluster',
        fiName: 'fisanti1',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'santanderist1.ist.dragonflyft.com',
              skipDomain: true,
              constructName: 'sant',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'sant-ist-allow-list',
            },
            albProps: {
              // Overriding IST public ALBs because it has resources in US-EAST-1 but we want the gateway resources in US-EAST-2 / US-WEST-2
              region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
                interval: 10,
              },
              validationRecordAlreadyExists: true,
            },
            bucketName: 'sant-ist-public-logging',
            deployToXL: true,
          },
        ],
      },
      tiers: {
        app: {
          count: 1,
          ami: 'ami-04fa32d10612fc3a7',
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
          count: 1,
          ami: 'ami-0e64accd47ebae70d',
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
          count: 1,
          ami: 'ami-0f4c62dee8260462e',
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
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rpt: {
          count: 1,
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
          count: 1,
          ami: 'ami-05dee0639bda28ca9',
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
        rt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
      },
      dbConfigs: [
        {
          id: 'oracleInstance'.toLowerCase(),
          route53Name: 'dbsant.ist',
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
          dbName: 'DBSANT',
          timezone: 'America/New_York',
        },
      ],
    },
    muob01: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muob01-cluster',
        fiName: 'muob',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'muobist',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muob-ist-allow-list',
            },
            albProps: {
              // Overriding IST public ALBs because it has resources in US-EAST-1 but we want the gateway resources in US-EAST-2 / US-WEST-2
              region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'muob01-ist-public-cdk-logs',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'muobi2',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobi2-ist-allow-list',
            },
            albProps: {
              // Overriding IST public ALBs because it has resources in US-EAST-1 but we want the gateway resources in US-EAST-2 / US-WEST-2
              region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
              targetPort: 30107,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30107',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'muobi2-ist-public-logs',
            deploySeparateWafStack: true,
          },
        ],
      },
      tiers: {
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
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
          count: 5,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
        mq: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 30,
              deviceName: '/dev/sdg',
            },
            {
              volumeName: 'Apps',
              volumeSize: 20,
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
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 10,
              deviceName: '/dev/sdg',
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
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
            },
            {
              description:
                'Allow inbound connections on port 8080 for Tomcat - Required for MUOB only',
              fromPort: 8080,
              toPort: 8080,
              protocol: 'tcp',
              cidrBlocks: [
                DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                  .legacy.gatewayVpcCidr,
                DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                  .primary.gatewayVpcCidr,
                DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway
                  .recovery.gatewayVpcCidr,
              ],
            },
          ],
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
              volumeSize: 20,
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
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'm5.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
          customerMappings: [
            {
              customerSubdomain: 'fhlba',
              props: {
                targetGroups: [
                  {
                    constructName: 'internal-alb-target-group',
                    tgAttachmentConstructNameOverride:
                      'customer-lb-internal-alb-target-group',
                    targetGroupNameOverride: 'muob-customer-alb',
                    targetPort: 30106,
                    targetProtocol: 'HTTPS',
                    listeners: [
                      {
                        lbPort: 443,
                        lbProtocol: 'HTTPS',
                        name: 'alb-tls-listener',
                        overrideListenerConstructName:
                          'customer-lb-internal-alb-internal-alb-tls-listener',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      dbConfigs: [
        {
          id: 'muob-01'.toLowerCase(),
          route53Name: 'dbmuob.ist',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'muob-01-oracle-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMUOB',
          sopsDbProperty: 'dbmuob',
          timezone: 'America/New_York',
        },
      ],
    },
    ewbki1: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ewbki1-cluster',
        fiName: 'ewbki1',
      },
      tiers: {
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
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
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
            },
          ],
          customerMappings: [
            {
              customerSubdomain: 'upf.ewb.internal',
              props: {
                targetGroups: [
                  {
                    constructName: 'upf-ewb-ist-8076',
                    targetPort: 8076,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8076,
                        lbProtocol: 'TCP',
                        name: 'upf-ewb-ist-8076',
                      },
                    ],
                  },
                  {
                    constructName: 'upf-ewb-ist-8077',
                    targetPort: 8077,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8077,
                        lbProtocol: 'TCP',
                        name: 'upf-ewb-ist-8077',
                      },
                    ],
                  },
                ],
              },
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
        msi: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 10,
              deviceName: '/dev/sdg',
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
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
            },
          ],
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
              volumeSize: 20,
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
      },
      dbConfigs: [
        {
          id: 'ewbk1db'.toLowerCase(),
          route53Name: 'dbewbki1.ist',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'ewbk1-ist-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBEWBK',
          sopsDbProperty: 'dbewbki1',
          timezone: 'America/New_York',
        },
      ],
    },
    ssbti1: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ssbti1-cluster',
        fiName: 'ssbti1',
      },
      tiers: {
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
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
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
        msi: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 10,
              deviceName: '/dev/sdg',
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
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
            },
          ],
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
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
      },
    },
    mod: {
      properties: {
        constructNamePattern: '',
        clusterName: 'mod-cluster',
        fiName: 'mod',
        useDbConfigs: true,
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'modelbank',
              skipSubDomain: true,
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'modelbank-allow-list',
            },
            albProps: {
              // Overriding IST public ALBs because it has resources in US-EAST-1 but we want the gateway resources in US-EAST-2 / US-WEST-2
              region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'modelbank-public-cdn-logs',
            deploySeparateWafStack: true,
          },
        ],
      },
      tiers: {
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
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
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 't3.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: true,
            disableApiStop: false,
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
        rpt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 10,
              deviceName: '/dev/sdg',
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
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
            {
              volumeName: 'Apps',
              volumeSize: 50,
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
        rt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
      },
      dbConfigs: [
        {
          id: 'mod'.toLowerCase(),
          route53Name: 'dbmod.ist',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'mod-uob-oracle-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMOD',
          timezone: 'America/New_York',
          optionGroupName: 'mod-ist-ee-19',
        },
      ],
    },
    csi: {
      properties: {
        constructNamePattern: '',
        clusterName: 'csi-cluster',
        fiName: 'csi',
        useDbConfigs: true,
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'csi',
              skipSubDomain: false,
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'csi-allow-list',
            },
            albProps: {
              // Overriding IST public ALBs because it has resources in US-EAST-1 but we want the gateway resources in US-EAST-2 / US-WEST-2
              region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            deploySeparateWafStack: true,
          },
        ],
      },
      tiers: {
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
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
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 't3.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: true,
            disableApiStop: false,
            userDataReplaceOnChange: false,
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
        rpt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
        msi: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 10,
              deviceName: '/dev/sdg',
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
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
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
            },
            {
              volumeName: 'Apps',
              volumeSize: 50,
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
        rt: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
      },
      dbConfigs: [
        {
          id: 'csi'.toLowerCase(),
          route53Name: 'dbcsi.ist',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'csi-uob-oracle-ee-19',
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
          timezone: 'America/New_York',
          sopsDbProperty: 'istcsidb',
          optionGroupName: 'csi-ist-ee-19',
        },
      ],
    },
    muobi2: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muobi2-cluster',
        fiName: 'muobi2',
        useDbConfigs: true,
      },
      tiers: {
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
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
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            // Intentionally deploy 8.7 for RPT
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
        msi: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 10,
              deviceName: '/dev/sdg',
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
              cidrBlocks: [DfAccounts.getIstAccountDef().vpcCidrs.main.legacy],
            },
          ],
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
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
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
      },
      dbConfigs: [
        {
          id: 'muobi2'.toLowerCase(),
          route53Name: 'dbmuobi2.ist',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'muobi2-uob-oracle-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMUOB',
          timezone: 'America/New_York',
          sopsDbProperty: 'istmuobi2db',
          optionGroupName: 'muobi2-ist-ee-19',
        },
      ],
    },
  };
}
