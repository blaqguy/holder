import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobEwbProdEnvConfiguration {
  public static configuration: environment = {
    ewbProd: {
      properties: {
        constructNamePattern: '',
        clusterName: 'ewbk-prod-cluster',
        fiName: 'ewbk',
        activeRegion: 'default', // Update this to recovery for DR?
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'eastwestbank.prod.dragonflyft.com',
              skipDomain: true,
              constructName: 'ewbk',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'ewbk-prod-allow-list',
            },
            albProps: {
              targetPort: 30101,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '30101',
                protocol: 'HTTPS',
                path: '/',
                interval: 10,
              },
              cloudfrontOriginReadTimeout: 180,
            },
            bucketName: 'ewbk-prod-public-logging',
            deployToXL: true,
          },
        ],
      },
      tiers: {
        web: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-08b259db38d6bf3e6', 'ami-0456126eb7656b95c'],
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
            'ami-0ed80d060f5848e9a',
            'ami-036b50aa131489eb7',
            'ami-02705f9880b7479d5',
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
                DfAccounts.getEwbProdAccountDef().vpcCidrs.main.primary,
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
            'ami-0950afeb9b467a7f6',
            'ami-04a5040b67fc8ca0e',
            'ami-0a2c372d6926da56b',
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
          recoveryAmiIds: ['ami-0753072964be09af9', 'ami-0c7f0ae79eb50303f'],
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
          // RT is not deployed from recovery snapshot AMIs. They are standalone instances configured from scratch.
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
          customerMappings: [
            {
              customerSubdomain: 'upf.ewb.internal',
              props: {
                targetGroups: [
                  {
                    constructName: 'upf-ewb-prod-8076',
                    targetPort: 8076,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8076,
                        lbProtocol: 'TCP',
                        name: 'upf-ewb-prod-8076',
                      },
                    ],
                  },
                  {
                    constructName: 'upf-ewb-prod-8077',
                    targetPort: 8077,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 8077,
                        lbProtocol: 'TCP',
                        name: 'upf-ewb-prod-8077',
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
              description:
                'TEMP - Allow all traffic from Shared Prod Primary and Recovery',
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
        bat: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          recoveryAmiIds: ['ami-05d93969bc9bfe7e1', 'ami-0e18a30cc1eff5a77'],
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
          recoveryAmiIds: ['ami-046a6babecdb1d7e4', 'ami-05101de718355a9f5'],
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
              description: 'TEMP - Allow all traffic from EWB PROD Primary',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [
                DfAccounts.getEwbProdAccountDef().vpcCidrs.main.primary,
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
              customerSubdomain: 'mq.ewb',
              props: {
                targetGroups: [
                  {
                    constructName: 'mq-ewb-prod-1456',
                    targetPort: 1456,
                    targetProtocol: 'TCP',
                    listeners: [
                      {
                        lbPort: 1456,
                        lbProtocol: 'TCP',
                        name: 'mq-ewb-prod-1456',
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
          id: 'dbewbk'.toLowerCase(),
          route53Name: 'dbewbk.prod',
          engine: 'oracle-ee',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 1000,
          instanceClass: 'db.m6i.2xlarge',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'dbewbk-prod-se2-19',
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
          sopsDbProperty: 'dbewbkprod',
          prodCustomerData: true,
          additionalSgCidrBlocks: [
            DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
          ],
        },
      ],
    },
  };
}
