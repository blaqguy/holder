import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobSantUatEnvConfiguration {
  public static configuration: environment = {
    santUat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'sant-uat-cluster',
        fiName: 'sant',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'santanderu1',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'santanderu1-uat-allow-list',
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
            bucketName: 'santanderu1-uat-public-logging',
            deployToXL: true,
            deploySeparateWafStack: true,
          },
          {
            recordProps: {
              recordName: 'santanderu2',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'santanderu2-uat-allow-list',
            },
            albProps: {
              targetPort: 30102,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30102',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'santanderu2-uat-public-logging',
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
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
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
        bat: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
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
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from SANT UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
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
              description: 'TEMP - Allow all traffic from SANT UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
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
              customerSubdomain: 'mq.santander',
              props: {
                targetGroups: [
                  {
                    constructName: 'mq-sant-prod-1427',
                    targetPort: 1427,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1427,
                        lbProtocol: 'TCP',
                        name: 'mq-sant-prod-1427',
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
          id: 'db-santu1',
          route53Name: 'dbsantu1.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'db-santu1-uat-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBSANT',
          sopsDbProperty: 'dbsantu1',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
    santUat2: {
      properties: {
        constructNamePattern: '',
        clusterName: 'sant-uat-2-cluster',
        fiName: 'santu2',
        useDbConfigs: true,
      },
      tiers: {
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
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
                DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
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
        app: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
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
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
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
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
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
          id: 'dbsantu2',
          route53Name: 'dbsantu2.uat',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'db-santu2-uat-ee-19',
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
          sopsDbProperty: 'dbsantu2',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
  };
}
