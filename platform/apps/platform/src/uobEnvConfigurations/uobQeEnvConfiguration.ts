import { environment } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';
import {
  QE_APP_LEGACY,
  QE_APP_REDUCED,
  QE_APP_REDUCED_ENCRYPTED,
  QE_MQ_LEGACY,
  QE_MQ_REDUCED,
  QE_MQ_REDUCED_ENCRYPTED,
  QE_MSI_LEGACY,
  QE_MSI_REDUCED,
  QE_MSI_REDUCED_ENCRYPTED,
  QE_RPT_LEGACY,
  QE_RPT_REDUCED,
  QE_RT_REDUCED,
  QE_RPT_REDUCED_ENCRYPTED,
  QE_WEB_LEGACY,
  QE_WEB_REDUCED,
  QE_WEB_REDUCED_ENCRYPTED,
} from './qe/defaultTier';

/**
 * Class defining the uob env configurations
 */
export abstract class UobQeEnvConfiguration {
  private static readonly qeAppConfiguration = QE_APP_LEGACY;
  private static readonly qeMqConfiguration = QE_MQ_LEGACY;
  private static readonly qeMsiConfiguration = QE_MSI_LEGACY;
  private static readonly qeRptConfiguration = QE_RPT_LEGACY;
  private static readonly qeWebConfiguration = QE_WEB_LEGACY;

  /**
   *
   * @return {string[]}
   */
  private static upfAmiOverrides() {
    // Uses the default Rhel 8 image
    const upfAmis = Array(25).fill(undefined);

    // RHEL 7 image requested for Truist install
    upfAmis.push(
      Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_RHEL_7]
    );

    return upfAmis;
  }

  public static configuration: environment = {
    sharedQe: {
      properties: {
        constructNamePattern: '',
        fiName: 'shared',
        clusterName: 'shared-qe-cluster',
      },
      tiers: {
        bld: {
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'r6i.large',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 500,
              deviceName: '/dev/sdg',
            },
            {
              volumeName: 'Data',
              volumeSize: 500,
              deviceName: '/dev/sdh',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: true,
            disableApiStop: false,
            keyName: 'uobKeyPair',
            lifecycle: {
              ignoreChanges: ['user_data'],
            },
            tags: {
              'volume-reduction-target': 'false',
              'volume-reduction-restore-target': 'false',
            },
          },
          tierIngresses: [
            {
              description: 'Allow SSH from Tools',
              fromPort: 22,
              toPort: 22,
              protocol: 'tcp',
              cidrBlocks: [
                `${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`,
              ],
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        rt: {
          count: 27,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          amiPatternOverride: UobQeEnvConfiguration.upfAmiOverrides(),
          instanceType: 't3.xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiStop: false,
            userDataReplaceOnChange: false,
            tags: {
              'volume-reduction-target': 'false',
              'volume-reduction-restore-target': 'false',
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePatternOverride: [
            'uobxcqart01',
            'uobxcqart02',
            'uobxcqart03',
            'uobxcqart04',
            'uobxcqart05',
            'uobxcqart06',
            'uobxsqart01',
            'uobxsqart02',
            'uobxsqart03',
            'uobxsqart04',
            'uobxcqart07',
            'uobxcqart08',
            'uobxcqart09',
            'uobxcqart10',
            'uobxsqart05',
            'uobxsqart06',
            'uobxcqart11',
            'uobxcqart12',
            'uobxcqart13',
            'uobxcqart14',
            'uobxcqart15',
            'uobxcqart16',
            'uobxcqart17',
            'uobxcqart18',
            'uobxcqart19',
            'uobxcqart20',
            'uobxcqart21',
          ],
          userDataFileName: 'install-ssm-agent-qe-rt.sh',
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
            disableApiStop: false,
            userDataReplaceOnChange: false,
            tags: {
              'volume-reduction-target': 'false',
              'volume-reduction-restore-target': 'false',
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            'uobxcqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
      },
      dbConfigs: [
        {
          id: 'qe-OracleInstance'.toLowerCase(),
          route53Name: 'uobxqeoracle01.qe',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 1000,
          instanceClass: 'db.m6i.2xlarge',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'uob-oracle-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
              {
                name: 'audit_trail',
                value: 'DB',
                applyMethod: 'pending-reboot',
              },
            ],
          },
          createBucket: false,
        },
        {
          id: 'qe-Oracle-Instance-qe2'.toLowerCase(),
          route53Name: 'uobxsqeoracle02.qe',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 1000,
          instanceClass: 'db.m6i.2xlarge',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'uob-oracle-se2-19-qe2',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
        },
        {
          id: 'qe-CoreQEOracle2'.toLowerCase(),
          route53Name: 'uobxqeoracle02.qe',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'coreqe2-oracle-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '3000',
              },
            ],
          },
          createBucket: false,
        },
        {
          id: 'qe-CoreQEOracle3'.toLowerCase(),
          route53Name: 'uobxqeoracle03.qe',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 350,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'coreqe3-oracle-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '3000',
              },
            ],
          },
          createBucket: false,
        },
        {
          id: 'qe-CustomQeOracle1'.toLowerCase(),
          route53Name: 'uobxsqeoracle01.qe',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'customqe1-oracle-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
        },
      ],
    },
    ewb1: {
      properties: {
        constructNamePattern: '',
        fiName: 'ewb1',
        clusterName: 'ewb1-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    ewb2: {
      properties: {
        constructNamePattern: '',
        fiName: 'ewb2',
        clusterName: 'ewb2-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    san1: {
      properties: {
        constructNamePattern: '',
        fiName: 'san1',
        clusterName: 'san1-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq01: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq01',
        clusterName: 'uq01-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{
            count: 2,
            hostnamePattern:
              'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          },
          amiPatternOverride: [
            'ami-0f2b7946a3f3f9b8f',
            'ami-04687fe9e0d5fbcb3',
          ],
        },
        lbs: {
          count: 1,
          ami: 'ami-05fd00f74649c498c',
          instanceType: 't3.2xlarge',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 250,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            tags: {
              'volume-reduction-target': 'false',
              'volume-reduction-restore-target': 'false',
            },
            rootBlockDevice: {
              volumeSize: 300,
              volumeType: 'gp3',
              deleteOnTermination: true,
              encrypted: true,
            },
          },
          tierIngresses: [
            {
              description: 'Allow SSH from Tools',
              fromPort: 22,
              toPort: 22,
              protocol: 'tcp',
              cidrBlocks: [
                `${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`,
              ],
            },
            {
              description: 'Allow DMS from Tools',
              fromPort: 25010,
              toPort: 25011,
              protocol: 'tcp',
              cidrBlocks: Object.values(
                DfAccounts.getToolsAccountDef().vpcCidrs.main
              ),
            },
          ],
          templateEnabled: false,
          hostnamePattern:
            'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        mq: {
          ...this.qeMqConfiguration,
          ...{
            ami: 'ami-0c2b85a5b12b60add',
            hostnamePattern:
              'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          },
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{
            count: 3,
            hostnamePattern:
              'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          },
          amiPatternOverride: [
            'ami-0d92989f259ffbd41',
            'ami-0a61c5fc17b018081',
            'ami-06a6aa369e2ff8707',
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ...{
            count: 2,
            hostnamePattern:
              'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          },
          amiPatternOverride: [
            'ami-0850ddb852fe0d4fe',
            'ami-00a69b4dea1dc683d',
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ...{
            hostnamePattern:
              'uobxqe${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          },
          ami: 'ami-06f07d9a2abb4caf4',
        },
      },
    },
    uq02: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq02',
        clusterName: 'uq02-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{
            count: 2,
          },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 3 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq03: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq03',
        clusterName: 'uq03-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 3 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq04: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq04',
        clusterName: 'uq04-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq05: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq05',
        clusterName: 'uq05-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq06: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq06',
        clusterName: 'uq06-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq07: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq07',
        clusterName: 'uq07-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq08: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq08',
        clusterName: 'uq08-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq09: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq09',
        clusterName: 'uq09-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq10: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq10',
        clusterName: 'uq10-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq11: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq11',
        clusterName: 'uq11-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq12: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq12',
        clusterName: 'uq12-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED_ENCRYPTED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED_ENCRYPTED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED_ENCRYPTED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED_ENCRYPTED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED_ENCRYPTED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq13: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq13',
        clusterName: 'uq13-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq14: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq14',
        clusterName: 'uq14-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq15: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq15',
        clusterName: 'uq15-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq16: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq16',
        clusterName: 'uq16-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq17: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq17',
        clusterName: 'uq17-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq18: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq18',
        clusterName: 'uq18-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq19: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq19',
        clusterName: 'uq19-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq20: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq20',
        clusterName: 'uq20-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq21: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq21',
        clusterName: 'uq21-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    bdb1: {
      properties: {
        constructNamePattern: '',
        fiName: 'bdb1',
        clusterName: 'bdb1-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    bdb2: {
      properties: {
        constructNamePattern: '',
        fiName: 'bdb2',
        clusterName: 'bdb2-cluster',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'bdb2',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'bdb2-qe-allow-list',
            },
            albProps: {
              targetPort: 443,
              targetProtocol: 'HTTPS',
              healthCheck: {
                port: '443',
                protocol: 'HTTPS',
                path: '/',
              },
            },
            bucketName: 'bdb2-qe-public-logging',
            deploySeparateWafStack: true,
          },
        ],
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    bdb3: {
      properties: {
        constructNamePattern: '',
        fiName: 'bdb3',
        clusterName: 'bdb3-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    bdb7: {
      properties: {
        constructNamePattern: '',
        fiName: 'bdb7',
        clusterName: 'bdb7-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    td01: {
      properties: {
        constructNamePattern: '',
        fiName: 'td01',
        clusterName: 'td01-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    td06: {
      properties: {
        constructNamePattern: '',
        fiName: 'td06',
        clusterName: 'td06-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    td07: {
      properties: {
        constructNamePattern: '',
        fiName: 'td07',
        clusterName: 'td07-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          count: 2,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    umb01: {
      properties: {
        constructNamePattern: '',
        fiName: 'umb01',
        clusterName: 'umb01-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{
            tierIngresses: [
              {
                description: 'Allow all for one week PTSD-242',
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: [DfAccounts.getQeAccountDef().vpcCidrs.main.legacy],
              },
            ],
          },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    umb05: {
      properties: {
        constructNamePattern: '',
        fiName: 'umb05',
        clusterName: 'umb05-cluster',
      },
      tiers: {
        app: {
          ...this.qeAppConfiguration,
          ...{ count: 2 },
          tierIngresses: [
            {
              description: 'Temp rule to allow all traffic from within VPC',
              fromPort: 0,
              toPort: 0,
              protocol: '-1',
              cidrBlocks: [DfAccounts.getQeAccountDef().vpcCidrs.main.legacy],
            },
          ],
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...this.qeMqConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...this.qeMsiConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...this.qeRptConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...this.qeWebConfiguration,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    muob1: {
      properties: {
        constructNamePattern: '',
        fiName: 'muob1',
        clusterName: 'muob1-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    muob2: {
      properties: {
        constructNamePattern: '',
        fiName: 'muob2',
        clusterName: 'muob2-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    muob3: {
      properties: {
        constructNamePattern: '',
        fiName: 'muob3',
        clusterName: 'muob3-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    zion3: {
      properties: {
        constructNamePattern: '',
        fiName: 'zion3',
        clusterName: 'zion3-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    zion4: {
      properties: {
        constructNamePattern: '',
        fiName: 'zion4',
        clusterName: 'zion4-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },

    // PenTest Cluster
    uq22: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq22',
        clusterName: 'uq22-cluster',
      },
      tiers: Object.entries({
        app: {
          ...QE_APP_REDUCED,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        msi: {
          ...QE_MSI_REDUCED,
          ...{ count: 2 },
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rt: {
          ...QE_RT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      }).reduce((acc, [key, value]) => {
        acc[key] = { ...value };
        acc[key].volumes = value.volumes.map((vol) => {
          return {
            ...vol,
            ...{
              encrypted: true,
              volumeType: 'gp3',
            },
          };
        });

        return acc;
      }, {}),
    },

    uq23: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq23',
        clusterName: 'uq23-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq24: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq24',
        clusterName: 'uq24-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    uq25: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq25',
        clusterName: 'uq25-cluster',
      },
      tiers: {
        app: QE_APP_REDUCED,
        mq: QE_MQ_REDUCED,
        msi: QE_MSI_REDUCED,
        rpt: QE_RPT_REDUCED,
        web: QE_WEB_REDUCED,
        rt: QE_RT_REDUCED,
      },
    },
    uq26: {
      properties: {
        constructNamePattern: '',
        fiName: 'uq26',
        clusterName: 'uq26-cluster',
      },
      tiers: {
        app: QE_APP_REDUCED,
        mq: QE_MQ_REDUCED,
        msi: QE_MSI_REDUCED,
        rpt: QE_RPT_REDUCED,
        web: QE_WEB_REDUCED,
        rt: QE_RT_REDUCED,
      },
    },
    bdb4: {
      properties: {
        constructNamePattern: '',
        fiName: 'bdb4',
        clusterName: 'bdb4-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    snt02: {
      properties: {
        constructNamePattern: '',
        fiName: 'snt02',
        clusterName: 'snt02-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    snt03: {
      properties: {
        constructNamePattern: '',
        fiName: 'snt03',
        clusterName: 'snt03-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    wf07: {
      properties: {
        constructNamePattern: '',
        fiName: 'wf07',
        clusterName: 'wf07-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        mq: {
          ...QE_MQ_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
        web: {
          ...QE_WEB_REDUCED,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        },
      },
    },
    ssb01: {
      properties: {
        constructNamePattern: '',
        fiName: 'ssb01',
        clusterName: 'ssb01-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        mq: {
          ...QE_MQ_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        web: {
          ...QE_WEB_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        msi: {
          ...QE_MSI_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
      },
    },
    csi01: {
      properties: {
        constructNamePattern: '',
        fiName: 'csi01',
        clusterName: 'csi01-cluster',
        useDbConfigs: true,
      },
      tiers: {
        app: QE_APP_REDUCED,
        mq: QE_MQ_REDUCED,
        rpt: QE_RPT_REDUCED,
        web: QE_WEB_REDUCED,
        msi: QE_MSI_REDUCED,
      },
      dbConfigs: [
        {
          id: 'csi01'.toLowerCase(),
          route53Name: 'uobxsqeoracle03.qe',
          engine: 'oracle-se2',
          engineVersion: '19',
          storageType: 'gp3',
          allocatedStorage: 250,
          instanceClass: 'db.t3.medium',
          performanceInsightsEnabled: true,
          parameterGroupConfig: {
            name: 'csi01-oracle-se2-19',
            family: 'oracle-se2-19',
            parameter: [
              {
                name: 'open_cursors',
                value: '2000',
              },
            ],
          },
          createBucket: false,
        },
      ],
    },
    csi02: {
      properties: {
        constructNamePattern: '',
        fiName: 'csi02',
        clusterName: 'csi02-cluster',
      },
      tiers: {
        app: QE_APP_REDUCED,
        mq: QE_MQ_REDUCED,
        msi: QE_MSI_REDUCED,
        rpt: QE_RPT_REDUCED,
        web: QE_WEB_REDUCED,
      },
    },
    csiCit02: {
      properties: {
        constructNamePattern: '',
        fiName: 'csi-cit02',
        clusterName: 'csi-cit02-cluster',
      },
      tiers: {
        web: QE_WEB_REDUCED,
        app: { ...QE_APP_REDUCED, ...{ count: 2 } },
        rpt: { ...QE_RPT_REDUCED, ...{ count: 2 } },
        mq: QE_MQ_REDUCED,
        msi: { ...QE_MSI_REDUCED, ...{ count: 2 } },
      },
    },
    sre01: {
      properties: {
        constructNamePattern: '',
        fiName: 'sre01',
        clusterName: 'sre01-cluster',
      },
      tiers: {
        app: QE_APP_REDUCED,
        mq: QE_MQ_REDUCED,
        msi: QE_MSI_REDUCED,
        rpt: QE_RPT_REDUCED,
        web: QE_WEB_REDUCED,
      },
    },
    ssb02: {
      properties: {
        constructNamePattern: '',
        fiName: 'ssb02',
        clusterName: 'ssb02-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        mq: {
          ...QE_MQ_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        web: {
          ...QE_WEB_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        msi: {
          ...QE_MSI_REDUCED,
          ...{
            count: 3,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
      },
    },
    td02: {
      properties: {
        constructNamePattern: '',
        fiName: 'td02',
        clusterName: 'td02-cluster',
      },
      tiers: {
        app: {
          ...QE_APP_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        mq: {
          ...QE_MQ_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        msi: {
          ...QE_MSI_REDUCED,
          ...{
            count: 2,
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        rpt: {
          ...QE_RPT_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
        web: {
          ...QE_WEB_REDUCED,
          ...{
            ami: Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_LATEST
            ],
          },
        },
      },
    },
  };
}
