import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfOracleDatabaseStack,
  DfVantaIntegrationStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfWindowsS1AgentStack,
  RemoteStack,
  UPFReverseProxyStack,
  UobCluster,
  UobHelperStack,
  UobStack,
  WindowsWorkstationStack,
  MicrosoftOutboundResolver,
} from '@dragonfly/stacks';
import ToolsEnvironment from './environment.tools';
import { NetworkableEnvironment } from './networkableEnvironment';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import SharedProdEnvironment from './environment.sharedProd';
import { UobSantanderProdEnvConfiguration } from '../uobEnvConfigurations/prod/uobSantanderProdEnvConfiguration';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfSantProdDbConfig } from '../upfDbConfigurations/upfSantProdDbConfig';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { UpfSantProdDrDbConfig } from '../upfDbConfigurations/upfSantProdDrDbConfig';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/** Santander Prod Env */
export default class SantProdEnvironment extends NetworkableEnvironment {
  private static instance: SantProdEnvironment;

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

    const santanderProdUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      clusterType: 'uob',
      customerObjectSubnet: customerSubnets,
      uobReplicaConfig: {
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        replicateKey: true,
      },
      ansibleVars: {
        privateKeySsmParameterName: 'santander-prod-uobKeyPair-private-key',
        prodServiceAccounts: true,
        upfDatabaseFqdns: UpfSantProdDbConfig.upfFQDNS(),
        upfDatabaseFqdnsDr: UpfSantProdDrDbConfig.upfFQDNS(),
        sharedBuildKeyParameterName: 'shared-prod-bld-pub-key',
      },
    });

    new SsmParameter(santanderProdUobHelper, 'shared-prod-bld-key', {
      provider: santanderProdUobHelper.primaryProvider,
      name: `shared-prod-bld-pub-key`,
      type: 'SecureString',
      value: SharedProdEnvironment.getInstance(this.app).lookupBuildKey(
        santanderProdUobHelper,
        'santanderProd-bld-lookup'
      ),
      tags: { Name: 'shared-prod-bld-pub-key' },
    });

    new SsmParameter(santanderProdUobHelper, 'shared-prod-bld-key-recovery', {
      provider: santanderProdUobHelper.recoveryProvider,
      name: `shared-prod-bld-pub-key`,
      type: 'SecureString',
      value: SharedProdEnvironment.getInstance(this.app).lookupBuildKey(
        santanderProdUobHelper,
        'santanderProd-bld-lookup-recovery'
      ),
      tags: { Name: 'shared-prod-bld-pub-key' },
    });

    santanderProdUobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'santander-prod-uobKeyPair',
    });

    santanderProdUobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    santanderProdUobHelper.createUobEfs({
      constructName: 'santander-prod-uob',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    const sant01Cluster = new UobCluster({
      helper: santanderProdUobHelper,
      uobStack: new UobStack(
        `sant-01-cluster`,
        this.stackConfig,
        {
          primaryVpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration:
        UobSantanderProdEnvConfiguration.configuration.sant01,
      networkInstanceBackend: Utils.getNetworkS3BackendProps(
        Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        'prod',
        SharedNetworkEnvironment.ENVIRONMENT_NAME
      ),
      recoveryNetworkInstanceBackend: Utils.getNetworkS3BackendProps(
        Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        'prod',
        SharedNetworkEnvironment.ENVIRONMENT_NAME
      ),
      customerDefinition: DfAccounts.customers.santander,
    });

    new DfAlb(
      'santProd-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: sant01Cluster.getInstancesByTier('web'),
        recoveryInstancesForTargetGroup:
          sant01Cluster.getRecoveryInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `santander.${SantProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: sant01Cluster.stack,
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
      'santProd-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: sant01Cluster.getInstancesByTier('rt'),
        recoveryInstancesForTargetGroup:
          sant01Cluster.getRecoveryInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `santpx.${SantProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: sant01Cluster.stack,
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

    const clusters: UobCluster[] = [sant01Cluster];

    const sant01UobDb = new DfOracleDatabaseStack(
      'sant01-uob-01-db',
      this.stackConfig,
      {
        id: 'sant01-uob-01',
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        multiRegionKey: true,
        kmsNameOverride: 'sant01-uob-01-oracle-key-multi-regional',
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 1200,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.m6i.2xlarge',
        performanceInsightsEnabled: true,
        optionGroupName: 'sant01-uob-01-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'sant01-ee-19',
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
        sopsDbProperty: 'dbsantuob',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
        ],
        replicaConfig: santanderProdUobHelper.getUobReplicaConfig()
          ? {
              recoveryProvider: santanderProdUobHelper.recoveryProvider,
              recoveryVpc: this.vpcRecovery.vpcConstruct,
            }
          : null,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: sant01UobDb,
      recordType: 'CNAME',
      dnsName: `dbsant.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [sant01UobDb.oracleDbInstanceResource.address],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell1 = new RemoteStack('sant01-upf-01-rp', this.stackConfig);
    const oracleStackShell1 = new RemoteStack(
      'sant01-upf-01-db',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'sant01-upf-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1santrp.prod',
        upfDbConfig: UpfSantProdDbConfig.configuration.upf01,
        dockerPushRoleAssumption: SantProdEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: `sant01-upf-01`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell2 = new RemoteStack('sant01-upf-02-rp', this.stackConfig);
    const oracleStackShell2 = new RemoteStack(
      'sant01-upf-02-db',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'sant01-upf-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2santrp.prod',
        upfDbConfig: UpfSantProdDbConfig.configuration.upf02,
        dockerPushRoleAssumption: SantProdEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell2,
        useNewNaming: true,
        oracleStackShell: oracleStackShell2,
        oracleStackName: `sant01-upf-02`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    Object.entries(UpfSantProdDrDbConfig.configuration).map(([, config]) => {
      new UPFReverseProxyStack(
        'upf-dr',
        this.stackConfig,
        {
          remoteStack: santanderProdUobHelper,
          clusterVpcConstruct: this.vpcRecovery.vpcConstruct,
          upfRoute53Name: config.route53Name,
          upfDbConfig: config,
          dockerPushRoleAssumption:
            SantProdEnvironment.dockerPushRoleAssumption,
          useNewNaming: false,
          useDynamicRoleName: true,
        },
        Constants.AWS_REGION_ALIASES.DF_RECOVERY
      );
    });

    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default-v2'],
          instanceType: 'r6i.large',
          rootBlockDevice: {
            volumeSize: 100,
            volumeType: 'gp3',
            encrypted: true,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 50,
              encrypted: true,
              kmsKeyId: clusters[0].stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'santprodmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'santprodmgr01.prod',
          envSubdomain: SantProdEnvironment.ENVIRONMENT_SUBDOMAIN,
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
      targetAccountId: SantProdEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Integrates Santander Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('SantanderVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return Constants.ENVIRONMENT_NAME_SANTANDER_PROD;
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${SantProdEnvironment.ACCOUNT_ID}:role/${SantProdEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_SANTANDER_PROD;
  }

  /**
   *
   * Singleton constructor for the SantanderProdEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {SantanderProdEnvironment}
   *
   */
  public static getInstance(app: App): SantProdEnvironment {
    if (!SantProdEnvironment.instance) {
      SantProdEnvironment.instance = new SantProdEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getSantanderProdAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getSantanderProdAccountDef().vpcCidrs.main.recovery,
        envName: 'santander',
        envTier: 'prod',
        sharedSpoke: false,
      });
      SantProdEnvironment.instance.deployStacks();
    }

    return SantProdEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
