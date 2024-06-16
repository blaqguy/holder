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
} from '@dragonfly/stacks';
import { App, Fn, TerraformStack } from 'cdktf';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import ToolsEnvironment from './environment.tools';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import path from 'path';
import LogArchiveEnvironment from './environment.logArchive';
import { NetworkableEnvironment } from './networkableEnvironment';
import NonProdSharedNetworkEnvironment from './environment.nonProdSharedNetwork';

/** Eb Cit Env */
export default class EbCitEnvironment extends NetworkableEnvironment {
  private static instance: EbCitEnvironment;

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

    // Create Goldenstack
    this.createGoldenEbStack({
      skipDatabase: false,
      useGoldenAmis: true,
      clusterStackId: 'EbStack',
      clusterId: 'eb',
      webAlbStackId: 'web-alb-stack-shell',
      skipEfs: false,
    });

    // Create stack from empty Rhel images
    this.createNewEbStack({
      skipDatabase: true,
      useGoldenAmis: false,
      clusterStackId: 'EbNewStack',
      clusterId: 'ebNew',
      webAlbStackId: 'ebNew-alb-stack-shell',
      skipEfs: true,
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

    this.vantaIntegration();

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
      targetAccountId: EbCitEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Creates the Eb Application
   *
   * @return {EbStack}
   */
  private createGoldenEbStack({
    skipDatabase,
    clusterStackId,
    clusterId,
    webAlbStackId,
    skipEfs,
  }: {
    skipDatabase?: boolean;
    useGoldenAmis?: boolean;
    clusterStackId: string;
    clusterId: string;
    webAlbStackId: string;
    skipEfs?: boolean;
  }): EbStack {
    /*
     ** EB Application
     */
    const ebStack = new EbStack(clusterStackId, this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: skipDatabase || false,
      dbOptions: {
        idPrefix: 'eb',
        sopsDbProperty: 'eb-cit',
        engine: 'oracle-se2',
        snapshotIdentifier: 'eb-oracle-snapshot-pre-est',
      },
      clusterOptions: {
        idPrefix: clusterId,
      },
      efsOptions: {
        skipEfs: skipEfs || false,
      },
      networkOptions: {
        networkConfig: {
          recoveryBackendProps: NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).nonProdSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
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
      createAdminBucket: true,
      publicIngressConfig: {
        recordName: 'ebweb',
        wafConfig: {
          ipv4WhiteList: [
            '72.83.230.59/32',
            '38.106.143.40/32',
            '49.207.0.0/16',
          ],
          listName: 'eb-cit-allow-list',
        },
        albProps: {
          targetPort: 32001,
          targetProtocol: 'HTTPS',
          healthCheck: {
            path: '/wcmfd/images/blank.png',
            port: '32001',
            protocol: 'HTTPS',
          },
        },
      },
    });

    ebStack.createEbTier({
      tier: 'mq',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_MQ_TCP,
          udp: [],
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'm5.xlarge',
          rootBlockDevice: {
            volumeSize: 150,
            volumeType: 'gp3',
            tags: {
              Name: 'eb-mq-root-block-device',
            },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'golden-mq' },
        },
        options: {},
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
            cidrBlocks: [DfAccounts.getEbCitAccountDef().vpcCidrs.main.primary],
          },
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_UTIL_01_CIT_RESTORE
          ],
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'golden-util' },
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
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_APP_01_CIT_RESTORE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_APP_02_CIT_RESTORE
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'golden-app' },
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
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_WEB_01_CIT_RESTORE
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.EB_WEB_02_CIT_RESTORE
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'golden-web' },
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
            Constants.AMIS.EB_WIND_01_CIT_RESTORE
          ],
          instanceType: 'm5.xlarge',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'eb-wind-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
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
      dbDnsName: 'oracle.cit',
      envSubdomain: EbCitEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const ebWebAlbStackShell = new RemoteStack(webAlbStackId, this.stackConfig);

    new DfAlb(
      `${clusterId}-cit-web-alb`,
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: ebStack.getPrimaryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `${clusterId}web.cit`.toLowerCase(),
          stackShell: ebWebAlbStackShell,
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

    ebStack.enablePublicAccess();
    return ebStack;
  }

  /**
   *
   * @return {EbStack}
   */
  private createNewEbStack({
    skipDatabase,
    clusterStackId,
    clusterId,
    webAlbStackId,
    skipEfs,
  }: {
    skipDatabase?: boolean;
    useGoldenAmis?: boolean;
    clusterStackId: string;
    clusterId: string;
    webAlbStackId: string;
    skipEfs?: boolean;
  }) {
    /*
     ** EB Application
     */
    const ebStack = new EbStack(clusterStackId, this.stackConfig, {
      vpcConstruct: this.vpcPrimary.vpcConstruct,
      recoveryVpcConstruct: this.vpcRecovery.vpcConstruct,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      skipDatabase: skipDatabase || false,
      dbOptions: {
        idPrefix: 'eb',
        snapshotIdentifier: 'eb-cit-seed-encrypted',
        sopsDbProperty: 'eb-cit',
        engine: 'oracle-se2',
      },
      clusterOptions: {
        idPrefix: clusterId,
      },
      efsOptions: {
        skipEfs: skipEfs || false,
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
      createAdminBucket: false,
    });

    ebStack.createEbTier({
      tier: 'mq',
      tierOptions: {
        count: 2,
        tierPorts: {
          tcp: Constants.EB_PORTS_MQ_TCP,
          udp: [],
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'm5.xlarge',
          rootBlockDevice: {
            volumeSize: 150,
            volumeType: 'gp3',
            tags: {
              Name: 'eb-mq-root-block-device',
            },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'rhel-mq' },
        },
        options: {},
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
        tierIngresses: [
          {
            description: 'Temp rule to allow all traffic from within VPC',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [DfAccounts.getEbCitAccountDef().vpcCidrs.main.primary],
          },
        ],
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: 'override',
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'rhel-util' },
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
        count: 3,
        tierPorts: {
          tcp: Constants.EB_PORTS_APP_TCP,
          udp: Constants.EB_PORTS_APP_UDP,
        },
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'rhel-app' },
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
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        ],
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'rhel-web' },
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
            Constants.AMIS.WINDOWS_2022_DEFAULT_V2
          ],
          instanceType: 'm5.xlarge',
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

    ebStack.createEbTier({
      tier: 'ofx-app',
      tierOptions: {
        count: 1,
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        ],
        tierPorts: {
          tcp: Constants.EB_PORTS_OFX_APP_TCP,
          udp: Constants.EB_PORTS_OFX_APP_UDP,
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 'm5.xlarge',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
            tags: { Name: 'eb-ofx-app-root-block-device' },
          },
          userData: Fn.file(
            `${path.resolve(
              __dirname,
              'buildAssets/scripts'
            )}/install-ssm-agent.sh`
          ),
          tags: { 'config-management-playbook': 'rhel-ofx-app' },
        },
        options: {},
      },
    });

    ebStack.createEbTier({
      tier: 'ofx-web',
      tierOptions: {
        count: 1,
        amiOverride: [
          Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
        ],
        tierPorts: {
          tcp: Constants.EB_PORTS_OFX_WEB_TCP,
          udp: Constants.EB_PORTS_OFX_WEB_UDP,
        },
      },
      instanceProps: {
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: 'm5.xlarge',
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
          tags: { 'config-management-playbook': 'rhel-ofx-web' },
        },
        options: {},
      },
    });

    ebStack.createRoute53Attachments({
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      dbDnsName: 'oracle.cit',
      envSubdomain: EbCitEnvironment.ENVIRONMENT_SUBDOMAIN,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const ebWebAlbStackShell = new RemoteStack(webAlbStackId, this.stackConfig);

    new DfAlb(
      `${clusterId}-cit-web-alb`,
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: ebStack.getPrimaryInstancesByTier('web'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: `${clusterId}web.cit`.toLowerCase(),
          stackShell: ebWebAlbStackShell,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          vpc: this.vpcPrimary.vpcConstruct,
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

    return ebStack;
  }

  /**
   * Integrates EB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('vanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'ebCit';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${EbCitEnvironment.ACCOUNT_ID}:role/${EbCitEnvironment.PROVIDER_ROLE_NAME} \
        --role-session-name DockerPush \
        --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
        --output text)) 
      `;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'cit';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_EB_CIT;
  }

  /**
   *
   * Singleton constructor for the EbCitEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {ebCitEnvironment}
   *
   */
  public static getInstance(app: App): EbCitEnvironment {
    if (!EbCitEnvironment.instance) {
      EbCitEnvironment.instance = new EbCitEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getEbCitAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getEbCitAccountDef().vpcCidrs.main.recovery,
        envName: EbCitEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'eb-cit',
        recoverySpokeVpcStackPrefix: 'eb',
      });
      EbCitEnvironment.instance.deployStacks();
    }

    return EbCitEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
