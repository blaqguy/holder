import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobEwbUatEnvConfiguration {
  public static configuration: environment = {
    ewbUat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ewb-uat-cluster',
        fiName: 'ewbku3',
      },
      tiers: {
        msi: {
          count: 3,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: [
            'ami-0fcdce8a4fa951705',
            'ami-0a11002fded935622',
            'ami-05091be0bef610f3a',
          ],
          instanceType: 'r6i.xlarge',
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
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
              ],
            },
            {
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
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
          recoveryAmiIds: ['ami-0d179a99f7abac182', 'ami-09ee468fd7f30c16c'],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'appSupport',
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
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
          recoveryAmiIds: ['ami-0da8caa82902b234c', 'ami-04910264b3dd550e6'],
          instanceType: 'r6i.xlarge',
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
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
          recoveryAmiIds: ['ami-09e6fdf4925b0c9c6', 'ami-06b6ac8b12e9f8c49'],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
              encrypted: true,
            },
          ],
          customerMappings: [
            {
              customerSubdomain: 'upf-uat3.ewb.internal',
              props: {
                targetGroups: [
                  {
                    constructName: 'upf-uat3-ewb-8076',
                    targetPort: 8076,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8076,
                        lbProtocol: 'TCP',
                        name: 'upf-uat3-ewb-8076',
                      },
                    ],
                  },
                  {
                    constructName: 'upf-uat3-ewb-8077',
                    targetPort: 8077,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8077,
                        lbProtocol: 'TCP',
                        name: 'upf-uat3-ewb-8077',
                      },
                    ],
                  },
                ],
              },
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
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
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
          recoveryAmiIds: ['ami-055485727fdeff40a', 'ami-0025aebb2532836af'],
          instanceType: 'r6i.xlarge',
          volumes: [
            {
              volumeName: 'batch-Platform',
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
              description: 'TEMP - Allow all traffic from Shared UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
                DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
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
          },
          tierIngresses: [
            {
              description: 'TEMP - Allow all traffic from EWB UAT Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
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
              customerSubdomain: 'mq.ewb',
              props: {
                targetGroups: [
                  {
                    constructName: 'uat3-ewb-tg-1444',
                    targetPort: 1444,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1444,
                        lbProtocol: 'TCP',
                        name: 'uat3-ewb-1444',
                      },
                    ],
                  },
                  {
                    constructName: 'ewb-uat-tg-1433',
                    targetPort: 1433,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1433,
                        lbProtocol: 'TCP',
                        name: 'ewb-uat-1433',
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
          id: 'ewbUat-OracleInstance'.toLowerCase(),
          route53Name: 'dbewbk.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'ewb1-uob-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBEWBK',
          sopsDbProperty: 'dbewbkuob',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
        {
          id: 'ewb02-uob-01',
          route53Name: 'dbewbku2.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'ewb2-uob-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBEWBK',
          sopsDbProperty: 'dbewbkuob',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
        {
          id: 'ewbk-uob-01',
          route53Name: 'dbewbku1.uat',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'ewbk-uob-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
          dbName: 'DBEWBK',
          sopsDbProperty: 'dbewbk',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
    ewbUat02: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ewb2-uat-cluster',
        fiName: 'ewbku2',
      },
      tiers: {
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
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
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
          customerMappings: [
            {
              customerSubdomain: 'upf-uat2.ewb.internal',
              props: {
                targetGroups: [
                  {
                    constructName: 'upf-uat2-ewb-8076',
                    targetPort: 8076,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8076,
                        lbProtocol: 'TCP',
                        name: 'upf-uat2-ewb-8076',
                      },
                    ],
                  },
                  {
                    constructName: 'upf-uat2-ewb-8077',
                    targetPort: 8077,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8077,
                        lbProtocol: 'TCP',
                        name: 'upf-uat2-ewb-8077',
                      },
                    ],
                  },
                ],
              },
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
    ewbkUat: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ewbk-uat-cluster',
        fiName: 'ewbk',
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
                DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
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
          customerMappings: [
            {
              customerSubdomain: 'upf-uat1.ewb.internal',
              props: {
                targetGroups: [
                  {
                    constructName: 'upf-uat1-ewb-8076',
                    targetPort: 8076,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8076,
                        lbProtocol: 'TCP',
                        name: 'upf-uat1-ewb-8076',
                      },
                    ],
                  },
                  {
                    constructName: 'upf-uat1-ewb-8077',
                    targetPort: 8077,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8077,
                        lbProtocol: 'TCP',
                        name: 'upf-uat1-ewb-8077',
                      },
                    ],
                  },
                ],
              },
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
  };
}
