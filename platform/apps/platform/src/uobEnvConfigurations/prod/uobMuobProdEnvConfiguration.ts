import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobMultiTenantProdEnvConfiguration {
  public static configuration: environment = {
    muobProd: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muob-prod-cluster',
        fiName: 'muob',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'mizuho.bankonline.com',
              skipDomain: true,
              rootZoneNameOverride: 'bankonline.com',
              constructName: 'mizuho',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'mizuho-prod-allow-list',
            },
            albProps: {
              targetPort: 30114,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30114',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'mizuho-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'muob',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muob-prod-allow-list',
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
            bucketName: 'muob-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: false,
          },
        ],
      },
      tiers: {
        web: {
          count: 2,
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
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
                DfAccounts.getMuobProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        app: {
          count: 4,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.2xlarge',
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
          tierIngresses: [],
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
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}prod${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 22,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          // RT is not deployed from recovery snapshot AMIs. They are standalone instances configured from scratch.
          recoveryAmiIds: Array(22).fill(
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
          tierIngresses: [],
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
          instanceType: 'r6i.2xlarge',
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
        mq: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
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
          },
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getMuobProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          customerMappings: [
            {
              customerSubdomain: 'mq.mt',
              props: {
                targetGroups: [
                  {
                    constructName: 'prod-target-1416',
                    targetPort: 1416,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1416,
                        lbProtocol: 'TCP',
                        name: 'prod-listener-1416',
                      },
                    ],
                  },
                  {
                    constructName: 'prod-target-1417',
                    targetPort: 1417,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1417,
                        lbProtocol: 'TCP',
                        name: 'prod-listener-1417',
                      },
                    ],
                  },
                  {
                    constructName: 'prod-target-1420',
                    targetPort: 1420,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1420,
                        lbProtocol: 'TCP',
                        name: 'prod-listener-1420',
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
          id: 'muobProd-OracleInstance'.toLowerCase(),
          route53Name: 'dbmuob.prod',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 1250,
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
          dbName: 'DBMUOB',
          sopsDbProperty: 'dbmuobprod',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
    muobp2: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muobp2-cluster',
        fiName: 'muobp2',
        useDbConfigs: true,
        activeRegion: 'default',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'muobp2',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobp2-uat-allow-list',
            },
            albProps: {
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
              },
              cloudfrontOriginReadTimeout: 60,
            },
            bucketName: 'muobp2-prod-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'dnb.bankonline.com',
              skipDomain: true,
              rootZoneNameOverride: 'bankonline.com',
              constructName: 'dnb',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'dnb-prod-allow-list',
            },
            albProps: {
              targetPort: 30104,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30104',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'dnb-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'ease-pay.bankonline.com',
              skipDomain: true,
              rootZoneNameOverride: 'bankonline.com',
              constructName: 'ease-pay',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'ease-pay-prod-allow-list',
            },
            albProps: {
              targetPort: 30105,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30105',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'ease-pay-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'globalcash-usa.sgmarkets.com',
              skipSubDomain: true,
              skipDomain: true,
              constructName: 'sgmarkets',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'sgmarkets-prod-allow-list',
            },
            albProps: {
              certImported: true,
              targetPort: 30103,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30103',
                protocol: 'HTTPS',
                path: '/',
              },
              cloudfrontOriginReadTimeout: 180,
            },
            bucketName: 'sgmarkets-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'bbh.bankonline.com',
              skipDomain: true,
              rootZoneNameOverride: 'bankonline.com',
              constructName: 'bbh',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'bbh-prod-allow-list',
              uriLists: [
                {
                  uriMatch: 'sam/logon',
                  listName: 'bbhSamLogonAllow',
                  allowList: [
                    Constants.DFT_STATIC_VPN,
                    ...Constants.BBH_WHITELIST,
                    ...Constants.NEW_RELIC_WHITELIST,
                  ],
                },
              ],
            },
            albProps: {
              targetPort: 30106,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30106',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'bbh-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'nordea.bankonline.com',
              skipDomain: true,
              rootZoneNameOverride: 'bankonline.com',
              constructName: 'nordea',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'nordea-prod-allow-list',
            },
            albProps: {
              targetPort: 30107,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30107',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'nordea-prod-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
        ],
      },
      tiers: {
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          recoveryAmiIds: ['ami-04a84f365537011a2', 'ami-066e7eb2be4899f6b'],
          instanceType: 't3.large',
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
                    constructName: 'muobp2-fhlba',
                    tgAttachmentConstructNameOverride:
                      'muobp2-fhlba-internal-customer-alb-target-group',
                    targetGroupNameOverride: 'muobp2-fhlba-customer-alb',
                    targetPort: 30102,
                    targetProtocol: 'HTTPS',
                    listeners: [
                      {
                        lbPort: 443,
                        lbProtocol: 'HTTPS',
                        name: 'alb-tls-listener',
                        overrideListenerConstructName: 'muobp2-fhlba',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          recoveryAmiIds: [
            'ami-05e7aaf23a25c996f',
            'ami-05289f6690577a891',
            'ami-0a88649c9b3946e11',
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
                DfAccounts.getMuobProdAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        app: {
          count: 4,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          recoveryAmiIds: [
            'ami-0ad641f816749c96c',
            'ami-0ab4249fbb7ce013e',
            'ami-085aee9be9358f4a3',
            'ami-0cc7cae5e1f9754da',
          ],
          instanceType: 'r6i.2xlarge',
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
          tierIngresses: [],
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
          amiPatternOverride: [
            'ami-065d46206b289389a',
            'ami-0e4db53c6fc81d3a5',
          ],
          recoveryAmiIds: ['ami-01e6b19ad86bc8e06', 'ami-0ef8edb8973f2343a'],
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
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}prod${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
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
          recoveryAmiIds: ['ami-0d310ad1824dc1805', 'ami-09eb87fba76a0f5a1'],
          instanceType: 'r6i.2xlarge',
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
        mq: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          recoveryAmiIds: ['ami-0cfa6300a1dbf4a4a', 'ami-00abcae3886a4afc7'],
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
              description: 'TEMP - Allow all traffic from within primary VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getMuobProdAccountDef().vpcCidrs.main.primary,
              ],
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
          id: 'muobp2',
          route53Name: 'dbmuobp2.prod',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 1250,
          instanceClass: 'db.m6i.4xlarge',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'muobp2-ee-19',
            family: 'oracle-ee-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMUOBP2',
          sopsDbProperty: 'dbmuobprod2',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
  };
}
