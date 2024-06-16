import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobMuobUatEnvConfiguration {
  public static configuration: environment = {
    muobUat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muob-uat-cluster',
        fiName: 'muob',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'muobu1',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobu1-uat-allow-list',
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
            bucketName: 'muob-uat-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'muobu4',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobu4-uat-allow-list',
            },
            albProps: {
              targetPort: 30108,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30108',
                protocol: 'HTTPS',
                path: '/',
              },
              cloudfrontOriginReadTimeout: 180,
              idleTimeout: 180,
            },
            bucketName: 'muobu4-uat-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'globalcash-usa-uat.sgmarkets.com',
              skipSubDomain: true,
              skipDomain: true,
              constructName: 'sgmarkets',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'sgmarkets-uat-allow-list',
            },
            albProps: {
              certImported: true,
              targetPort: 30107,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30107',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'sgmarkets-uat-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'aws-uat-businessbanking.bankcentral.net',
              skipSubDomain: true,
              skipDomain: true,
              constructName: 'bank-central',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'bank-central-uat-allow-list',
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
            },
            bucketName: 'bank-central-uat-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'aws-uat-businessbanking.centralbank.net',
              skipSubDomain: true,
              skipDomain: true,
              constructName: 'central-bank',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'central-bank-uat-allow-list',
            },
            albProps: {
              certImported: true,
              targetPort: 30102,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30102',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'central-bank-uat-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'aws-uat-businessbanking.jefferson-bank.com',
              skipSubDomain: true,
              skipDomain: true,
              constructName: 'jefferson-bank',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'jefferson-bank-uat-allow-list',
            },
            albProps: {
              certImported: true,
              targetPort: 30104,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30104',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'jefferson-bank-uat-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'muobu1ms',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobu1ms-uat-allow-list',
            },
            albProps: {
              targetPort: 9010,
              targetProtocol: 'HTTP',
              healthCheck: {
                port: '9010',
                protocol: 'HTTP',
                path: '/',
              },
            },
            bucketName: 'muobu1ms-uat-public-logging',
            deployToXL: true,
            msiTargetTierOverride: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'uat-associated.bankonline.com',
              skipDomain: true,
              rootZoneNameOverride: 'bankonline.com',
              constructName: 'uat-associated',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'associated-uat-allow-list',
            },
            albProps: {
              targetPort: 30109,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30109',
                protocol: 'HTTPS',
                path: '/',
              },
              originSslProtocolsOverride: ['TLSv1', 'TLSv1.1', 'TLSv1.2'],
              securityPolicyOverride: 'TLSv1_2016',
            },
            bucketName: 'associated-uat-public-logging',
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
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
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
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
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 22,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
              description: 'TEMP - Allow all traffic from MUOB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          customerMappings: [
            {
              customerSubdomain: 'mq.mt',
              props: {
                targetGroups: [
                  {
                    constructName: 'mq-mt-uat-target-1414',
                    targetPort: 1414,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1414,
                        lbProtocol: 'TCP',
                        name: 'mq-mt-uat-listener-1414',
                      },
                    ],
                  },
                  {
                    constructName: 'mq-mt-uat-target-1416',
                    targetPort: 1416,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1416,
                        lbProtocol: 'TCP',
                        name: 'mq-mt-uat-listener-1416',
                      },
                    ],
                  },
                  {
                    constructName: 'mq-mt-uat-target-1417',
                    targetPort: 1417,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1417,
                        lbProtocol: 'TCP',
                        name: 'mq-mt-uat-listener-1417',
                      },
                    ],
                  },
                  {
                    constructName: 'mq-mt-uat-target-1420',
                    targetPort: 1420,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1420,
                        lbProtocol: 'TCP',
                        name: 'mq-mt-uat-listener-1420',
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
          id: 'dbmuobu1'.toLowerCase(),
          route53Name: 'dbmuobu1.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 500,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'dbmuobu1-uat-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMUOB',
          sopsDbProperty: 'dbmuobu1',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
        {
          id: 'dbmuobu2'.toLowerCase(),
          route53Name: 'dbmuobu2.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'dbmuobu2-uat-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMUOB',
          sopsDbProperty: 'dbmuobu2',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
        {
          id: 'dbmuobu3'.toLowerCase(),
          route53Name: 'dbmuobu3.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'dbmuobu3-uat-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBMUOB',
          sopsDbProperty: 'dbmuobu3',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
    muobu2Uat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muobu2-uat-cluster',
        fiName: 'muobu2',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'muobu2',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobu2-uat-allow-list',
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
            bucketName: 'muobu2-uat-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'muobu3',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobu3-uat-allow-list',
            },
            albProps: {
              targetPort: 30103,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30103',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'muobu3-uat-public-logging',
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'muobu5',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'muobu5-uat-allow-list',
            },
            albProps: {
              targetPort: 30108,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30108',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'muobu5-uat-public-logging',
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
          customerMappings: [
            {
              customerSubdomain: 'fhlbau5',
              props: {
                targetGroups: [
                  {
                    constructName: 'internal-alb-target-group',
                    tgAttachmentConstructNameOverride:
                      'customer-lb-internal-alb-target-group',
                    targetGroupNameOverride: 'fhlbau5-customer-alb',
                    targetPort: 30102,
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
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
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
              description: 'TEMP - Allow all traffic from MUOB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
    },
    muobu3Uat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muobu3-uat-cluster',
        fiName: 'muobu3',
      },
      tiers: {
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        msi: {
          count: 1,
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
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
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
        rt: {
          count: 11,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
      },
    },
    muobu4Uat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muobu4-uat-cluster',
        fiName: 'muobu4',
        useDbConfigs: true,
      },
      tiers: {
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
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
        rt: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
          id: 'muobu4'.toLowerCase(),
          route53Name: 'dbmuobu4.uat',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          multiRegionKey: true,
          parameterGroupConfig: {
            name: 'dbmuobu4-uat-oracle-ee-19',
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
          sopsDbProperty: 'dbmuobu4',
          optionGroupName: 'dbmuobu4-uat-ee-19',
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
    muobu5Uat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'muobu5-uat-cluster',
        fiName: 'muobu5',
        useDbConfigs: true,
      },
      tiers: {
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
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
                DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
              ],
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
      },
      dbConfigs: [
        {
          id: 'muobu5'.toLowerCase(),
          route53Name: 'dbmuobu5.uat',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          multiRegionKey: true,
          parameterGroupConfig: {
            name: 'dbmuobu5-uat-oracle-ee-19',
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
          sopsDbProperty: 'dbmuobu5',
          optionGroupName: 'dbmuobu5-uat-ee-19',
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
  };
}
