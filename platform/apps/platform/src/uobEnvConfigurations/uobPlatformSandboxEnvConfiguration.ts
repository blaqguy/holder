import { environment } from '@dragonfly/stacks';
import { Constants } from '@dragonfly/utils';

/**
 * Class defining the uob env configurations
 */
export abstract class UobPlatformSandboxEnvConfiguration {
  public static configuration: environment = {
    modelBank: {
      properties: {
        constructNamePattern: '',
        clusterName: 'model-bank-cluster',
        fiName: 'mod',
        publicIngressPartial: [
          {
            recordProps: {
              recordName: 'mb',
            },
            wafConfig: {
              ipv4WhiteList: [],
              ipv6WhiteList: [],
              listName: 'modelbank-allow-list',
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
            bucketName: 'modelbank-public-cdn-logs',
          },
        ],
      },
      tiers: {
        bld: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 30,
              deviceName: '/dev/sdg',
              encrypted: true,
            },
            {
              volumeName: 'Data',
              volumeSize: 30,
              deviceName: '/dev/sdh',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
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
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 30,
              deviceName: '/dev/sdg',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        lbs: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_LATEST
          ],
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'liquiBase',
              volumeSize: 30,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
          userDataFileName: 'install-ssm-agent.sh',
        },
        sim: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 30,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
        web: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'Support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
          },
          tierIngresses: [],
          templateEnabled: false,
          userDataFileName: 'install-ssm-agent.sh',
          hostnamePattern:
            '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
        },
        app: {
          count: 1,
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'appSupport',
              volumeSize: 30,
              deviceName: '/dev/sdg',
              volumeType: 'gp3',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
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
          instanceType: 't3.small',
          volumes: [
            {
              volumeName: 'Platform',
              volumeSize: 30,
              deviceName: '/dev/sdg',
              volumeType: 'gp3',
              encrypted: true,
            },
            {
              volumeName: 'Platform1',
              volumeSize: 30,
              deviceName: '/dev/sdh',
              volumeType: 'gp3',
              encrypted: true,
            },
          ],
          instanceResourceConfig: {
            disableApiTermination: false,
            disableApiStop: false,
            tags: {
              'backup-policy': 'none',
            },
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
