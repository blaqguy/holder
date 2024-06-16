import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfOracleDatabaseStack,
  DfSpokeVpcStack,
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
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import ToolsEnvironment from './environment.tools';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import SharedProdEnvironment from './environment.sharedProd';
import { UobEwbProdEnvConfiguration } from '../uobEnvConfigurations/prod/uobEwbProdEnvConfiguration';
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfEwbProdDbConfig } from '../upfDbConfigurations/upfEwbProdDbConfig';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { UpfEwbProdDrDbConfig } from '../upfDbConfigurations/upfEwbProdDrDbConfig';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/**
 * Ewb Prod Env
 */
export default class EwbProdEnvironment extends NetworkableEnvironment {
  private static instance: EwbProdEnvironment;
  private ewbProdVpcPrimary: DfSpokeVpcStack;
  private ewbProdVpcRecovery: DfSpokeVpcStack;
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
      targetAccountId: EwbProdEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Integrates EWB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('EwbProdVanta', this.stackConfig);
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

    const ewbProdHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      customerObjectSubnet: customerSubnets,
      uobReplicaConfig: {
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        replicateKey: true,
      },
      ansibleVars: {
        privateKeySsmParameterName: '	ewbk-prod-uobKeyPair-private-key',
        prodServiceAccounts: false,
        sharedBuildKeyParameterName: 'shared-prod-bld-key',
        upfDatabaseFqdns: UpfEwbProdDbConfig.upfFQDNS(),
        upfDatabaseFqdnsDr: UpfEwbProdDrDbConfig.upfFQDNS(),
      },
    });

    new SsmParameter(ewbProdHelper, 'shared-prod-bld-key', {
      provider: ewbProdHelper.primaryProvider,
      name: `shared-prod-bld-pub-key`,
      type: 'SecureString',
      value: SharedProdEnvironment.getInstance(this.app).lookupBuildKey(
        ewbProdHelper,
        'ewbProd-bld-lookup'
      ),
    });

    new SsmParameter(ewbProdHelper, 'shared-prod-bld-key-recovery', {
      provider: ewbProdHelper.recoveryProvider,
      name: `shared-prod-bld-pub-key`,
      type: 'SecureString',
      value: SharedProdEnvironment.getInstance(this.app).lookupBuildKey(
        ewbProdHelper,
        'ewbProd-bld-lookup-recovery'
      ),
    });

    ewbProdHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'ewbk-prod-uobKeyPair',
    });

    ewbProdHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    ewbProdHelper.createUobEfs({
      constructName: 'ewbk-prod-uob',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    const clusters: { [key: string]: UobCluster } = {};
    Object.entries(UobEwbProdEnvConfiguration.configuration).map(
      ([clusterId, v]) => {
        clusters[clusterId] = new UobCluster({
          helper: ewbProdHelper,
          uobStack: new UobStack(
            `${v.properties.clusterName}-stack`,
            this.stackConfig,
            {
              primaryVpc: this.vpcPrimary.vpcConstruct,
              recoveryVpc: this.vpcRecovery.vpcConstruct,
            },
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ),
          sopsData: this.sopsData,
          clusterConfiguration: v,
          networkInstanceBackend: Utils.getNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY,
            this.stackConfig.accountDefinition.networkType,
            SharedNetworkEnvironment.ENVIRONMENT_NAME
          ),
          recoveryNetworkInstanceBackend: Utils.getNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY,
            this.stackConfig.accountDefinition.networkType,
            SharedNetworkEnvironment.ENVIRONMENT_NAME
          ),
          customerDefinition: DfAccounts.customers.eastWestBank,
        });
      }
    );

    const dbewbkStack = new DfOracleDatabaseStack(
      'DBEWBK',
      this.stackConfig,
      {
        id: 'dbewbk'.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 1000,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.m6i.2xlarge',
        performanceInsightsEnabled: true,
        optionGroupName: 'dbewbk-option-group-est'.toLowerCase(),
        kmsNameOverride: 'dbewbk-oracle-key-multi-regional',
        multiRegionKey: true,
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'dbewbk-prod-se2-19',
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
        sopsDbProperty: 'dbewbkprod',
        prodCustomerData: true,
        deployMultiAz: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
        ],
        replicaConfig: {
          recoveryProvider: ewbProdHelper.recoveryProvider,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
        },
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const ewbProdAlbStackShell = new RemoteStack(
      'ewbProd-web-alb-stack',
      this.stackConfig
    );

    new DfAlb(
      'http-ewbProd-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: false,
        instancesForTargetGroup: clusters['ewbProd'].getInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `ewbkpx2.${EwbProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: clusters['ewbProd'].stack,
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

    new DfAlb(
      'ewbkProd-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: clusters['ewbProd'].getInstancesByTier('web'),
        recoveryInstancesForTargetGroup:
          clusters['ewbProd'].getRecoveryInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `eastwestbank.${EwbProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: ewbProdAlbStackShell,
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
        activeRegion:
          UobEwbProdEnvConfiguration.configuration.ewbProd.properties
            .activeRegion,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfAlb(
      'ewbProd-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: clusters['ewbProd'].getInstancesByTier('rt'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `ewbkpx.${EwbProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: clusters['ewbProd'].stack,
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
        activeRegion:
          UobEwbProdEnvConfiguration.configuration.ewbProd.properties
            .activeRegion,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: dbewbkStack,
      recordType: 'CNAME',
      dnsName: 'dbewbk.prod',
      awsPrivateIpOrPrivateDns:
        UobEwbProdEnvConfiguration.configuration.ewbProd.properties
          .activeRegion === 'recovery'
          ? [dbewbkStack.oracleDbRecoveryInstanceResource.address]
          : [dbewbkStack.oracleDbInstanceResource.address],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell1 = new RemoteStack('upf-ewb-prod-01-rp', this.stackConfig);
    const oracleStackShell1 = new RemoteStack(
      'ewbk-prod-upf-01',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-ewb-prod-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1ewbkrp.prod',
        upfDbConfig: UpfEwbProdDbConfig.configuration.upf01,
        dockerPushRoleAssumption: EwbProdEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: 'ewbk-prod-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell2 = new RemoteStack('upf-ewb-prod-02-rp', this.stackConfig);
    const oracleStackShell2 = new RemoteStack(
      'ewbk-prod-upf-02',
      this.stackConfig
    );

    new UPFReverseProxyStack(
      'upf-ewb-prod-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfDbConfig: UpfEwbProdDbConfig.configuration.upf02,
        upfRoute53Name: 'dbu2ewbkrp.prod',
        dockerPushRoleAssumption: EwbProdEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell2,
        useNewNaming: true,
        oracleStackShell: oracleStackShell2,
        oracleStackName: 'ewbk-prod-upf-02',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    Object.entries(UpfEwbProdDrDbConfig.configuration).map(([, config]) => {
      new UPFReverseProxyStack(
        'upf-dr',
        this.stackConfig,
        {
          remoteStack: ewbProdHelper,
          clusterVpcConstruct: this.vpcRecovery.vpcConstruct,
          upfRoute53Name: config.route53Name,
          upfDbConfig: config,
          dockerPushRoleAssumption: EwbProdEnvironment.dockerPushRoleAssumption,
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
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'ewbkprodmgr01.prod',
          envSubdomain: EwbProdEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default'],
          instanceType: 'r6i.large',
          rootBlockDevice: {
            volumeSize: 100,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              kmsKeyId: clusters['ewbProd'].stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'ewbprodmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
      },
    ]);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'ewbProd';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${EwbProdEnvironment.ACCOUNT_ID}:role/${EwbProdEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_EWB_PROD;
  }

  /**
   *
   * Singleton constructor for the EwbUatEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {EwbProdEnvironment}
   *
   */
  public static getInstance(app: App): EwbProdEnvironment {
    if (!EwbProdEnvironment.instance) {
      EwbProdEnvironment.instance = new EwbProdEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getEwbProdAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getEwbProdAccountDef().vpcCidrs.main.recovery,
        envName: EwbProdEnvironment.ENVIRONMENT_NAME,
        envTier: 'prod',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'prod',
      });
      EwbProdEnvironment.instance.deployStacks();
    }

    return EwbProdEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
