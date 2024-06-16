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
import { UobMultiTenantProdEnvConfiguration } from '../uobEnvConfigurations/prod/uobMuobProdEnvConfiguration';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfMuobProdDbConfig } from '../upfDbConfigurations/upfMuobProdDbConfig';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { CustomerObjectSubnet } from '@dragonfly/constructs';
import { UpfMuobProdDrDbConfig } from '../upfDbConfigurations/upfMuobProdDrDbConfig';

/** Multi Tenant Prod Env */
export default class MuobProdEnvironment extends NetworkableEnvironment {
  private static instance: MuobProdEnvironment;

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
        DfAccounts.customers.muob.customerName
      );

    const multiTenantProdUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      customerObjectSubnet: customerSubnets,
      secretKeyConfgs: [
        {
          name: 'FNBO',
          numberOfPrivateKeys: 1,
          numberOfPublicKeys: 3,
        },
        {
          name: 'SVB',
          numberOfPrivateKeys: 2,
          numberOfPublicKeys: 2,
        },
        {
          name: 'Mizuho',
          numberOfPrivateKeys: 0,
          numberOfPublicKeys: 1,
        },
      ],
      uobReplicaConfig: {
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        replicateKey: true,
      },
      keyProps: {
        keyName: 'uobKeyPair',
        constructName: 'multi-tenant-prod-uobKeyPair',
      },
      roleProps: {
        resourceName: 'uob-iam-role',
        envName: this.stackConfig.envName,
      },
      efsProps: {
        constructName: 'multi-tenant-prod-uob',
        vpc: this.vpcPrimary.vpcConstruct,
      },
      ansibleVars: {
        prodServiceAccounts: true,
        upfDatabaseFqdns: UpfMuobProdDbConfig.upfFQDNS(),
        upfDatabaseFqdnsDr: UpfMuobProdDrDbConfig.upfFQDNS(),
      },
      createProdLikeResourcesNewWay: true,
    });

    const multiTenantProd01Cluster = new UobCluster({
      helper: multiTenantProdUobHelper,
      uobStack: new UobStack(
        `multiTenantProd01-cluster-stack`,
        this.stackConfig,
        {
          primaryVpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration:
        UobMultiTenantProdEnvConfiguration.configuration.muobProd,
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

    const muobp2Cluster = new UobCluster({
      helper: multiTenantProdUobHelper,
      uobStack: new UobStack(
        `muobp2-cluster-stack`,
        this.stackConfig,
        {
          primaryVpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration:
        UobMultiTenantProdEnvConfiguration.configuration.muobp2,
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

    const muobProdAlbStackShell = new RemoteStack(
      'muobProd-web-alb-stack',
      this.stackConfig
    );

    new DfAlb(
      'uob-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup:
          multiTenantProd01Cluster.getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `muob.${MuobProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: muobProdAlbStackShell,
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

    const muobp2AlbStackShell = new RemoteStack(
      'muobp2-web-alb-stack',
      this.stackConfig
    );

    new DfAlb(
      'muobp2-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: muobp2Cluster.getInstancesByTier('web'),
        recoveryInstancesForTargetGroup:
          muobp2Cluster.getRecoveryInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `muobp2.${MuobProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: muobp2AlbStackShell,
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
          UobMultiTenantProdEnvConfiguration.configuration.muobp2.properties
            .activeRegion,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const oracleDbStack = new DfOracleDatabaseStack(
      'muobProd-db',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-OracleInstance`.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 3000,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.m6i.8xlarge',
        performanceInsightsEnabled: true,
        replicaConfig: {
          recoveryProvider: multiTenantProdUobHelper.recoveryProvider,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
        },
        kmsNameOverride: 'muobprod-oracleinstance-oracle-key-multi-regional',
        multiRegionKey: true,
        parameterGroupConfig: {
          name: 'uob-oracle-ee-19',
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
        sopsDbProperty: 'dbmuobprod',
        prodCustomerData: true,
        timezone: 'America/New_York',
        additionalSgCidrBlocks: [
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: oracleDbStack,
      recordType: 'CNAME',
      dnsName: `dbmuob.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [
        oracleDbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    Object.entries(UpfMuobProdDbConfig.configuration).map(([, config]) => {
      new UPFReverseProxyStack(
        'muob-upf-rp',
        this.stackConfig,
        {
          remoteStack: multiTenantProdUobHelper,
          clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
          upfRoute53Name: config.route53Name,
          upfDbConfig: config,
          dockerPushRoleAssumption:
            MuobProdEnvironment.dockerPushRoleAssumption,
          useNewNaming: false,
          useDynamicRoleName: true,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      );
    });

    Object.entries(UpfMuobProdDrDbConfig.configuration).map(([, config]) => {
      new UPFReverseProxyStack(
        'upf-dr',
        this.stackConfig,
        {
          remoteStack: multiTenantProdUobHelper,
          clusterVpcConstruct: this.vpcRecovery.vpcConstruct,
          upfRoute53Name: config.route53Name,
          upfDbConfig: config,
          dockerPushRoleAssumption:
            MuobProdEnvironment.dockerPushRoleAssumption,
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
          dnsName: 'muobprodmgr01.prod',
          envSubdomain: MuobProdEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default-v2'],
          instanceType: 'r6i.large',
          rootBlockDevice: {
            volumeSize: 100,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              kmsKeyId: multiTenantProd01Cluster.stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'muobprodmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
      },
    ]);

    new DfAlb(
      'px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: multiTenantProd01Cluster
          .getInstancesByTier('rt')
          .slice(0, 2),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `muobpx.${MuobProdEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: multiTenantProd01Cluster.stack,
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
      targetAccountId: MuobProdEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Integrates Multi Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('MultiTenantVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return Constants.ENVIRONMENT_NAME_MULTI_TENANT_PROD;
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${MuobProdEnvironment.ACCOUNT_ID}:role/${MuobProdEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_MULTI_TENANT_PROD;
  }

  /**
   *
   * Singleton constructor for the MultiTenantProdEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {MultiTenantProdEnvironment}
   *
   */
  public static getInstance(app: App): MuobProdEnvironment {
    if (!MuobProdEnvironment.instance) {
      MuobProdEnvironment.instance = new MuobProdEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getMuobProdAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getMuobProdAccountDef().vpcCidrs.main.recovery,
        envName: 'multi-tenant',
        envTier: 'prod',
        sharedSpoke: false,
      });
      MuobProdEnvironment.instance.deployStacks();
    }

    return MuobProdEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
