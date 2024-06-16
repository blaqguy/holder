import {
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfVantaIntegrationStack,
  RemoteStack,
  DfWindowsS1AgentStack,
  UPFReverseProxyStack,
  UobCluster,
  UobHelperStack,
  UobStack,
  WindowsWorkstationStack,
  DfOracleDatabaseStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfAnsibleStateManagerAssociation,
  MicrosoftOutboundResolver,
} from '@dragonfly/stacks';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import ToolsEnvironment from './environment.tools';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import SharedUatEnvironment from './environment.sharedUat';
import { UobSantUatEnvConfiguration } from '../uobEnvConfigurations/uat/uobSantUatEnvConfiguration';
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfSantUatDbConfig } from '../upfDbConfigurations/upfSantUatDbConfig';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/**
 * Santander Uat Env
 */
export default class SantUatEnvironment extends NetworkableEnvironment {
  private static instance: SantUatEnvironment;

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
    this.createUobCluster();
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
   * Creates the UOB Cluster
   */
  private createUobCluster() {
    const customerSubnets: CustomerObjectSubnet[] =
      SharedNetworkEnvironment.getInstance(
        this.app
      ).primaryNetwork.getClientObjectSubnetByCustomerName(
        DfAccounts.customers.santander.customerName
      );

    const santUatHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      clusterType: 'uob',
      customerObjectSubnet: customerSubnets,
      ansibleVars: {
        privateKeySsmParameterName: 'sant-uat-uobKeyPair-private-key',
        prodServiceAccounts: false,
        upfDatabaseFqdns: UpfSantUatDbConfig.upfFQDNS(),
        sharedBuildKeyParameterName: 'shared-uat-bld-pub-key',
      },
    });

    new SsmParameter(santUatHelper, 'shared-uat-bld-key', {
      provider: santUatHelper.primaryProvider,
      name: `shared-uat-bld-pub-key`,
      type: 'SecureString',
      value: SharedUatEnvironment.getInstance(this.app).lookupBuildKey(
        santUatHelper,
        'santUat-bld-lookup'
      ),
    });

    santUatHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'sant-uat-uobKeyPair',
    });

    santUatHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    santUatHelper.createUobEfs({
      constructName: 'sant-uat-uob',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    const clusterSantUat: UobCluster = new UobCluster({
      helper: santUatHelper,
      uobStack: new UobStack(
        `${UobSantUatEnvConfiguration.configuration.santUat.properties.clusterName}-stack`,
        this.stackConfig,
        {
          vpc: this.vpcPrimary.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration: UobSantUatEnvConfiguration.configuration.santUat,
      networkInstanceBackend: SharedNetworkEnvironment.getInstance(
        this.app
      ).prodSharedNetworkS3BackendProps(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      recoveryNetworkInstanceBackend: SharedNetworkEnvironment.getInstance(
        this.app
      ).prodSharedNetworkS3BackendProps(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      ),
      customerDefinition: DfAccounts.customers.santander,
    });
    const clusterSantUat2: UobCluster = new UobCluster({
      helper: santUatHelper,
      uobStack: new UobStack(
        `${UobSantUatEnvConfiguration.configuration.santUat2.properties.clusterName}-stack`,
        this.stackConfig,
        {
          vpc: this.vpcPrimary.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration: UobSantUatEnvConfiguration.configuration.santUat2,
    });

    const clusters: UobCluster[] = [clusterSantUat, clusterSantUat2];

    const santUatAlbStackShell = new RemoteStack(
      'santUat-web-alb-stack',
      this.stackConfig
    );

    new DfAlb(
      'santUat-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: clusters[0].getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `santanderu1.${SantUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: santUatAlbStackShell,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 30101,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/',
            healthCheckPort: '30101',
            healthCheckProtocol: 'HTTPS',
            healthCheckInterval: 10,
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfAlb(
      'santUat2-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: clusters[0].getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `santanderu2.${SantUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: santUatAlbStackShell,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 30102,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/',
            healthCheckPort: '30102',
            healthCheckProtocol: 'HTTPS',
            healthCheckInterval: 10,
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfAlb(
      'santUat-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: clusterSantUat.getInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `santpx.${SantUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: clusterSantUat.stack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 443,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/',
            healthCheckPort: '443',
            healthCheckProtocol: 'HTTPS',
            healthCheckInterval: 10,
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const dbSantu1Stack = new DfOracleDatabaseStack(
      'DBSANTU1',
      this.stackConfig,
      {
        id: 'db-santu1'.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'db-santu1-uat-ee-19',
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
        sopsDbProperty: 'dbsantu1',
        prodCustomerData: true,
        optionGroupName: 'db-santu1-est'.toLowerCase(),
        timezone: 'America/New_York',
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: dbSantu1Stack,
      recordType: 'CNAME',
      dnsName: 'dbsantu1.uat',
      awsPrivateIpOrPrivateDns: [
        dbSantu1Stack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell1 = new RemoteStack('upf-sant-uat-01-rp', this.stackConfig);
    const oracleStackShell1 = new RemoteStack(
      'sant-uat-upf-01',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-sant-uat-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1snu1rp.uat',
        upfDbConfig: UpfSantUatDbConfig.configuration.upf01,
        dockerPushRoleAssumption: SantUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: 'sant-uat-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell2 = new RemoteStack('upf-sant-uat-02-rp', this.stackConfig);
    const oracleStackShell2 = new RemoteStack(
      'sant-uat-upf-02',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-sant-uat-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2snu1rp.uat',
        upfDbConfig: UpfSantUatDbConfig.configuration.upf02,
        dockerPushRoleAssumption: SantUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell2,
        useNewNaming: true,
        oracleStackShell: oracleStackShell2,
        oracleStackName: 'sant-uat-upf-02',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new UPFReverseProxyStack(
      'sant2-1-upf-rp',
      this.stackConfig,
      {
        remoteStack: santUatHelper,
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1snu2rp.ist',
        upfDbConfig: UpfSantUatDbConfig.configuration.upf03,
        dockerPushRoleAssumption: SantUatEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
    new UPFReverseProxyStack(
      'sant2-2-upf-rp',
      this.stackConfig,
      {
        remoteStack: santUatHelper,
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2snu2rp.ist',
        upfDbConfig: UpfSantUatDbConfig.configuration.upf04,
        dockerPushRoleAssumption: SantUatEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default'],
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 100,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              kmsKeyId: clusters[0].stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'santuatmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'santuatmgr01.uat',
          envSubdomain: SantUatEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);
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
      targetAccountId: SantUatEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Integrates EWB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('SantUatVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'santUat';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${SantUatEnvironment.ACCOUNT_ID}:role/${SantUatEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_SANT_UAT;
  }

  /**
   *
   * Singleton constructor for the EwbUatEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {SantUatEnvironment}
   *
   */
  public static getInstance(app: App): SantUatEnvironment {
    if (!SantUatEnvironment.instance) {
      SantUatEnvironment.instance = new SantUatEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getSantanderUatAccountDef().vpcCidrs.main.recovery,
        envName: SantUatEnvironment.ENVIRONMENT_NAME,
        envTier: 'uat',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'uat',
      });
      SantUatEnvironment.instance.deployStacks();
    }

    return SantUatEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
