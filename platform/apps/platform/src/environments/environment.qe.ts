import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfOracleDatabaseStack,
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
import { UobQeEnvConfiguration } from '../uobEnvConfigurations/uobQeEnvConfiguration';
import LogArchiveEnvironment from './environment.logArchive';
import NonProdSharedNetworkEnvironment from './environment.nonProdSharedNetwork';
import { UpfQeDbConfig } from '../upfDbConfigurations/upfQeDbConfig';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { DbsQeEnvConfiguration } from '../dbsEnvConfigurations/dbsQeEnvConfiguration';

/**
 * QE Environment
 */
export default class QeEnvironment extends NetworkableEnvironment {
  private qeUobHelper: UobHelperStack;
  private qeUobDrHelper: UobHelperStack;
  static instance: QeEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();
    SharedNetworkEnvironment.getInstance(this.app);
    new DfAnsibleStateManagerAssociation({
      stackName: 'ansible-state-manager-association',
      stackConfig: this.stackConfig,
      disableNewRelic: 'false',
    });
    this.qeUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      ansibleVars: {
        privateKeySsmParameterName: 'shared-bld-01-private-key',
        prodServiceAccounts: false,
        upfDatabaseFqdns: [
          'uobxqelbs01.qe.dragonflyft.com',
          ...UpfQeDbConfig.upfFQDNS(),
        ],
      },
    });

    this.createUobObjects();
    this.createDatabases();
    this.createQeWorkstations();
    this.createDbsObjects();

    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

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

    const stackShell1 = new RemoteStack('upfReverseProxy', this.stackConfig);
    const oracleStackShell1 = new RemoteStack(
      'OracleUpdInstance',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upfReverseProxy',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'uobxqeupfrp01.qe',
        upfDbConfig: UpfQeDbConfig.configuration.upf01,
        dockerPushRoleAssumption: QeEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: `${this.stackConfig.envName}-OracleUpdInstance`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );
    const stackShell2 = new RemoteStack('upfReverseProxy2', this.stackConfig);
    const oracleStackShell2 = new RemoteStack(
      'OracleUpd2Instance',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upfReverseProxy2',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'uobxqeupfrp02.qe',
        upfDbConfig: UpfQeDbConfig.configuration.upf02,
        dockerPushRoleAssumption: QeEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell2,
        useNewNaming: true,
        oracleStackShell: oracleStackShell2,
        oracleStackName: `${this.stackConfig.envName}-OracleUpdInstance-2`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );
    const stackShell3 = new RemoteStack('upfReverseProxy3', this.stackConfig);
    const oracleStackShell3 = new RemoteStack(
      'OracleUpd3Instance',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upfReverseProxy3',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'uobxqeupfrp03.qe',
        upfDbConfig: UpfQeDbConfig.configuration.upf03,
        dockerPushRoleAssumption: QeEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell3,
        useNewNaming: true,
        oracleStackShell: oracleStackShell3,
        oracleStackName: `${this.stackConfig.envName}-OracleUpdInstance-3`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    const stackShell4 = new RemoteStack('upfReverseProxy4', this.stackConfig);
    const oracleStackShell4 = new RemoteStack(
      'OracleUpd4Instance',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upfReverseProxy4',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'uobxqeupfrp04.qe',
        upfDbConfig: UpfQeDbConfig.configuration.upf04,
        dockerPushRoleAssumption: QeEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell4,
        useNewNaming: true,
        oracleStackShell: oracleStackShell4,
        oracleStackName: `${this.stackConfig.envName}-OracleUpdInstance-4`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new DfWindowsS1AgentStack('windows-s1-agent', this.stackConfig);

    new DfWindowsNetworkSensorAgentAssociationStack(
      this.stackConfig,
      'network-sensor-windows-agent-association',
      {
        regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      }
    );

    return this.handler;
  }

  /**
   *
   */
  private createDbsObjects() {
    const dbsHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      stackName: 'dbs-shared-helper',
      clusterType: 'dbs',
    });

    dbsHelper.createUobInstanceRole({
      resourceName: 'dbs-iam-role',
      envName: this.stackConfig.envName,
    });

    dbsHelper.createUobInstanceKey({
      keyName: 'dbsDrKeyPair',
      constructName: 'dbs-uat-key-pair',
    });

    Object.values(DbsQeEnvConfiguration.configuration).map((v) => {
      return new UobCluster({
        helper: dbsHelper,
        uobStack: new UobStack(
          `${v.properties.clusterName}-stack`,
          this.stackConfig,
          {
            vpc: this.vpcLegacy.vpcConstruct,
          }
        ),
        sopsData: this.sopsData,
        clusterConfiguration: v,
        networkInstanceBackend: NonProdSharedNetworkEnvironment.getInstance(
          this.app
        ).nonProdSharedNetworkS3BackendProps(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
      });
    });
  }

  /**
   *
   */
  private createUobObjects() {
    /* Create Uob Helper objects */
    this.qeUobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    this.qeUobHelper.createUobEfs({
      constructName: 'UOB',
      vpc: this.vpcLegacy.vpcConstruct,
    });
    this.qeUobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'shared-bld-01',
    });

    this.createUobClusters();
  }

  /**
   * Creates the UOB Clusters in QE
   */
  private createUobClusters(): void {
    const clusters: UobCluster[] = Object.values(
      UobQeEnvConfiguration.configuration
    ).map((v) => {
      return new UobCluster({
        helper: this.qeUobHelper,
        uobStack: new UobStack(
          `${v.properties.clusterName}-stack`,
          this.stackConfig,
          {
            vpc: this.vpcLegacy.vpcConstruct,
          }
        ),
        sopsData: this.sopsData,
        clusterConfiguration: v,
        networkInstanceBackend: NonProdSharedNetworkEnvironment.getInstance(
          this.app
        ).nonProdSharedNetworkS3BackendProps(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
        recoveryNetworkInstanceBackend:
          NonProdSharedNetworkEnvironment.getInstance(
            this.app
          ).nonProdSharedNetworkS3BackendProps(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ),
        paloNetworkBackend: NonProdSharedNetworkEnvironment.getInstance(
          this.app
        ).nonProdSharedNetworkS3BackendProps(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        customerDefinition: DfAccounts.customers.dragonfly,
      });
    });

    const uq05Cluster = clusters.find(
      (i) =>
        i.clusterName ===
        UobQeEnvConfiguration.configuration.uq05.properties.clusterName
    );

    new DfAlb(
      'uq05-msi',
      this.stackConfig,
      {
        networkInstance: NonProdSharedNetworkEnvironment.getInstance(
          this.app
        ).regionalNetworkConfig(Constants.AWS_REGION_ALIASES.LEGACY),
        instancesForTargetGroup: uq05Cluster.getInstancesByTier('msi'),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain:
            `uq05qelbs01.${QeEnvironment.ENVIRONMENT_SUBDOMAIN}`.toLowerCase(),
          stackShell: uq05Cluster.stack,
          vpc: this.vpcLegacy.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 8100,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/actuator/health',
            healthCheckPort: '8100',
            healthCheckProtocol: 'HTTP',
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );
  }

  /**
   *
   */
  private createDatabases() {
    const psqlRds01 = this.qeUobHelper.createPsqlRdsInstance({
      vpc: this.vpcLegacy.vpcConstruct,
      rdsInstanceName: `${this.stackConfig.envName}-PSQLInstance`.toLowerCase(),
      dbVersion: '14.8',
      allocatedStorage: 100,
      instanceClass: 'db.t4g.medium',
      dbName: 'dbuq95',
      username: 'postgres',
      password: this.sopsData.RDS_CONFIG_CREDS.testingStack.password,
      allowedCidrBlocks: [
        this.vpcLegacy.vpcConstruct.vpcCidrBlock,
        DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr,
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
      ],
      dbDnsName: 'uobxqepsql01.qe',
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      autoMinorVersionUpgrade: false,
      paramaterGroupConfig: {
        name: 'uob-psql01-postgres14',
        family: 'postgres14',
        parameter: [
          {
            name: 'max_prepared_transactions',
            value: '100',
            applyMethod: 'pending-reboot',
          },
        ],
      },
    });

    new Route53Attachment({
      requestingStack: this.qeUobHelper,
      recordType: 'CNAME',
      dnsName: 'uobxqepsql01.qe',
      awsPrivateIpOrPrivateDns: [psqlRds01.dbResource.address],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const oracleDbStack = new DfOracleDatabaseStack(
      'OracleInstance',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-OracleInstance`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 1000,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.m5.2xlarge',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'uob-oracle-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
            {
              name: 'audit_trail',
              value: 'DB',
              applyMethod: 'pending-reboot',
            },
          ],
        },
        createBucket: false,
        timezone: 'America/New_York',
        optionGroupName: 'uobxqeoracle01-option-group-est',
      }
    );

    new Route53Attachment({
      requestingStack: oracleDbStack,
      recordType: 'CNAME',
      dnsName: 'uobxqeoracle01.qe',
      awsPrivateIpOrPrivateDns: [
        oracleDbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const oracleQe2DbStack = new DfOracleDatabaseStack(
      'OracleInstanceqe2',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-Oracle-Instance-qe2`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 1000,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.m5.2xlarge',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'uob-oracle-se2-19-qe2',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
        timezone: 'America/New_York',
        optionGroupName: 'uobxsqeoracle02-option-group-est',
      }
    );

    new Route53Attachment({
      requestingStack: oracleQe2DbStack,
      recordType: 'CNAME',
      dnsName: 'uobxsqeoracle02.qe',
      awsPrivateIpOrPrivateDns: [
        oracleQe2DbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const coreQeOracle2 = new DfOracleDatabaseStack(
      'CoreQeOracle2',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-CoreQEOracle2`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 350,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.large',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'coreqe2-oracle-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '3000',
            },
          ],
        },
        createBucket: false,
        timezone: 'America/New_York',
        optionGroupName: 'uoxqeoracle02-option-group-est',
      }
    );

    new Route53Attachment({
      requestingStack: coreQeOracle2,
      recordType: 'CNAME',
      dnsName: 'uobxqeoracle02.qe',
      awsPrivateIpOrPrivateDns: [
        coreQeOracle2.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const coreQeOracle3 = new DfOracleDatabaseStack(
      'CoreQeOracle3',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-CoreQEOracle3`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 350,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.large',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'coreqe3-oracle-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '3000',
            },
          ],
        },
        createBucket: false,
        timezone: 'America/New_York',
        optionGroupName: 'uobxqeoracle03-option-group-est',
      }
    );

    new Route53Attachment({
      requestingStack: coreQeOracle3,
      recordType: 'CNAME',
      dnsName: 'uobxqeoracle03.qe',
      awsPrivateIpOrPrivateDns: [
        coreQeOracle3.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const customQeOracle1 = new DfOracleDatabaseStack(
      'CustomQeOracle1',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-CustomQeOracle1`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'customqe1-oracle-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
      }
    );

    new Route53Attachment({
      requestingStack: customQeOracle1,
      recordType: 'CNAME',
      dnsName: 'uobxsqeoracle01-orig.qe',
      awsPrivateIpOrPrivateDns: [
        customQeOracle1.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const customQeOracle1ESTReplica = new DfOracleDatabaseStack(
      'CustomQeOracle1ESTReplica',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-CustomQeOracle1-EST`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'customqe1-est-replica-oracle-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        timezone: 'America/New_York',
        createBucket: false,
      }
    );

    new Route53Attachment({
      requestingStack: customQeOracle1ESTReplica,
      recordType: 'CNAME',
      dnsName: 'uobxsqeoracle01.qe',
      awsPrivateIpOrPrivateDns: [
        customQeOracle1ESTReplica.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const performanceReplica = new DfOracleDatabaseStack(
      'PerfReplica',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-PerfReplica`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 3500,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.m5.4xlarge',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'perfreplica-oracle-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
        additionalOptions: [
          {
            optionName: 'STATSPACK',
          },
        ],
      }
    );

    new Route53Attachment({
      requestingStack: performanceReplica,
      recordType: 'CNAME',
      dnsName: 'perfreplica.qe',
      awsPrivateIpOrPrivateDns: [
        performanceReplica.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   * Create the QE workstations
   */
  private createQeWorkstations() {
    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin01',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-volume',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin01.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 500,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin02',
            Alias: 'QE Dev Workstation 1',
            Owner: 'Prabhakar Singh',
            Team: 'QE',
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin02.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 500,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin03',
            Alias: 'QE Dev Workstation 2',
            Owner: 'Aditya Kadam',
            Team: 'QE',
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin03.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 100,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin04',
            Alias: 'QE Dev Workstation 3 EUA Tools',
            Owner: 'Sanjeev Mishra',
            Team: 'QE',
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin04.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 50,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin05',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-05',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin05.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 50,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin06',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-06',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
            {
              volumeName: 'windows-workstation-06-poc',
              volumeSize: 1000,
              deviceName: '/dev/xvdg',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin06.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin07',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-07',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin07.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin08',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-08',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin08.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v2'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin09',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          securityGroup: {
            ports: {
              tcp: [8501, 8700],
              udp: [],
            },
          },
          volumes: [
            {
              volumeName: 'windows-workstation-09',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin09.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v3'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin10',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-10',
              volumeSize: 150,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin10.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v3'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 50,
            volumeType: 'gp3',
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin11',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-11',
              volumeSize: 250,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin11.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v3'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 100,
            volumeType: 'gp3',
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin12',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-11',
              volumeSize: 100,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin12.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default-v3'],
          instanceType: 'r6i.xlarge',
          rootBlockDevice: {
            volumeSize: 100,
            volumeType: 'gp3',
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobxqewin13',
            Alias: 'windows-automation',
            Team: 'QE',
          },
        },
        options: {
          volumes: [
            {
              volumeName: 'windows-workstation-13',
              volumeSize: 100,
              deviceName: '/dev/xvdf',
            },
          ],
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobxqewin13.qe',
          envSubdomain: QeEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'qe';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'qe';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_QE;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${QeEnvironment.ACCOUNT_ID}:role/${QeEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name DockerPush \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   *
   * Singleton constructor for the QeEnvironment
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {QeEnvironment}
   *
   */
  public static getInstance(app: App): QeEnvironment {
    if (!QeEnvironment.instance) {
      QeEnvironment.instance = new QeEnvironment({
        app: app,
        vpcCidrLegacy: DfAccounts.getQeAccountDef().vpcCidrs.main.legacy,
        vpcCidrPrimary: DfAccounts.getQeAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getQeAccountDef().vpcCidrs.main.recovery,
        envName: QeEnvironment.ENVIRONMENT_NAME,
        envTier: 'dev',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'uob',
      });
      QeEnvironment.instance.deployStacks();
    }

    return QeEnvironment.instance;
  }
}
