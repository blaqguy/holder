import {
  DfAnsibleStateManagerAssociation,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfOracleDatabaseStack,
  DfPrismaCloudIntegrationStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfWindowsS1AgentStack,
  RemoteStack,
  UPFReverseProxyStack,
  UobCluster,
  UobHelperStack,
  UobStack,
  WindowsWorkstationStack,
} from '@dragonfly/stacks';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { NetworkableEnvironment } from './networkableEnvironment';
import { UobIstEnvConfiguration } from '../uobEnvConfigurations/uobIstEnvConfiguration';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfIstDbConfig } from '../upfDbConfigurations/upfIstDbConfig';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/**
 * IST Environment
 */
export default class IstEnvironment extends NetworkableEnvironment {
  static instance: IstEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();
    this.createUobCluster();

    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
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
        regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
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
  //  * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'ist';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'ist';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_IST;
  }

  /**
   * @return {string} - Returns the Recovery VPC_CIDR For the environment
   */
  protected static get RECOVERY_VPC_CIDR(): string {
    return DfAccounts.getIstAccountDef().vpcCidrs.main.recovery;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * Creates the UOB Cluster
   */
  private createUobCluster() {
    // Using the MOUB Customer Name
    const customerSubnets: CustomerObjectSubnet[] =
      SharedNetworkEnvironment.getInstance(
        this.app
      ).primaryNetwork.getClientObjectSubnetByCustomerName(
        DfAccounts.customers.muob.customerName
      );
    const istUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      customerObjectSubnet: customerSubnets,
      ansibleVars: {
        privateKeySsmParameterName: 'shared-bld-01-private-key',
        prodServiceAccounts: false,
        upfDatabaseFqdns: UpfIstDbConfig.upfFQDNS(),
      },
    });

    istUobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'shared-bld-01',
    });

    istUobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    istUobHelper.createUobEfs({
      constructName: 'UOB',
      vpc: this.vpcLegacy.vpcConstruct,
    });

    /**
     * Clusters
     */

    const clusters: UobCluster[] = Object.values(
      UobIstEnvConfiguration.configuration
    ).map((v) => {
      return new UobCluster({
        helper: istUobHelper,
        uobStack: new UobStack(
          `${v.properties.clusterName}-stack`,
          this.stackConfig,
          {
            vpc: this.vpcLegacy.vpcConstruct,
          }
        ),
        sopsData: this.sopsData,
        clusterConfiguration: v,
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
        customerDefinition: DfAccounts.customers.muob,
      });
    });

    const sharedIstCluster = clusters.find(
      (i) =>
        i.clusterName ===
        UobIstEnvConfiguration.configuration.sharedIst.properties.clusterName
    );

    const ist01Cluster = clusters.find(
      (i) =>
        i.clusterName ===
        UobIstEnvConfiguration.configuration.ist01.properties.clusterName
    );

    const modCluster = clusters.find(
      (i) =>
        i.clusterName ===
        UobIstEnvConfiguration.configuration.mod.properties.clusterName
    );

    const muob01Cluster = clusters.find(
      (i) =>
        i.clusterName ===
        UobIstEnvConfiguration.configuration.muob01.properties.clusterName
    );

    const modelbankCluster = clusters.find(
      (i) =>
        i.clusterName ===
        UobIstEnvConfiguration.configuration.mod.properties.clusterName
    );

    /**
     * Reverse proxies
     */

    const santUpfRp = new RemoteStack('upfReverseProxy', this.stackConfig);
    new UPFReverseProxyStack(
      'upfReverseProxy',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbsantupf01rp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf01,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        remoteStack: santUpfRp,
        useNewNaming: true,
        oracleStackShell: istUobHelper,
        oracleStackName: 'ist-sant-ist1-upf-OracleInstance',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    const muobUpf01Rp = new RemoteStack('upf-muob-01-rp', this.stackConfig);
    new UPFReverseProxyStack(
      'upf-muob-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbupmui1rp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf02,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        remoteStack: muobUpf01Rp,
        useNewNaming: true,
        oracleStackShell: istUobHelper,
        oracleStackName: 'muob-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    const ewbki1Upf01Rp = new RemoteStack('upf-ewbki1-01-rp', this.stackConfig);
    new UPFReverseProxyStack(
      'upf-ewbki1-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbupewi1rp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf03,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        remoteStack: ewbki1Upf01Rp,
        useNewNaming: true,
        oracleStackShell: istUobHelper,
        oracleStackName: 'ewbki1-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new UPFReverseProxyStack(
      'mod-upf-rp',
      this.stackConfig,
      {
        remoteStack: istUobHelper,
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbu1modrp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf05,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new UPFReverseProxyStack(
      'mod2-upf-rp',
      this.stackConfig,
      {
        remoteStack: istUobHelper,
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbu2modrp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf06,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new UPFReverseProxyStack(
      'csi-upf-01-rp',
      this.stackConfig,
      {
        remoteStack: istUobHelper,
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbupcsi1rp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf07,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new UPFReverseProxyStack(
      'muobi2-upf-01-rp',
      this.stackConfig,
      {
        remoteStack: istUobHelper,
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'dbupmui2rp.ist',
        upfDbConfig: UpfIstDbConfig.configuration.upf08,
        dockerPushRoleAssumption: IstEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    /**
     * Web ALBs
     */
    const ewbki1AlbStackShell = new RemoteStack(
      'ewb-web-alb-stack',
      this.stackConfig
    );

    new DfAlb('ewbki1-ist-1-web-alb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: sharedIstCluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: 'eastwestbanki1.ist',
        stackShell: ewbki1AlbStackShell,
        vpc: this.vpcLegacy.vpcConstruct,
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
    });

    const albStackShell = new RemoteStack(
      'InternalWebAlbShell',
      this.stackConfig
    );

    new DfAlb('santander-ist-1-web-alb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: ist01Cluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: 'santanderist1.ist',
        stackShell: albStackShell,
        vpc: this.vpcLegacy.vpcConstruct,
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
    });

    const sharedAlbStackShell = new RemoteStack(
      'SharedIstWebAlbShell',
      this.stackConfig
    );

    new DfAlb('shared-ist-web-alb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: sharedIstCluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: `shared-web-internal.${IstEnvironment.ENVIRONMENT_SUBDOMAIN}`,
        stackShell: sharedAlbStackShell,
        vpc: this.vpcLegacy.vpcConstruct,
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
    });

    new DfAlb(
      'mod-px',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: modCluster.getInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `modpx.${IstEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: modCluster.stack,
          vpc: this.vpcLegacy.vpcConstruct,
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
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new DfAlb('muob-web-alb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: muob01Cluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: 'muobist.ist',
        stackShell: muob01Cluster.stack,
        vpc: this.vpcLegacy.vpcConstruct,
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
    });

    new Route53Attachment({
      requestingStack: modelbankCluster.stack,
      recordType: 'CNAME',
      dnsName: 'modelbank',
      awsPrivateIpOrPrivateDns: [
        modelbankCluster.findPublicDomain('modelbank'),
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
    /**
     * Databases
     */
    const dbsantEstReplica = new DfOracleDatabaseStack(
      'DbSantEstReplica',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-dbsant-est-replica`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        accountDefinition: this.stackConfig.accountDefinition,
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'dbsant-oracle-ee-19',
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
        timezone: 'America/New_York',
        optionGroupName:
          `${this.stackConfig.envName}-dbsant-est-replica-options`.toLowerCase(),
      }
    );

    new Route53Attachment({
      requestingStack: dbsantEstReplica,
      recordType: 'CNAME',
      dnsName: 'dbsant.ist',
      awsPrivateIpOrPrivateDns: [
        dbsantEstReplica.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    // MUOB DB
    const oracleMuobDbStack = new DfOracleDatabaseStack(
      'OracleMuobInstance',
      this.stackConfig,
      {
        id: 'muob-01'.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        optionGroupName: 'muob-01-est-option-group',
        parameterGroupConfig: {
          name: 'muob-01-oracle-ee-19',
          family: 'oracle-ee-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
        dbName: 'DBMUOB',
        sopsDbProperty: 'dbmuob',
        timezone: 'America/New_York',
      }
    );

    new Route53Attachment({
      requestingStack: oracleMuobDbStack,
      recordType: 'CNAME',
      dnsName: 'dbmuob.ist',
      awsPrivateIpOrPrivateDns: [
        oracleMuobDbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    // EWBKI1 DBs
    const ewbki1DBStack = new DfOracleDatabaseStack(
      'EWBK1DB',
      this.stackConfig,
      {
        id: 'ewbk1db'.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'ewbk1-ist-ee-19',
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
        sopsDbProperty: 'dbewbki1',
        optionGroupName: 'ewbk1db-est-option-group',
        timezone: 'America/New_York',
      }
    );

    new Route53Attachment({
      requestingStack: ewbki1DBStack,
      recordType: 'CNAME',
      dnsName: 'dbewbki1.ist',
      awsPrivateIpOrPrivateDns: [
        ewbki1DBStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    /**
     * Windows workstations
     */
    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 100,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobwistmgr01',
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwistmgr01.ist',
          envSubdomain: IstEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.WINDOWS_2022_DEFAULT_V3
          ],
          instanceType: 't3.2xlarge',
          rootBlockDevice: {
            volumeSize: 50,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobwistmgr02',
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwistmgr02.ist',
          envSubdomain: IstEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${IstEnvironment.ACCOUNT_ID}:role/${IstEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name DockerPush \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   * Singleton constructor for the EwbUatEnvironment class
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {ewbUatEnvironment}
   *
   */
  public static getInstance(app: App): IstEnvironment {
    if (!IstEnvironment.instance) {
      IstEnvironment.instance = new IstEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getIstAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getIstAccountDef().vpcCidrs.main.recovery,
        envName: IstEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'ist',
        recoverySpokeVpcStackPrefix: 'ist',
        isRecoverySpelledWrong: true,
        vpcCidrLegacy: DfAccounts.getIstAccountDef().vpcCidrs.main.legacy,
        vpcLegacyStackPrefix: 'ist-vpc',
      });
      IstEnvironment.instance.deployStacks();
    }

    return IstEnvironment.instance;
  }
}
