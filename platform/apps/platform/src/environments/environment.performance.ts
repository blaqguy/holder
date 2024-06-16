import {
  DfBuildAutomationRoleStack,
  DfPrismaCloudIntegrationStack,
  RemoteStack,
  WindowsWorkstationStack,
  UobHelperStack,
  UPFReverseProxyStack,
  UobStack,
  UobCluster,
  DfInventoryStack,
  DfBackupResourcesStack,
  DfWindowsS1AgentStack,
  DfOracleDatabaseStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfAnsibleStateManagerAssociation,
} from '@dragonfly/stacks';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { NetworkableEnvironment } from './networkableEnvironment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { UobPerfEnvConfiguration } from '../uobEnvConfigurations/uobPerfEnvConfiguration';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfPerformanceDbConfig } from '../upfDbConfigurations/upfPerformanceDbConfig';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';

/**
 * Performance Environment
 */
export default class PerformanceEnvironment extends NetworkableEnvironment {
  private static instance: PerformanceEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();
    new DfBackupResourcesStack('backup-resources', this.stackConfig, {
      enableColdStorage: false,
    });

    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    this.createUobObjects();

    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default'],
          instanceType: 'm5.4xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
        },
        options: {
          securityGroup: {
            ports: {
              tcp: [8080],
              udp: [],
            },
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwprflg01.prf',
          envSubdomain: PerformanceEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.WINDOWS_2022_DEFAULT_V4
          ],
          instanceType: 'm5.4xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'stprf-sim01',
          },
        },
        options: {
          securityGroup: {
            ports: {
              tcp: [8080],
              udp: [],
            },
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'stprfprfsim01.prf',
          envSubdomain: PerformanceEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcLegacy.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.LEGACY[
            Constants.AMIS.WINDOWS_2022_DEFAULT_V4
          ],
          instanceType: 'm5.4xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          keyName: 'uobKeyPair',
          tags: {
            Name: 'ptprf-sim01',
          },
        },
        options: {
          securityGroup: {
            ports: {
              tcp: [8080],
              udp: [],
            },
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'ptprfwprflg01.prf',
          envSubdomain: PerformanceEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);

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
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'performance';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'prf';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_PERFORMANCE;
  }

  /**
   * @return {string} - Returns the Legacy VPC_CIDR For the environment
   */
  protected static get LEGACY_VPC_CIDR(): string {
    return DfAccounts.getPerfAccountDef().vpcCidrs.main.legacy;
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
      --role-arn arn:aws:iam::${PerformanceEnvironment.ACCOUNT_ID}:role/${PerformanceEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name DockerPush \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   *
   */
  private createUobObjects() {
    const uobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      ansibleVars: {
        privateKeySsmParameterName: 'uob-mod-bld-01-private-key',
        prodServiceAccounts: false,
      },
    });

    uobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    uobHelper.createUobEfs({
      constructName: 'UOB',
      vpc: this.vpcLegacy.vpcConstruct,
    });

    uobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'uob-mod-bld-01',
    });

    new UobCluster({
      helper: uobHelper,
      uobStack: new UobStack(
        `shared-performance-cluster-stack`,
        this.stackConfig,
        {
          vpc: this.vpcLegacy.vpcConstruct,
        }
      ),
      sopsData: this.sopsData,
      clusterConfiguration:
        UobPerfEnvConfiguration.configuration.sharedPerformance,
    });

    const tprfCluster = new UobCluster({
      helper: uobHelper,
      uobStack: new UobStack(`tprf-cluster-stack`, this.stackConfig, {
        vpc: this.vpcLegacy.vpcConstruct,
      }),
      sopsData: this.sopsData,
      clusterConfiguration: UobPerfEnvConfiguration.configuration.tprf,
    });

    const stprfCluster = new UobCluster({
      helper: uobHelper,
      uobStack: new UobStack(`stprf-cluster-stack`, this.stackConfig, {
        vpc: this.vpcLegacy.vpcConstruct,
      }),
      sopsData: this.sopsData,
      clusterConfiguration: UobPerfEnvConfiguration.configuration.stprf,
    });

    const ptprfCluster = new UobCluster({
      helper: uobHelper,
      uobStack: new UobStack(`ptprf-cluster-stack`, this.stackConfig, {
        vpc: this.vpcLegacy.vpcConstruct,
      }),
      sopsData: this.sopsData,
      clusterConfiguration: UobPerfEnvConfiguration.configuration.ptprf,
    });

    tprfCluster.instances.forEach((obj): void => {
      new Route53Attachment({
        requestingStack: tprfCluster.stack,
        recordType: 'A',
        dnsName: `${obj.hostname}.${this.stackConfig.envSubdomain}`,
        awsPrivateIpOrPrivateDns: [obj.instance.instanceResource.privateIp],
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      });
    });

    const oracleUobEeDbStack = new DfOracleDatabaseStack(
      'oracle-instance-ee',
      this.stackConfig,
      {
        id: 'uob-01',
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 4000,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.m6i.4xlarge',
        performanceInsightsEnabled: true,
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
        additionalOptions: [
          {
            optionName: 'STATSPACK',
          },
        ],
      }
    );

    const stprfDbStack = new DfOracleDatabaseStack(
      'stprf-oracle-instance-ee',
      this.stackConfig,
      {
        id: 'stprf-uob-01',
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-ee',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 4000,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.m6i.4xlarge',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'stprf-uob-oracle-ee-19',
          family: 'oracle-ee-19',
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

    // Temporarily stopped in RDS console
    const oracleDbStackBlue = new DfOracleDatabaseStack(
      'OracleInstance-blue',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-OracleInstance-Blue`.toLowerCase(),
        subnetIds: this.vpcLegacy.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 3500,
        vpcResource: this.vpcLegacy.vpcConstruct,
        instanceClass: 'db.m5.4xlarge',
        performanceInsightsEnabled: true,
        snapshotIdentifier: 'performance-2023-03-27-backup',
        parameterGroupConfig: {
          name: 'uob-oracle-se2-19-blue',
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
      requestingStack: oracleDbStackBlue,
      recordType: 'CNAME',
      dnsName: 'uobxprforacle02.prf',
      awsPrivateIpOrPrivateDns: [
        oracleDbStackBlue.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new Route53Attachment({
      requestingStack: oracleUobEeDbStack,
      recordType: 'CNAME',
      dnsName: 'uobxprforacle01.prf',
      awsPrivateIpOrPrivateDns: [
        oracleUobEeDbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    new Route53Attachment({
      requestingStack: stprfDbStack,
      recordType: 'CNAME',
      dnsName: 'stprforacle01.prf',
      awsPrivateIpOrPrivateDns: [stprfDbStack.oracleDbInstanceResource.address],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

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
        upfRoute53Name: 'uobxprfupfrp.prf',
        upfDbConfig: UpfPerformanceDbConfig.configuration.upf01,
        dockerPushRoleAssumption:
          PerformanceEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: `${this.stackConfig.envName}-OracleUpdInstance`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new UPFReverseProxyStack(
      'stprfUpfReverseProxy',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'stprfupfrp.prf',
        upfDbConfig: UpfPerformanceDbConfig.configuration.upf02,
        dockerPushRoleAssumption:
          PerformanceEnvironment.dockerPushRoleAssumption,
        remoteStack: uobHelper,
        useNewNaming: false,
        oracleStackShell: uobHelper,
        oracleStackName: `${this.stackConfig.envName}-StprfOracleUpdInstance`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new UPFReverseProxyStack(
      'ptprfUpfReverseProxy',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcLegacy.vpcConstruct,
        upfRoute53Name: 'ptprfupfrp.prf',
        upfDbConfig: UpfPerformanceDbConfig.configuration.upf03,
        dockerPushRoleAssumption:
          PerformanceEnvironment.dockerPushRoleAssumption,
        remoteStack: uobHelper,
        useNewNaming: false,
        oracleStackShell: uobHelper,
        oracleStackName: `${this.stackConfig.envName}-ptprfOracleUpdInstance`,
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    // Create ALB
    const uobWebAlbStack = new RemoteStack(
      'InternalWebAlbShell',
      this.stackConfig
    );

    new DfAlb('uobWeb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: tprfCluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: 'uobxprfweb.prf',
        stackShell: uobWebAlbStack,
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

    new DfAlb('stprfprfweb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: stprfCluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: 'stprfprfweb.prf',
        stackShell: uobWebAlbStack,
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

    new DfAlb('ptprfprfweb', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      instancesForTargetGroup: ptprfCluster.getInstancesByTier('web'),
      enableHttp2: false,
      dfAlbProps: {
        internal: true,
        subDomain: 'ptprfprfweb.prf',
        stackShell: uobWebAlbStack,
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

    const psqlRds01 = uobHelper.createPsqlRdsInstance({
      vpc: this.vpcLegacy.vpcConstruct,
      rdsInstanceName: `${this.stackConfig.envName}-PSQLInstance`.toLowerCase(),
      dbVersion: '14.8',
      allocatedStorage: 3500,
      instanceClass: 'db.m7g.4xlarge',
      dbName: 'dbtprf',
      username: this.sopsData.RDS_CONFIG_CREDS.testingStack.username,
      password: this.sopsData.RDS_CONFIG_CREDS.testingStack.password,
      allowedCidrBlocks: [
        this.vpcLegacy.vpcConstruct.vpcCidrBlock,
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr,
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr,
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr,
        DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
      ],
      iops: 12000,
      autoMinorVersionUpgrade: false,
      paramaterGroupConfig: {
        name: 'psql-parameter-group',
        family: 'postgres14',
        parameter: [
          {
            name: 'session_replication_role',
            value: 'replica',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'log_statement',
            value: 'mod',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'log_min_duration_statement',
            value: '0',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'log_temp_files',
            value: '4000',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'client_min_messages',
            value: 'LOG',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'work_mem',
            value: '12000',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'temp_buffers',
            value: '4000',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'synchronous_commit',
            value: 'OFF',
            applyMethod: 'pending-reboot',
          },
          {
            name: 'max_prepared_transactions',
            value: '100',
            applyMethod: 'pending-reboot',
          },
        ],
      },
      dbDnsName: 'uobxqepsql01.prf',
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
      performanceInsightsEnabled: true,
    });

    new Route53Attachment({
      requestingStack: uobHelper,
      recordType: 'CNAME',
      dnsName: 'uobxqepsql01.prf',
      awsPrivateIpOrPrivateDns: [psqlRds01.dbResource.address],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  /**
   *
   * Singleton constructor for the PerformanceEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {PerformanceEnvironment}
   *
   */
  public static getInstance(app: App): PerformanceEnvironment {
    if (!PerformanceEnvironment.instance) {
      PerformanceEnvironment.instance = new PerformanceEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getPerfAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getPerfAccountDef().vpcCidrs.main.recovery,
        envName: 'performance',
        envTier: 'dev',
        sharedSpoke: false,
        vpcCidrLegacy: DfAccounts.getPerfAccountDef().vpcCidrs.main.legacy,
        vpcLegacyStackPrefix: 'performance',
      });
      PerformanceEnvironment.instance.deployStacks();
    }

    return PerformanceEnvironment.instance;
  }
}
