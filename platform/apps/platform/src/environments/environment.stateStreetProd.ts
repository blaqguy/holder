import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { App, TerraformStack } from 'cdktf';
import {
  DfAssociationConfig,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfConfigManagementStack,
  DfInventoryStack,
  DfOracleDatabaseStack,
  DfVantaIntegrationStack,
  RemoteStack,
  UPFReverseProxyStack,
  UobCluster,
  UobHelperStack,
  UobStack,
} from '@dragonfly/stacks';
import { NetworkableEnvironment } from './networkableEnvironment';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import SharedProdEnvironment from './environment.sharedProd';
import { UobStateStreetProdEnvConfiguration } from '../uobEnvConfigurations/prod/uobStateStreetProdEnvConfiguration';
import LogArchiveEnvironment from './environment.logArchive';
import { UpfStateStreetProdDbConfig } from '../upfDbConfigurations/upfStateStreetProdDbConfig';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';

/** State Street Prod Env */
export default class StateStreetProdEnvironment extends NetworkableEnvironment {
  private static instance: StateStreetProdEnvironment;

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

    return this.handler;
  }

  /**
   * Creates the UOB Cluster
   */
  private createUobCluster() {
    const stateStreetProdUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
    });

    new SsmParameter(stateStreetProdUobHelper, 'shared-prod-bld-key', {
      provider: stateStreetProdUobHelper.primaryProvider,
      name: `shared-prod-bld-pub-key`,
      type: 'SecureString',
      value: SharedProdEnvironment.getInstance(this.app).lookupBuildKey(
        stateStreetProdUobHelper,
        'stateStreetProd-bld-lookup'
      ),
      tags: { Name: 'shared-prod-bld-pub-key' },
    });

    stateStreetProdUobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'state-street-prod-uobKeyPair',
    });

    stateStreetProdUobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    stateStreetProdUobHelper.createUobEfs({
      constructName: 'state-street-prod-uob',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    const stateStreetProd01Cluster = new UobCluster({
      helper: stateStreetProdUobHelper,
      uobStack: new UobStack(
        `stateStreetProd01-cluster-stack`,
        this.stackConfig,
        {
          vpc: this.vpcPrimary.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration:
        UobStateStreetProdEnvConfiguration.configuration.stateStreetProd,
    });

    const clusters: UobCluster[] = [stateStreetProd01Cluster];

    const associationConfigs: DfAssociationConfig[] = clusters.map(
      (cluster) => {
        return {
          instanceRoles: [stateStreetProdUobHelper.uobInstanceRole],
          fiName: cluster.fiName,
          clusterName: cluster.clusterName,
          tierConfigs: cluster.tiers.map((tier) => {
            return {
              tierName: tier.tierName,
              targetInstanceIds: cluster.getInstanceIdsByTier(tier.tierName),
            };
          }),
          ansibleTemplateVersion: 'aod',
        };
      }
    );

    new DfConfigManagementStack(
      'config-management',
      this.stackConfig,
      associationConfigs,
      {
        sub_domain:
          stateStreetProdUobHelper.standardUobUserdataParams.sub_domain,
        vpc_cidr:
          DfAccounts.getStateStreetProdAccountDef().vpcCidrs.main.primary,
        us_finame_pw:
          this.sopsData.PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS.app.usfiname,
        efs_name: `${stateStreetProdUobHelper.uobEfs.node.id}-Efs`,
        key_pair_name:
          stateStreetProdUobHelper.standardUobUserdataParams.key_pair_name,
        private_key_parameter_name:
          stateStreetProdUobHelper.uobInstanceKeyConstruct.keyPairParameter
            .nameInput,
        build_key_name: 'shared-prod-bld-pub-key',
        mqm_pw: this.sopsData.PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS.mq.mqm,
        usrsvs_pw: this.sopsData.PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS.msi.usrsvs,
        usrrpt_pw: this.sopsData.PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS.rpt.usrrpt,
        ihsadmin_pw:
          this.sopsData.PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS.web.ihsadmin,
        jenkins_secret: this.sopsData.JENKINS_SECRET.sharedProd,
        jenkins_url: `https://jenkins.dragonflyft.com`,
        datadog_api_key: this.sopsData.DD_API_KEY,
        s1_api_key: this.sopsData.SENTINEL_ONE.api_key,
        s1_site_token: this.sopsData.SENTINEL_ONE.site_token,
        region: Constants.AWS_REGION_MAP.DFPRIMARY,
        stop_datadog_agent: true,
        upf_database_fqdns: UpfStateStreetProdDbConfig.upfFQDNS(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    const oracleDbStack = new DfOracleDatabaseStack(
      'OracleInstance',
      this.stackConfig,
      {
        id: `${this.stackConfig.envName}-OracleInstance`.toLowerCase(),
        subnetIds: this.vpcPrimary.vpcConstruct.dataSubnetIds,
        engine: 'oracle-se2',
        engineVersion: '19',
        storageType: 'gp3',
        allocatedStorage: 250,
        vpcResource: this.vpcPrimary.vpcConstruct,
        instanceClass: 'db.t3.medium',
        performanceInsightsEnabled: true,
        parameterGroupConfig: {
          name: 'uob-oracle-se2-19',
          family: 'oracle-se2-19',
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
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
        ],
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new Route53Attachment({
      requestingStack: oracleDbStack,
      recordType: 'CNAME',
      dnsName: `dbssk.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [
        oracleDbStack.oracleDbInstanceResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const stackShell1 = new RemoteStack('upf-01-rp', this.stackConfig);
    const oracleStackShell1 = new RemoteStack('upf-01-db', this.stackConfig);
    new UPFReverseProxyStack(
      'upf-01-rp',
      this.stackConfig,
      {
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfDbConfig: UpfStateStreetProdDbConfig.configuration.upf01,
        upfRoute53Name: 'dbu1ssu3.prod',
        dockerPushRoleAssumption:
          StateStreetProdEnvironment.dockerPushRoleAssumption,
        remoteStack: stackShell1,
        useNewNaming: true,
        oracleStackShell: oracleStackShell1,
        oracleStackName: 'upf-01-db',
        accountProviderConfig: SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   * Creates the UOB Cluster
   */
  // private createUobCluster() {
  // }

  /**
   * Integrates StateStreet Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('StateStreetVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return Constants.ENVIRONMENT_NAME_STATE_STREET_PROD;
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${StateStreetProdEnvironment.ACCOUNT_ID}:role/${StateStreetProdEnvironment.PROVIDER_ROLE_NAME} \
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
    return Constants.ACCOUNT_NUMBER_STATE_STREET_PROD;
  }

  /**
   *
   * Singleton constructor for the StateStreetProdEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {StateStreetProdEnvironment}
   *
   */
  public static getInstance(app: App): StateStreetProdEnvironment {
    if (!StateStreetProdEnvironment.instance) {
      StateStreetProdEnvironment.instance = new StateStreetProdEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getStateStreetProdAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getStateStreetProdAccountDef().vpcCidrs.main.recovery,
        envName: 'stateStreet',
        envTier: 'prod',
        sharedSpoke: false,
      });
      StateStreetProdEnvironment.instance.deployStacks();
    }

    return StateStreetProdEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }
}
