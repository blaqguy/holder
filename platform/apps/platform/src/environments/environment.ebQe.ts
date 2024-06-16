import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfWindowsS1AgentStack,
  EbHelperStack,
  EbStack,
  RemoteStack,
  MicrosoftOutboundResolver,
} from '@dragonfly/stacks';
import { App, Fn, TerraformStack } from 'cdktf';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import ToolsEnvironment from './environment.tools';
import path from 'path';
import LogArchiveEnvironment from './environment.logArchive';
import { NetworkableEnvironment } from './networkableEnvironment';
import NonProdSharedNetworkEnvironment from './environment.nonProdSharedNetwork';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';

/** Eb Qe Env */
export default class EbQeEnvironment extends NetworkableEnvironment {
  private static instance: EbQeEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );
    this.createResolver();
    this.createEbStack();

    // Pod Clusters
    const pod01Cluster = this.createPodEbStacks({
      clusterStackId: 'EbPod01Stack',
      clusterName: 'pod01',
      skipDatabase: true,
      skipEfs: true,
      skipMqTier: false,
    });

    const pod02Cluster = this.createPodEbStacks({
      clusterStackId: 'EbPod02Stack',
      clusterName: 'pod02',
      skipDatabase: true,
      skipEfs: true,
      skipMqTier: true,
    });

    const pod03Cluster = this.createPodEbStacks({
      clusterStackId: 'EbPod03Stack',
      clusterName: 'pod03',
      skipDatabase: true,
      skipEfs: true,
      skipMqTier: true,
    });

    const pod04Cluster = this.createPodEbStacks({
      clusterStackId: 'EbPod04Stack',
      clusterName: 'pod04',
      skipDatabase: true,
      skipEfs: true,
      skipMqTier: true,
    });

    new EbHelperStack({
      stackName: 'helper',
      stackConfig: this.stackConfig,
      deploymentRegionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      sharedAlbConfig: {
        vpc: this.vpcPrimary.vpcConstruct,
        certificateDomainConfig: {
          domainName: 'ebpod01v4.qe.dragonflyft.com',
          port: 32004,
          protocol: 'HTTPS',
          instancesForTargetGroup:
            pod01Cluster.getPrimaryInstancesByTier('web'),
          healthCheckConfig: {
            path: '/wcmfd/images/blank.png',
          },
        },
        subjectAlternativeNamesToPortsMap: [
          {
            domainName: 'ebpod01v5.qe.dragonflyft.com',
            port: 32005,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod01Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
          {
            domainName: 'ebpod02v4.qe.dragonflyft.com',
            port: 32004,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod02Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
          {
            domainName: 'ebpod02v5.qe.dragonflyft.com',
            port: 32005,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod02Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
          {
            domainName: 'ebpod03v4.qe.dragonflyft.com',
            port: 32004,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod03Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
          {
            domainName: 'ebpod03v5.qe.dragonflyft.com',
            port: 32005,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod03Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
          {
            domainName: 'ebpod04v4.qe.dragonflyft.com',
            port: 32004,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod04Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
          {
            domainName: 'ebpod04v5.qe.dragonflyft.com',
            port: 32005,
            protocol: 'HTTPS',
            instancesForTargetGroup:
              pod04Cluster.getPrimaryInstancesByTier('web'),
            healthCheckConfig: {
              path: '/wcmfd/images/blank.png',
            },
          },
        ],
      },
    });

    new DfBackupResourcesStack('backup-resources', this.stackConfig, {
      enableColdStorage: false,
    });

    new DfInventoryStack(
      'inventory',
      this.stackConfig,
      LogArchiveEnvironment.getInstance(
        this.app
      ).crossAccountSsmInventoryBucketStack
    );

    new DfWindowsS1AgentStack('windows-s1-agent', this.stackConfig);

    new DfWindowsNetworkSensorAgentAssociationStack(
      this.stackConfig,
      'network-sensor-windows-agent-association',
      {
        regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      }
    );

    new DfAnsibleStateManagerAssociation({
      stackName: 'ansible-state-manager-association',
      stackConfig: this.stackConfig,
      disableNewRelic: 'false',
    });

    return this.handler;
  }

  /**
   *
   */
  private createResolver(): void {
    new MicrosoftOutboundResolver({
      stackId: 'microsoft-ad-outbound-resolver',
      stackConfig: this.stackConfig,
      deployToTools: false,
      dfMicrosoftActiveDirectoryBackendConfig:
        ToolsEnvironment.dfMicrosoftActiveDirectoryStackConfig(),
      resolverVpcs: {
        primaryVpc: this.vpcPrimary.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
      },
      accountProviderConfig: ToolsEnvironment.accountProviderConfig,
      targetAccountId: EbQeEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Creates the Eb Application
   */
  private createEbStack() {
    /*
     ** EB Application
     */
    const ebStack = new EbStack('EbStack', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      clusterOptions: {
        idPrefix: 'eb',
        ansibleManaged: 'false',
      },
      dbOptions: {
        idPrefix: 'eb',
        engine: 'oracle-se2',
        storageSize: 250,
      },
      efsOptions: {
        skipEfs: false,
      },
      networkOptions: {
        networkConfig: {
          recoveryBackendProps: null,
          backendProps: NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).nonProdSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProviderConfig:
            Utils.getNonProdSharedNetworkAccountProviderConfig(),
        },
        route53Config: {
          backedProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          recoveryBackedProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
          route53ProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        },
      },
    });

    ebStack.createEbTier({
      tier: 'util',
      tierOptions: {
        count: 1,
        tierPorts: {
          tcp: Constants.EB_PORTS_UTIL_TCP,
          udp: Constants.EB_PORTS_UTIL_UDP,
        },
        tierIngresses: [
          {
            description: 'Temp rule to allow all traffic from within VPC',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [DfAccounts.getEbQeAccountDef().vpcCidrs.main.primary],
          },
        ],
      },

      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_UTIL_GOLDEN_IMAGE
          ],
          instanceType: 't3.medium',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'eb-util-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'eb-util' },
        },
        options: {
          volumes: [
            {
              volumeName: 'eb-app-support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
        },
      },
    });

    ebStack.createEbTier({
      tier: 'app',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_APP_TCP,
          udp: Constants.EB_PORTS_APP_UDP,
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_APP_GOLDEN_IMAGE
          ],
          instanceType: 't3.medium',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'eb-app-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'eb-app' },
        },
        options: {
          volumes: [
            {
              volumeName: 'eb-app-support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
        },
      },
    });

    ebStack.createEbTier({
      tier: 'web',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_WEB_TCP,
          udp: Constants.EB_PORTS_WEB_UDP,
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_WEB_GOLDEN_IMAGE
          ],
          instanceType: 't3.medium',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'eb-web-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'eb-web' },
        },
        options: {
          volumes: [
            {
              volumeName: 'eb-app-support',
              volumeSize: 20,
              deviceName: '/dev/sdg',
            },
          ],
        },
      },
    });

    ebStack.createEbTier({
      tier: 'wind',
      tierOptions: {
        count: 1,
        tierPorts: {
          tcp: Constants.EB_PORTS_WIND_TCP,
          udp: Constants.EB_PORTS_WIND_UDP,
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_WIND_GOLDEN_IMAGE
          ],
          instanceType: 't3.medium',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'eb-wind-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.ps1`
          ),
        },
        options: {
          volumes: [
            {
              volumeName: 'eb-app-support',
              volumeSize: 50,
              deviceName: '/dev/sdg',
            },
          ],
        },
      },
    });

    ebStack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: 'oracle.eb.qe',
      envSubdomain: EbQeEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * @return {EbStack}
   */
  private createPodEbStacks({
    clusterStackId,
    clusterName,
    skipDatabase,
    skipEfs,
    skipMqTier,
  }: {
    clusterStackId: string;
    clusterName: string;
    skipDatabase: boolean;
    skipEfs: boolean;
    skipMqTier?: boolean;
  }) {
    const podEbStack = this.createEbCoreStack({
      clusterStackId,
      clusterName,
      skipDatabase,
      skipEfs,
    });

    podEbStack.createEbTier({
      tier: 'app',
      tierOptions: {
        count: 3,
        tierPorts: {
          tcp: Constants.EB_PORTS_APP_TCP,
          udp: Constants.EB_PORTS_APP_UDP,
        },
        tierIngresses: [
          {
            description: 'Temp rule to allow all traffic from within VPC',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [DfAccounts.getEbQeAccountDef().vpcCidrs.main.primary],
          },
        ],
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_APP_01_GOLDEN_IMAGE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_APP_02_GOLDEN_IMAGE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_APP_03_GOLDEN_IMAGE
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.xlarge',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: `${clusterName}-eb-app-root-block-device` },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': `${clusterName}-app` },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 120,
              deviceName: '/dev/sdj',
            },
            {
              volumeName: 'storage',
              volumeSize: 30,
              deviceName: '/dev/sdh',
            },
            {
              volumeName: 'opt',
              volumeSize: 100,
              deviceName: '/dev/sdi',
            },
          ],
        },
      },
    });

    if (!skipMqTier) {
      podEbStack.createEbTier({
        tier: 'mq',
        tierOptions: {
          count: 2,
          tierPorts: {
            tcp: Constants.EB_PORTS_MQ_TCP,
            udp: [],
          },
          amiOverride: [
            Constants.MANAGED_AMI_IDS.DFPRIMARY[
              Constants.AMIS.EB_MQ_01_GOLDEN_IMAGE
            ],
            Constants.MANAGED_AMI_IDS.DFPRIMARY[
              Constants.AMIS.EB_MQ_02_GOLDEN_IMAGE
            ],
          ],
        },
        instanceProps: {
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            instanceType: 't3.xlarge',
            rootBlockDevice: {
              volumeSize: 150,
              volumeType: 'gp3',
              tags: { Name: `${clusterName}-eb-mq-root-block-device` },
              encrypted: true,
            },
            userData: Fn.file(
              `${path.resolve(
                __dirname,
                'buildAssets/scripts'
              )}/install-ssm-agent.sh`
            ),
            tags: { 'config-management-playbook': `${clusterName}-mq` },
          },
          options: {
            volumes: [
              {
                volumeName: 'apps',
                volumeSize: 50,
                deviceName: '/dev/sdg',
              },
              {
                volumeName: 'data',
                volumeSize: 50,
                deviceName: '/dev/sdh',
              },
              {
                volumeName: 'log',
                volumeSize: 100,
                deviceName: '/dev/sdi',
              },
            ],
          },
        },
      });
    }

    podEbStack.createEbTier({
      tier: 'web',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_WEB_TCP,
          udp: Constants.EB_PORTS_WEB_UDP,
        },
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_WEB_01_GOLDEN_IMAGE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_WEB_02_GOLDEN_IMAGE
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.medium',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: `${clusterName}-eb-web-root-block-device` },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': `${clusterName}-web` },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 190,
              deviceName: '/dev/sdj', // sdg already in use by AMI
            },
            {
              volumeName: 'storage',
              volumeSize: 30,
              deviceName: '/dev/sdh',
            },
            {
              volumeName: 'opt',
              volumeSize: 25,
              deviceName: '/dev/sdi',
            },
          ],
        },
      },
    });

    podEbStack.createEbTier({
      tier: 'util',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_UTIL_TCP,
          udp: Constants.EB_PORTS_UTIL_UDP,
        },
        tierIngresses: [
          {
            description: 'Temp rule to allow all traffic from within VPC',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [DfAccounts.getEbQeAccountDef().vpcCidrs.main.primary],
          },
        ],
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_UTIL_01_GOLDEN_IMAGE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_UTIL_02_GOLDEN_IMAGE
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 150,
            volumeType: 'gp3',
            tags: { Name: `${clusterName}-eb-util-root-block-device` },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': `${clusterName}-util` },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 170,
              deviceName: '/dev/sdj', // sdg already in use by AMI
            },
            {
              volumeName: 'storage',
              volumeSize: 30,
              deviceName: '/dev/sdh',
            },
            {
              volumeName: 'opt',
              volumeSize: 40,
              deviceName: '/dev/sdi',
            },
          ],
        },
      },
    });

    podEbStack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: null,
      envSubdomain: EbQeEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const webAlbStackShell = new RemoteStack(
      `${clusterName}-web-alb-stack-shell`,
      this.stackConfig
    );

    new DfAlb(
      `${clusterName}-web-alb`,
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: podEbStack.getPrimaryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `${clusterName}.${EbQeEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: webAlbStackShell,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 32001,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/wcmfd/images/blank.png',
            healthCheckPort: '32001',
            healthCheckProtocol: 'HTTPS',
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    return podEbStack;
  }

  /**
   * Creates the Eb Core Stack
   * @return {EbStack}
   */
  private createEbCoreStack({
    clusterStackId,
    clusterName,
    skipDatabase,
    skipEfs,
  }: {
    clusterStackId: string;
    clusterName: string;
    skipDatabase: boolean;
    skipEfs: boolean;
  }): EbStack {
    const ebStack = new EbStack(clusterStackId, this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      clusterOptions: {
        idPrefix: clusterName,
      },
      skipDatabase: skipDatabase,
      efsOptions: {
        skipEfs: skipEfs,
      },
      networkOptions: {
        networkConfig: {
          recoveryBackendProps: null,
          backendProps: NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).nonProdSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProviderConfig:
            Utils.getNonProdSharedNetworkAccountProviderConfig(),
        },
        route53Config: {
          backedProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          recoveryBackedProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
          route53ProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        },
      },
    });
    return ebStack;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'ebQe';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
          export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
          $(aws sts assume-role \
          --role-arn arn:aws:iam::${EbQeEnvironment.ACCOUNT_ID}:role/${EbQeEnvironment.PROVIDER_ROLE_NAME} \
          --role-session-name DockerPush \
          --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
          --output text)) 
        `;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'qe';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_EB_QE;
  }

  /**
   *
   * Singleton constructor for the EbQeEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {ebQeEnvironment}
   *
   */
  public static getInstance(app: App): EbQeEnvironment {
    if (!EbQeEnvironment.instance) {
      EbQeEnvironment.instance = new EbQeEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getEbQeAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getEbQeAccountDef().vpcCidrs.main.recovery,
        envName: EbQeEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'eb-qe',
        recoverySpokeVpcStackPrefix: 'eb',
      });
      EbQeEnvironment.instance.deployStacks();
    }

    return EbQeEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
