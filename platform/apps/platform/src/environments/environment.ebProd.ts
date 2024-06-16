import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfVantaIntegrationStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfWindowsS1AgentStack,
  EbStack,
  RemoteStack,
  MicrosoftOutboundResolver,
  DfWafStack,
} from '@dragonfly/stacks';
import { App, Fn, TerraformStack } from 'cdktf';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import ToolsEnvironment from './environment.tools';
import path from 'path';
import LogArchiveEnvironment from './environment.logArchive';
import { NetworkableEnvironment } from './networkableEnvironment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { DfPublicIngressConstruct } from '@dragonfly/constructs';
import { frbMaintenanceRedirectFunction } from '../../../../cloudfrontFunctions/frbMaintenanceRedirect';

/** Eb Prod Env */
export default class EbProdEnvironment extends NetworkableEnvironment {
  private static instance: EbProdEnvironment;

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
    this.createSharedResources();
    this.createPeb07();
    this.vantaIntegration();

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
      targetAccountId: EbProdEnvironment.ACCOUNT_ID,
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
      dbOptions: {
        idPrefix: 'eb-prod',
        instanceClass: 'db.m6i.8xlarge',
        storageSize: 2250,
        engine: 'oracle-ee',
        sopsDbProperty: 'eb-prod',
        multiRegionKey: true,
        kmsNameOverride: 'eb-prod-oracle-oracle-key-multi-regional',
        deployMultiAz: true,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        parameters: [
          {
            name: 'open_cursors',
            value: '7000',
          },
          {
            name: 'streams_pool_size',
            value: '2147483648',
          },
          {
            name: 'job_queue_processes',
            value: '800',
          },
          {
            name: 'db_recovery_file_dest_size',
            value: '107374182400',
          },
        ],
        timezone: 'America/New_York',
        optionGroupName: 'eb-prod-est',
      },
      clusterOptions: {
        idPrefix: 'eb',
      },
      efsOptions: {
        replicationEnabled: true,
        skipEfs: false,
      },
      networkOptions: {
        networkConfig: {
          recoveryBackendProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
          backendProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
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
      activeRegion: 'default',
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
            description: 'TEMP - Allow all traffic from Shared Prod',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [
              DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
            ],
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
        tierIngresses: [
          {
            description: 'Temp rule to allow all traffic from within VPC',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [
              DfAccounts.getEbProdAccountDef().vpcCidrs.main.primary,
            ],
          },
        ],
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
      dbDnsName: 'oracle.prod',
      envSubdomain: EbProdEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * Creates shared EB resources
   */
  private createSharedResources() {
    const sharedStack = new EbStack('shared-resources', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbOptions: {
        idPrefix: 'eb-prod-import-test',
        instanceClass: 'db.m6i.8xlarge',
        storageSize: 1750,
        engine: 'oracle-ee',
        sopsDbProperty: 'eb-prod',
        parameters: [
          {
            name: 'open_cursors',
            value: '7000',
          },
          {
            name: 'streams_pool_size',
            value: '2147483648',
          },
          {
            name: 'job_queue_processes',
            value: '800',
          },
        ],
        timezone: 'America/New_York',
        optionGroupName: 'eb-prod-import-test',
      },
      clusterOptions: {
        idPrefix: 'shared',
      },
      efsOptions: {
        skipEfs: true,
      },
      networkOptions: {
        networkConfig: {
          recoveryBackendProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
          backendProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
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

    sharedStack.createEbTier({
      tier: 'admin',
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
            Constants.AMIS.EB_WIND_01_GOLDEN_IMAGE
          ],
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'shared-admin-root-block-device' },
            encrypted: true,
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
              volumeName: 'admin-data',
              volumeSize: 200,
              deviceName: '/dev/sdh',
              encrypted: true,
            },
          ],
        },
      },
    });

    sharedStack.createEbTier({
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
            tags: { Name: 'shared-mq-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'shared-mq' },
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

    sharedStack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: null,
      envSubdomain: EbProdEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * Creates PEB07
   */
  private createPeb07() {
    const peb07Stack = new EbStack('peb07', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: true,
      clusterOptions: {
        idPrefix: 'peb07',
      },
      efsOptions: {
        skipEfs: true,
      },
      networkOptions: {
        networkConfig: {
          recoveryBackendProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
          backendProps: SharedNetworkEnvironment.getInstance(
            this.app
          ).prodSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
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
      activeRegion: 'default',
    });

    peb07Stack.createEbTier({
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
            cidrBlocks: [
              DfAccounts.getEbProdAccountDef().vpcCidrs.main.primary,
            ],
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
        recoveryAmiIds: [
          'ami-09d045a8cc659a18c',
          'ami-0cc1a5878d07ecd01',
          'ami-05889b4f5c3801a72',
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.2xlarge',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'peb07-app-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'peb07-app' },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 120,
              deviceName: '/dev/sdj', // sdg already in use by AMI
              encrypted: true,
            },
            {
              volumeName: 'storage',
              volumeSize: 30,
              deviceName: '/dev/sdh',
              encrypted: true,
            },
            {
              volumeName: 'opt',
              volumeSize: 100,
              deviceName: '/dev/sdi',
              encrypted: true,
            },
          ],
        },
      },
    });

    peb07Stack.createEbTier({
      tier: 'util',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_UTIL_TCP,
          udp: Constants.EB_PORTS_UTIL_UDP,
        },
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_UTIL_01_GOLDEN_IMAGE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_UTIL_02_GOLDEN_IMAGE
          ],
        ],
        recoveryAmiIds: ['ami-0428b889a34332e00', 'ami-05ec9f89801269dbc'],
        tierIngresses: [
          {
            description: 'TEMP - Allow all traffic from Shared Prod',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [
              DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
              DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
            ],
          },
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.xlarge',
          rootBlockDevice: {
            volumeSize: 150,
            volumeType: 'gp3',
            tags: { Name: 'peb07-util-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'peb07-util' },
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

    peb07Stack.createEbTier({
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
        recoveryAmiIds: ['ami-0f5a63f9b29c0a52c', 'ami-016240183453bbc7c'],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.medium',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'peb07-web-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'peb07-web' },
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

    peb07Stack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: null,
      envSubdomain: EbProdEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const webAlbStackShell = new RemoteStack(
      'peb07-web-alb-stack-shell',
      this.stackConfig
    );

    new DfAlb(
      'peb07-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: peb07Stack.getPrimaryInstancesByTier('web'),
        recoveryInstancesForTargetGroup:
          peb07Stack.getRecoveryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `frb.${EbProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: webAlbStackShell,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 32001,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/wcmfd/images/blank.png',
            healthCheckPort: '32001',
            healthCheckProtocol: 'HTTPS',
            healthCheckInterval: 5,
            healthCheckTimeout: 3,
            healthCheckUnhealthyThreshold: 2,
            healthCheckHealthyThreshold: 2,
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
        activeRegion: peb07Stack.getActiveRegion(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfPublicIngressConstruct(
      peb07Stack,
      `frb-ebProd-public-ingress`,
      null,
      {
        providers: {
          constructProvider: peb07Stack.getProviderForRegion(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProvider: peb07Stack.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getSharedNetworkAccountProviderConfig(
              peb07Stack.isInPlatformSandboxEnvironments()
            ),
          }),
          masterProvider: peb07Stack.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getMasterAccountProviderConfig(),
          }),
          route53Provider: peb07Stack.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getSharedNetworkAccountProviderConfig(),
          }),
          recoveryProvider: peb07Stack.getProviderForRegion(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
        },
        instancesForTargetGroup: peb07Stack.getPrimaryInstancesByTier('web'),
        recoveryInstancesForTargetGroup:
          peb07Stack.getRecoveryInstancesByTier('web'),
        certDomainName: `frb.${EbProdEnvironment.ENVIRONMENT_SUBDOMAIN}.dragonflyft.com`,
        r53RecordName: `frb.${EbProdEnvironment.ENVIRONMENT_SUBDOMAIN}.dragonflyft.com`,
        albName: `frb-${EbProdEnvironment.ENVIRONMENT_SUBDOMAIN}-public-ALB`,
        networkBackendProps: SharedNetworkEnvironment.getInstance(
          this.app
        ).prodSharedNetworkS3BackendProps(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        recoveryNetworkBackendProps: SharedNetworkEnvironment.getInstance(
          this.app
        ).prodSharedNetworkS3BackendProps(
          Constants.AWS_REGION_ALIASES.DF_RECOVERY
        ),
        wafId: new DfWafStack(
          `frb-${EbProdEnvironment.ENVIRONMENT_SUBDOMAIN}-WAF`,
          peb07Stack.stackConfig,
          {
            uriLists: [
              {
                uriMatch: 'wcmfd/wcmpw/SystemLogin',
                listName: 'frbSystemLoginAllow',
                allowList: Constants.FRB_SHORT_WHITELIST,
              },
            ],
          }
        ).webAclArn,
        albProps: {
          targetPort: 32001,
          targetProtocol: 'HTTPS',
          healthCheck: {
            port: '32001',
            protocol: 'HTTPS',
            path: '/wcmfd/images/blank.png',
            timeout: 3,
            interval: 5,
            unhealthyThreshold: 2,
            healthyThreshold: 2,
          },
          // Enable for FRB maintenance window
          cloudfrontFunctionConfig: {
            viewerRequestFunctionCode: {
              type: 'viewer-request',
              code: frbMaintenanceRedirectFunction,
              enabled: true,
            },
          },
        },
        bucketNameOverride: `frb-${EbProdEnvironment.ENVIRONMENT_SUBDOMAIN}-public-ingress-logs`,
        activeRegion: peb07Stack.getActiveRegion(),
      },
      false,
      this.stackConfig.accountDefinition
    );
  }

  /**
   * Integrates EB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('EBVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'ebProd';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
            export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
            $(aws sts assume-role \
            --role-arn arn:aws:iam::${EbProdEnvironment.ACCOUNT_ID}:role/${EbProdEnvironment.PROVIDER_ROLE_NAME} \
            --role-session-name DockerPush \
            --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
            --output text)) 
          `;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'prod';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_EB_PROD;
  }

  /**
   *
   * Singleton constructor for the EbProdEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {ebProdEnvironment}
   *
   */
  public static getInstance(app: App): EbProdEnvironment {
    if (!EbProdEnvironment.instance) {
      EbProdEnvironment.instance = new EbProdEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getEbProdAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getEbProdAccountDef().vpcCidrs.main.recovery,
        envName: EbProdEnvironment.ENVIRONMENT_NAME,
        envTier: 'prod',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'eb-prod',
        recoverySpokeVpcStackPrefix: 'eb',
      });
      EbProdEnvironment.instance.deployStacks();
    }

    return EbProdEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
