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
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import ToolsEnvironment from './environment.tools';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import SharedUatEnvironment from './environment.sharedUat';
import { UobMuobUatEnvConfiguration } from '../uobEnvConfigurations/uat/uobMuobUatEnvConfiguration';
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfMuobUatDbConfig } from '../upfDbConfigurations/upfMuobUatDbConfig';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/**
 * muobander Uat Env
 */
export default class MuobUatEnvironment extends NetworkableEnvironment {
  private static instance: MuobUatEnvironment;

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
      targetAccountId: MuobUatEnvironment.ACCOUNT_ID,
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
        DfAccounts.customers.muob.customerName
      );
    const muobUatHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      customerObjectSubnet: customerSubnets,
      secretKeyConfgs: [
        {
          name: 'FNBO',
          numberOfPrivateKeys: 1,
          numberOfPublicKeys: 2,
        },
        {
          name: 'SVB',
          numberOfPrivateKeys: 2,
          numberOfPublicKeys: 3,
        },
        {
          name: 'Mizuho',
          numberOfPrivateKeys: 0,
          numberOfPublicKeys: 1,
        },
      ],
      ansibleVars: {
        privateKeySsmParameterName: 'muob-uat-uobKeyPair-private-key',
        prodServiceAccounts: false,
        sharedBuildKeyParameterName: 'shared-uat-bld-pub-key',
        upfDatabaseFqdns: UpfMuobUatDbConfig.upfFQDNS(),
      },
    });

    new SsmParameter(muobUatHelper, 'shared-uat-bld-key', {
      provider: muobUatHelper.primaryProvider,
      name: `shared-uat-bld-pub-key`,
      type: 'SecureString',
      value: SharedUatEnvironment.getInstance(this.app).lookupBuildKey(
        muobUatHelper,
        'muobUat-bld-lookup'
      ),
    });

    muobUatHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'muob-uat-uobKeyPair',
    });

    muobUatHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    muobUatHelper.createUobEfs({
      constructName: 'muob-uat-uob',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    const clusters: { [key: string]: UobCluster } = {};

    Object.entries(UobMuobUatEnvConfiguration.configuration).map(
      ([clusterId, v]) => {
        clusters[clusterId] = new UobCluster({
          helper: muobUatHelper,
          uobStack: new UobStack(
            `${v.properties.clusterName}-stack`,
            this.stackConfig,
            {
              vpc: this.vpcPrimary.vpcConstruct,
            },
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
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
      }
    );

    new DfAlb(
      'muobUat-px-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: clusters['muobUat']
          .getInstancesByTier('rt')
          .slice(0, 2),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `muobpx.${MuobUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: clusters['muobUat'].stack,
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
      'muobu2-web-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup:
          clusters['muobu2Uat'].getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `muobu2.${MuobUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: clusters['muobu2Uat'].stack,
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

    const dbmuobu1Stack = new DfOracleDatabaseStack(
      'DBMUOBU1',
      this.stackConfig,
      {
        id: 'dbmuobu1'.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 500,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        optionGroupName: 'dbmuobu1-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'dbmuobu1-uat-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
        dbName: 'DBMUOB',
        sopsDbProperty: 'dbmuobu1',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: dbmuobu1Stack,
      recordType: 'CNAME',
      dnsName: 'dbmuobu1.uat',
      awsPrivateIpOrPrivateDns: [
        dbmuobu1Stack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell1 = new RemoteStack('upf-muob-uat-01-rp', this.stackConfig);
    const oracleStackShell1 = new RemoteStack(
      'muobUat-upf-01',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-muob-uat-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup1muob1u1rp.uat',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf01,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: 'muobUat-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell2 = new RemoteStack('upf-muob-uat-02-rp', this.stackConfig);
    const oracleStackShell2 = new RemoteStack(
      'muobUat-upf-02',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-muob-uat-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup1muob2u1rp.uat',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf02,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell2,
        useNewNaming: true,
        oracleStackShell: oracleStackShell2,
        oracleStackName: 'muobUat-upf-02',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell3 = new RemoteStack('upf-muob-uat-03-rp', this.stackConfig);
    const oracleStackShell3 = new RemoteStack(
      'muobUat-upf-03',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-muob-uat-03-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup2muob1u1rp.uat',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf03,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell3,
        useNewNaming: true,
        oracleStackShell: oracleStackShell3,
        oracleStackName: 'muobUat-upf-03',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell4 = new RemoteStack('upf-muob-uat-04-rp', this.stackConfig);
    const oracleStackShell4 = new RemoteStack(
      'muobUat-upf-04',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-muob-uat-04-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup2muob2u1rp.uat',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf04,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell4,
        useNewNaming: true,
        oracleStackShell: oracleStackShell4,
        oracleStackName: 'muobUat-upf-04',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    // * MUOBU2 DBs
    const dbmuobu2Stack = new DfOracleDatabaseStack(
      'DBMUOBU2',
      this.stackConfig,
      {
        id: 'dbmuobu2'.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 3500,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.m5.4xlarge',
        performanceInsightsEnabled: true,
        optionGroupName: 'dbmuobu2-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'dbmuobu2-uat-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
        dbName: 'DBMUOB',
        sopsDbProperty: 'dbmuobu2',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: dbmuobu2Stack,
      recordType: 'CNAME',
      dnsName: 'dbmuobu2.uat',
      awsPrivateIpOrPrivateDns: [
        dbmuobu2Stack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    // * MUOBU3 DBs
    const dbmuobu3Stack = new DfOracleDatabaseStack(
      'DBMUOBU3',
      this.stackConfig,
      {
        id: 'dbmuobu3'.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        optionGroupName: 'dbmuobu3-option-group-est'.toLowerCase(),
        timezone: 'America/New_York',
        parameterGroupConfig: {
          name: 'dbmuobu3-uat-se2-19',
          family: 'oracle-se2-19',
          parameter: [
            {
              name: 'open_cursors',
              value: '2000',
            },
          ],
        },
        createBucket: false,
        dbName: 'DBMUOB',
        sopsDbProperty: 'dbmuobu3',
        prodCustomerData: true,
        additionalSgCidrBlocks: [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: dbmuobu3Stack,
      recordType: 'CNAME',
      dnsName: 'dbmuobu3.uat',
      awsPrivateIpOrPrivateDns: [
        dbmuobu3Stack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
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
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              kmsKeyId: clusters['muobUat'].stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'muobuatmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'muobuatmgr01.uat',
          envSubdomain: MuobUatEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
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
              kmsKeyId: clusters['muobu3Uat'].stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'muobu3wuatmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'muobu3wuatmgr01.uat',
          envSubdomain: MuobUatEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);

    const stackShell5 = new RemoteStack('upf-muobu3-01-rp', this.stackConfig);
    const oracleStackShell5 = new RemoteStack(
      'muobU3Uat-upf-01',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-muobu3-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup1muob1u3rp.uat',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf05,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell5,
        useNewNaming: true,
        oracleStackShell: oracleStackShell5,
        oracleStackName: 'muobU3Uat-upf-01',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const stackShell6 = new RemoteStack('upf-muobu3-02-rp', this.stackConfig);
    const oracleStackShell6 = new RemoteStack(
      'muobU3at-upf-02',
      this.stackConfig
    );
    new UPFReverseProxyStack(
      'upf-muobu3-02-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup1muob2u3rp.uat',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf06,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell6,
        useNewNaming: true,
        oracleStackShell: oracleStackShell6,
        oracleStackName: 'muobU3at-upf-02',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new UPFReverseProxyStack(
      'upf-muobu4-01-rp',
      this.stackConfig,
      {
        remoteStack: muobUatHelper,
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup1muob1u4rp.ist',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf07,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new UPFReverseProxyStack(
      'upf-muobu4-02-rp',
      this.stackConfig,
      {
        remoteStack: muobUatHelper,
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbup2muob1u4rp.ist',
        upfDbConfig: UpfMuobUatDbConfig.configuration.upf08,
        dockerPushRoleAssumption: MuobUatEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   * Integrates EWB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('MuobVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'muobUat';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${MuobUatEnvironment.ACCOUNT_ID}:role/${MuobUatEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_MUOB_UAT;
  }

  /**
   *
   * Singleton constructor for the EwbUatEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {muobUatEnvironment}
   *
   */
  public static getInstance(app: App): MuobUatEnvironment {
    if (!MuobUatEnvironment.instance) {
      MuobUatEnvironment.instance = new MuobUatEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getMuobUatAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getMuobUatAccountDef().vpcCidrs.main.recovery,
        envName: MuobUatEnvironment.ENVIRONMENT_NAME,
        envTier: 'uat',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'uat',
      });
      MuobUatEnvironment.instance.deployStacks();
    }

    return MuobUatEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
