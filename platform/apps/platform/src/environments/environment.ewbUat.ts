import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfOracleDatabaseStack,
  DfSpokeVpcStack,
  DfVantaIntegrationStack,
  RemoteStack,
  UPFReverseProxyStack,
  UobCluster,
  UobHelperStack,
  UobStack,
  MicrosoftOutboundResolver,
} from '@dragonfly/stacks';
import ToolsEnvironment from './environment.tools';
import { UobEwbUatEnvConfiguration } from '../uobEnvConfigurations/uat/uobEwbUatEnvConfiguration';
import SharedUatEnvironment from './environment.sharedUat';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfEwbUatDbConfig } from '../upfDbConfigurations/upfEwbUatDbConfig';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/** East West Bank Uat Env */
export default class EwbUatEnvironment extends NetworkableEnvironment {
  private static instance: EwbUatEnvironment;
  private ewbUatVpcPrimary: DfSpokeVpcStack;
  private ewbUatVpcRecovery: DfSpokeVpcStack;
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
      targetAccountId: EwbUatEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Creates the UOB Cluster
   */
  private createUobCluster() {
    const customerSubnets: CustomerObjectSubnet[] =
      SharedNetworkEnvironment.getInstance(
        this.app
      ).primaryNetwork.getClientObjectSubnetByCustomerName(
        DfAccounts.customers.eastWestBank.customerName
      );

    const ewbUatUobHelper = new UobHelperStack(this.stackConfig, {
      customerObjectSubnet: customerSubnets,
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      uobReplicaConfig: {
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        replicateKey: true,
      },
      ansibleVars: {
        privateKeySsmParameterName: 'ewb-uat-uobKeyPair-private-key',
        prodServiceAccounts: false,
        sharedBuildKeyParameterName: 'shared-uat-bld-pub-key',
        upfDatabaseFqdns: UpfEwbUatDbConfig.upfFQDNS(),
      },
    });

    new SsmParameter(ewbUatUobHelper, 'shared-uat-bld-key', {
      provider: ewbUatUobHelper.primaryProvider,
      name: `shared-uat-bld-pub-key`,
      type: 'SecureString',
      value: SharedUatEnvironment.getInstance(this.app).lookupBuildKey(
        ewbUatUobHelper,
        'ewbUat-bld-lookup'
      ),
      tags: { Name: 'shared-uat-bld-pub-key' },
    });

    new SsmParameter(ewbUatUobHelper, 'shared-uat-bld-key-recovery', {
      provider: ewbUatUobHelper.recoveryProvider,
      name: `shared-uat-bld-pub-key`,
      type: 'SecureString',
      value: SharedUatEnvironment.getInstance(this.app).lookupBuildKey(
        ewbUatUobHelper,
        'ewbUat-bld-lookup-recovery'
      ),
      tags: { Name: 'shared-uat-bld-pub-key' },
    });

    ewbUatUobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'ewb-uat-uobKeyPair',
    });

    ewbUatUobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    ewbUatUobHelper.createUobEfs({
      constructName: 'ewb-uat-uob',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    new UobCluster({
      helper: ewbUatUobHelper,
      uobStack: new UobStack(
        `ewbUat01-cluster-stack`,
        this.stackConfig,
        {
          primaryVpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration: UobEwbUatEnvConfiguration.configuration.ewbUat,
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
      customerDefinition: DfAccounts.customers.eastWestBank,
    });

    new UobCluster({
      helper: ewbUatUobHelper,
      uobStack: new UobStack(
        `ewbUat02-cluster-stack`,
        this.stackConfig,
        {
          vpc: this.vpcPrimary.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration: UobEwbUatEnvConfiguration.configuration.ewbUat02,
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
      customerDefinition: DfAccounts.customers.eastWestBank,
    });

    const ewbkCluster = new UobCluster({
      helper: ewbUatUobHelper,
      uobStack: new UobStack(
        `ewbk-cluster-stack`,
        this.stackConfig,
        {
          vpc: this.vpcPrimary.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration: UobEwbUatEnvConfiguration.configuration.ewbkUat,
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
      customerDefinition: DfAccounts.customers.eastWestBank,
    });

    new DfAlb(
      'ewbUat-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: ewbkCluster.getInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `ewbkpx.${EwbUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: ewbkCluster.stack,
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

    new DfAlb(
      'http-ewbUat-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: false,
        instancesForTargetGroup: ewbkCluster.getInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `ewbkpx2.${EwbUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: ewbkCluster.stack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 80,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/',
            healthCheckPort: '80',
            healthCheckProtocol: 'HTTP',
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

    /**
     * EWBK 1 resources
     */
    const oracleDbStack = new DfOracleDatabaseStack(
      'OracleInstance',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-OracleInstance`.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        optionGroupName: 'OracleInstance-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'ewb1-uob-ee-19',
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
        sopsDbProperty: 'dbewbkuob',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
        replicaConfig: ewbUatUobHelper.getUobReplicaConfig()
          ? {
              recoveryProvider: ewbUatUobHelper.recoveryProvider,
              recoveryVpc: this.vpcRecovery.vpcConstruct,
            }
          : null,
        kmsNameOverride: 'ewbuat-oracleinstance-oracle-key-multi-regional',
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: oracleDbStack,
      recordType: 'CNAME',
      dnsName: `dbewbk.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [
        oracleDbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell1 = new RemoteStack('upf-01-rp', this.stackConfig);
    const oracleStackShell1 = new RemoteStack(`upf-01-db`, this.stackConfig);

    new UPFReverseProxyStack(
      'upf-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfDbConfig: UpfEwbUatDbConfig.configuration.upf01,
        upfRoute53Name: 'dbu1ewu3rp.uat',
        dockerPushRoleAssumption: EwbUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: 'ewb-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell2 = new RemoteStack('upf-02-rp', this.stackConfig);
    const oracleStackShell2 = new RemoteStack(`upf-02-db`, this.stackConfig);

    new UPFReverseProxyStack(
      'upf-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2ewu3rp.uat',
        upfDbConfig: UpfEwbUatDbConfig.configuration.upf02,
        dockerPushRoleAssumption: EwbUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell2,
        useNewNaming: true,
        oracleStackShell: oracleStackShell2,
        oracleStackName: `ewb-upf-02`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    /**
     * EWB 2 resources
     */
    const ewb02UobDb = new DfOracleDatabaseStack(
      'ewb02-uob-01-db',
      this.stackConfig,
      {
        id: 'ewb02-uob-01',
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        optionGroupName: 'ewb02-uob-01-db-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'ewb2-uob-ee-19',
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
        sopsDbProperty: 'dbewbkuob',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: ewb02UobDb,
      recordType: 'CNAME',
      dnsName: `dbewbku2.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [ewb02UobDb.oracleDbInstanceResource.address],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell3 = new RemoteStack('ewb02-upf-01-rp', this.stackConfig);
    const oracleStackShell3 = new RemoteStack(
      `ewb02-upf-01-db`,
      this.stackConfig
    );

    new UPFReverseProxyStack(
      'ewb02-upf-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1ewu2rp.uat',
        upfDbConfig: UpfEwbUatDbConfig.configuration.upf03,
        dockerPushRoleAssumption: EwbUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell3,
        useNewNaming: true,
        oracleStackShell: oracleStackShell3,
        oracleStackName: `ewb02-upf-01`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell4 = new RemoteStack('ewb02-upf-02-rp', this.stackConfig);
    const oracleStackShell4 = new RemoteStack(
      `ewb02-upf-02-db`,
      this.stackConfig
    );

    new UPFReverseProxyStack(
      'ewb02-upf-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2ewu2rp.uat',
        upfDbConfig: UpfEwbUatDbConfig.configuration.upf04,
        dockerPushRoleAssumption: EwbUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell4,
        useNewNaming: true,
        oracleStackShell: oracleStackShell4,
        oracleStackName: `ewb02-upf-02`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    /**
     * EWBK resources
     */
    const ewbkUobDb = new DfOracleDatabaseStack(
      'ewbk-uob-01-db',
      this.stackConfig,
      {
        id: 'ewbk-uob-01',
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        optionGroupName: 'ewbk-uob-01-db-db-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'ewbk-uob-ee-19',
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
        sopsDbProperty: 'dbewbk',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: ewbkUobDb,
      recordType: 'CNAME',
      dnsName: `dbewbku1.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [ewbkUobDb.oracleDbInstanceResource.address],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell5 = new RemoteStack('ewbk-upf-01-rp', this.stackConfig);
    const oracleStackShell5 = new RemoteStack(
      `ewbk-upf-01-db`,
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'ewbk-upf-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1ewu1rp.uat',
        upfDbConfig: UpfEwbUatDbConfig.configuration.upf05,
        dockerPushRoleAssumption: EwbUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell5,
        useNewNaming: true,
        oracleStackShell: oracleStackShell5,
        oracleStackName: `ewbk-upf-01`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell6 = new RemoteStack('ewbk-upf-02-rp', this.stackConfig);
    const oracleStackShell6 = new RemoteStack(
      `ewbk-upf-02-db`,
      this.stackConfig
    );

    new UPFReverseProxyStack(
      'ewbk-upf-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2ewu1rp.uat',
        upfDbConfig: UpfEwbUatDbConfig.configuration.upf06,
        dockerPushRoleAssumption: EwbUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell6,
        useNewNaming: true,
        oracleStackShell: oracleStackShell6,
        oracleStackName: `ewbk-upf-02`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   * Integrates EWB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('EWBVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'ewbUat';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${EwbUatEnvironment.ACCOUNT_ID}:role/${EwbUatEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_EWB_UAT;
  }

  /**
   *
   * Singleton constructor for the EwbUatEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {ewbUatEnvironment}
   *
   */
  public static getInstance(app: App): EwbUatEnvironment {
    if (!EwbUatEnvironment.instance) {
      EwbUatEnvironment.instance = new EwbUatEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getEwbUatAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getEwbUatAccountDef().vpcCidrs.main.recovery,
        envName: EwbUatEnvironment.ENVIRONMENT_NAME,
        envTier: 'uat',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'ewb-uat',
        recoverySpokeVpcStackPrefix: 'uat',
        isRecoverySpelledWrong: true,
      });
      EwbUatEnvironment.instance.deployStacks();
    }

    return EwbUatEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
