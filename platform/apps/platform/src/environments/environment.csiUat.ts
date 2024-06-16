import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfVantaIntegrationStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfWindowsS1AgentStack,
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
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';
import { UobCsiEnvConfiguration } from '../uobEnvConfigurations/uat/uobCsiUatEnvConfiguration';
import { UpfCsiDbConfig } from '../upfDbConfigurations/upfCsiDbConfig';

/**
 * Csi Env
 */
export default class CsiUatEnvironment extends NetworkableEnvironment {
  private static instance: CsiUatEnvironment;

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

    this.createUobCluster();

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
      targetAccountId: CsiUatEnvironment.ACCOUNT_ID,
    });
  }

  /**
   * Integrates EWB Tenant with Vanta auditing platform
   */
  private vantaIntegration() {
    new DfVantaIntegrationStack('CsiUatVanta', this.stackConfig);
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return DfAccounts.getCsiUatAccountDef().name;
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
        export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role \
        --role-arn arn:aws:iam::${CsiUatEnvironment.ACCOUNT_ID}:role/${CsiUatEnvironment.PROVIDER_ROLE_NAME} \
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
    return DfAccounts.getCsiUatAccountDef().accountNumber;
  }

  /**
   *
   * Singleton constructor for the EwbUatEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {CsiUatEnvironment}
   *
   */
  public static getInstance(app: App): CsiUatEnvironment {
    if (!CsiUatEnvironment.instance) {
      CsiUatEnvironment.instance = new CsiUatEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getCsiUatAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getCsiUatAccountDef().vpcCidrs.main.recovery,
        envName: CsiUatEnvironment.ENVIRONMENT_NAME,
        envTier: 'uat',
        sharedSpoke: false,
      });
      CsiUatEnvironment.instance.deployStacks();
    }

    return CsiUatEnvironment.instance;
  }

  /**
   * Creates the UOB Cluster
   */
  private createUobCluster() {
    const csiUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      clusterType: 'uob',
      keyProps: {
        keyName: 'uobKeyPair',
        constructName: 'csi-uobKeyPair',
      },
      roleProps: {
        resourceName: 'uob-iam-role',
        envName: this.stackConfig.envName,
      },
      efsProps: {
        constructName: 'UOB',
        vpc: this.vpcPrimary.vpcConstruct,
      },
      ansibleVars: {
        prodServiceAccounts: false,
        upfDatabaseFqdns: UpfCsiDbConfig.upfFQDNS(),
      },
      createProdLikeResourcesNewWay: true,
    });

    const csi01Cluster = new UobCluster({
      helper: csiUobHelper,
      uobStack: new UobStack(
        `csi-01-cluster-stack`,
        this.stackConfig,
        {
          vpc: this.vpcPrimary.vpcConstruct,
        },
        Constants.AWS_REGION_ALIASES.DF_PRIMARY
      ),
      sopsData: this.sopsData,
      clusterConfiguration: UobCsiEnvConfiguration.configuration.csi,
    });

    new UPFReverseProxyStack(
      'csi-1-upf-rp',
      this.stackConfig,
      {
        remoteStack: csiUobHelper,
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu1csiu1rp.uat',
        upfDbConfig: UpfCsiDbConfig.configuration.upf01,
        dockerPushRoleAssumption: CsiUatEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new UPFReverseProxyStack(
      'csi-2-upf-rp',
      this.stackConfig,
      {
        remoteStack: csiUobHelper,
        clusterVpcConstruct: this.vpcPrimary.vpcConstruct,
        upfRoute53Name: 'dbu2csiu1rp.uat',
        upfDbConfig: UpfCsiDbConfig.configuration.upf02,
        dockerPushRoleAssumption: CsiUatEnvironment.dockerPushRoleAssumption,
        useNewNaming: false,
        useDynamicRoleName: true,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    // This is using a Linux AMI
    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'csiuatmgr01.uat',
          envSubdomain: CsiUatEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.WINDOWS_2022_DEFAULT_V4
          ],
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 100,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              kmsKeyId: csi01Cluster.stack.kmsEncryptionKey.id,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'csiuatmgr01',
            hostname: 'csiuatmgr01',
            'ansible-managed': 'false',
            application: 'WindowsManager',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
      },
    ]);
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
    // return 'AWSControlTowerExecution';
  }
}
