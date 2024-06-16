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

/** Eb Uat Env */
export default class EbUatEnvironment extends NetworkableEnvironment {
  private static instance: EbUatEnvironment;
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
    this.createEbTeb02Stack();
    this.createEbTeb04Stack();
    this.createSharedResources();
    this.createTeb09();
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
      targetAccountId: EbUatEnvironment.ACCOUNT_ID,
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
        idPrefix: 'eb-uat',
        instanceClass: 'db.m6i.8xlarge',
        storageSize: 600,
        engine: 'oracle-ee',
        sopsDbProperty: 'eb-uat',
        optionGroupName: 'eb-uat-est',
        timezone: 'America/New_York',
      },
      clusterOptions: {
        idPrefix: 'eb',
      },
      efsOptions: {
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
            cidrBlocks: [DfAccounts.getEbUatAccountDef().vpcCidrs.main.primary],
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
      dbDnsName: 'oracle.uat',
      envSubdomain: EbUatEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * Creates the Eb Application
   */
  private createEbTeb04Stack() {
    /*
     ** EB Application
     */
    const ebStack = new EbStack('EbTeb04Stack', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: true,
      clusterOptions: {
        idPrefix: 'teb04',
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

    ebStack.createEbTier({
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
            cidrBlocks: [DfAccounts.getEbUatAccountDef().vpcCidrs.main.primary],
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
          instanceType: 't3.2xlarge',
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
          tags: { 'config-management-playbook': 'teb04-app' },
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

    ebStack.createEbTier({
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
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.xlarge',
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
          tags: { 'config-management-playbook': 'teb04-util' },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 170,
              deviceName: '/dev/sdj',
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

    ebStack.createEbTier({
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
            tags: { Name: 'eb-web-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'teb04-web' },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 190,
              deviceName: '/dev/sdj',
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

    ebStack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: null,
      envSubdomain: EbUatEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const webAlbStackShell = new RemoteStack(
      'teb04-web-alb-stack-shell',
      this.stackConfig
    );

    new DfAlb(
      'teb04-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: ebStack.getPrimaryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `frbtst77.${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
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
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfPublicIngressConstruct(
      ebStack,
      `frbtst77-ebUat-public-ingress`,
      null,
      {
        providers: {
          constructProvider: ebStack.getProviderForRegion(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          networkProvider: ebStack.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getSharedNetworkAccountProviderConfig(
              ebStack.isInPlatformSandboxEnvironments()
            ),
          }),
          masterProvider: ebStack.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getMasterAccountProviderConfig(),
          }),
          route53Provider: ebStack.createAwsProvider({
            supportedRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            forAccount: Utils.getSharedNetworkAccountProviderConfig(),
          }),
          recoveryProvider: ebStack.getProviderForRegion(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
        },
        instancesForTargetGroup: ebStack.getPrimaryInstancesByTier('web'),
        certDomainName: `frbtst77.${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}.dragonflyft.com`,
        r53RecordName: `frbtst77.${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}.dragonflyft.com`,
        albName: `frbtst77-${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}-public-ALB`,
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
          `frbtst77-${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}-WAF`,
          ebStack.stackConfig,
          {
            uriLists: [
              {
                uriMatch: 'wcmfd/wcmpw/SystemLogin',
                listName: 'frbtst77SystemLoginAllow',
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
        },
        bucketNameOverride: `frbtst77-${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}-public-ingress-logs`,
      },
      false,
      this.stackConfig.accountDefinition
    );
  }

  /**
   * Creates the Eb Application
   */
  private createEbTeb02Stack() {
    /*
     ** EB Application
     */
    const ebStack = new EbStack('EbTeb02Stack', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: true,
      clusterOptions: {
        idPrefix: 'teb02',
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

    ebStack.createEbTier({
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
            cidrBlocks: [DfAccounts.getEbUatAccountDef().vpcCidrs.main.primary],
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
            tags: { Name: 'eb-app-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'teb02-app' },
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

    ebStack.createEbTier({
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
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.large',
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
          tags: { 'config-management-playbook': 'teb02-util' },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 170,
              deviceName: '/dev/sdj',
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

    ebStack.createEbTier({
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
            tags: { Name: 'eb-web-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'teb02-web' },
        },
        options: {
          volumes: [
            {
              volumeName: 'apps',
              volumeSize: 190,
              deviceName: '/dev/sdj',
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

    ebStack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: null,
      envSubdomain: EbUatEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const webAlbStackShell = new RemoteStack(
      'teb02-web-alb-stack-shell',
      this.stackConfig
    );

    new DfAlb(
      'teb02-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: ebStack.getPrimaryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `frbtst277.${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: webAlbStackShell,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          vpc: this.vpcPrimary.vpcConstruct,
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
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   * Creates shared EB resources
   */
  private createSharedResources() {
    const sharedStack = new EbStack('shared-resources', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: true,
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
      envSubdomain: EbUatEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * Creates TEB09
   */
  private createTeb09() {
    const teb09Stack = new EbStack('teb09', this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: true,
      clusterOptions: {
        idPrefix: 'teb09',
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

    teb09Stack.createEbTier({
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
            cidrBlocks: [DfAccounts.getEbUatAccountDef().vpcCidrs.main.primary],
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
            tags: { Name: 'teb09-app-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'teb09-app' },
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

    teb09Stack.createEbTier({
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
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 150,
            volumeType: 'gp3',
            tags: { Name: 'teb09-util-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'teb09-util' },
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

    teb09Stack.createEbTier({
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
            tags: { Name: 'teb09-web-root-block-device' },
            encrypted: true,
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'teb09-web' },
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

    teb09Stack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: null,
      envSubdomain: EbUatEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const webAlbStackShell = new RemoteStack(
      'teb09-web-alb-stack-shell',
      this.stackConfig
    );

    new DfAlb(
      'teb09-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: teb09Stack.getPrimaryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `frbtst377.${EbUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
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
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
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
    return 'ebUat';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
          export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
          $(aws sts assume-role \
          --role-arn arn:aws:iam::${EbUatEnvironment.ACCOUNT_ID}:role/${EbUatEnvironment.PROVIDER_ROLE_NAME} \
          --role-session-name DockerPush \
          --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
          --output text)) 
        `;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'uat';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_EB_UAT;
  }

  /**
   *
   * Singleton constructor for the EbUatEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {ebUatEnvironment}
   *
   */
  public static getInstance(app: App): EbUatEnvironment {
    if (!EbUatEnvironment.instance) {
      EbUatEnvironment.instance = new EbUatEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getEbUatAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getEbUatAccountDef().vpcCidrs.main.recovery,
        envName: EbUatEnvironment.ENVIRONMENT_NAME,
        envTier: 'uat',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'eb-uat',
        recoverySpokeVpcStackPrefix: 'eb',
      });
      EbUatEnvironment.instance.deployStacks();
    }

    return EbUatEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
