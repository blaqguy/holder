import {
  DfAnsibleStateManagerAssociation,
  DfBackupResourcesStack,
  DfBuildAutomationRoleStack,
  DfInventoryStack,
  DfSpokeVpcStack,
  DfVantaIntegrationStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  DfWindowsS1AgentStack,
  MoveitAssociationStack,
  MoveitServiceStack,
  RemoteStack,
  Uc4AutomationStack,
  UobCluster,
  UobHelperStack,
  UobStack,
  WindowsWorkstationStack,
  MicrosoftOutboundResolver,
} from '@dragonfly/stacks';
import {
  App,
  DataTerraformRemoteStateS3,
  TerraformOutput,
  TerraformStack,
} from 'cdktf';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import SharedNetworkEnvironment from './environment.sharedNetwork';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import ToolsEnvironment from './environment.tools';
import MasterEnvironment from './environment.master';
import { UobSharedProdEnvConfiguration } from '../uobEnvConfigurations/prod/uobSharedProdEnvConfiguration';
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';

/** Shared Prod Environment */
export default class SharedProdEnvironment extends NetworkableEnvironment {
  private static instance: SharedProdEnvironment;
  private sharedProdVpcPrimary: DfSpokeVpcStack;
  private sharedProdVpcRecovery: DfSpokeVpcStack;
  private prodUobHelper: UobHelperStack;
  protected vpcMap: {
    [x: string]: DfSpokeVpcStack;
  };
  private sharedDirectoryIds: {
    [x: string]: string;
  };

  private sharedProdCluster: UobCluster;
  private outboundResolver: MicrosoftOutboundResolver;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();
    this.createVpcs();
    this.createUc4();
    this.createResolver();
    this.createMoveitService();
    this.createSharedUobResources();

    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );
    new DfVantaIntegrationStack('Vanta', this.stackConfig);

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
   * Creates the VPCs for the environment
   */
  private createVpcs(): void {
    this.vpcMap = {
      [Constants.AWS_REGION_MAP.DFPRIMARY]: this.vpcPrimary,
      [Constants.AWS_REGION_MAP.DFRECOVERY]: this.vpcRecovery,
    };
  }

  /**
   *
   */
  private createUc4(): void {
    const uc4AutomationStack = new Uc4AutomationStack(
      'uc4-primary-stack',
      this.stackConfig,
      {
        vpcMap: this.vpcMap,
        route53Config: {
          dbDnsName: 'uc4-prod-aurora-postgres',
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        },
        enableReplica: true,
        activeRegion: Constants.AWS_REGION_MAP.DFPRIMARY,
        engineVersion: '14.9',
      }
    );

    new DfAlb(
      'uc4-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: uc4AutomationStack.webInterfaces,
        recoveryInstancesForTargetGroup:
          uc4AutomationStack.recoveryWebInterfaces,
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: 'uc4.prod',
          stackShell: uc4AutomationStack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 8080,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/',
            healthCheckPort: '8080',
            healthCheckProtocol: 'HTTP',
            healthCheckInterval: 10,
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
        activeRegion: 'default',
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   *
   */
  private createResolver(): void {
    this.outboundResolver = new MicrosoftOutboundResolver({
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
      targetAccountId: SharedProdEnvironment.ACCOUNT_ID,
    });

    this.sharedDirectoryIds = {
      [Constants.AWS_REGION_MAP.DFPRIMARY]:
        this.outboundResolver.primarySharedDirectoryId,
    };
  }

  /**
   * This method deploys the MOVEit service and agent stacks
   */
  private createMoveitService() {
    const ingressCidrBlocks: string[] = [];
    for (const value of Object.values(DfAccounts.getAccounts())) {
      if (
        value.organizationalUnit === Constants.OU_ID_MAP[Constants.PROD_OU_ID]
      ) {
        ingressCidrBlocks.push(value.vpcCidrs.main.primary);
        ingressCidrBlocks.push(value.vpcCidrs.main.recovery);
      }
    }

    const moveitServiceStack = new MoveitServiceStack(
      'moveit-service-stack',
      this.stackConfig,
      {
        vpcMap: this.vpcMap,
        prodDeploy: true,
        masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
        sharedNetworkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
        networkInstanceS3BackendProps:
          SharedNetworkEnvironment.regionalNetworkConfig(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ).s3BackendProps,
        recoveryNetworkInstanceS3BackendProps:
          SharedNetworkEnvironment.regionalNetworkConfig(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ).s3BackendProps,
        ingressCidrBlocks: ingressCidrBlocks,
        multiRegion: true,
        kmsNameOverride: 'move-it-sql-server-key-multi-regional',
      }
    );

    new MoveitAssociationStack(
      'moveit-agent-stack',
      this.stackConfig,
      this.vpcMap,
      {
        directoryIds: {
          primary: this.outboundResolver.primarySharedDirectoryId,
          recovery: this.outboundResolver.recoverySharedDirectoryId,
        },
        moveitStack: moveitServiceStack,
      }
    );

    const albStackShell = new RemoteStack(
      'InternalMoveitAlbShell',
      this.stackConfig
    );

    new DfAlb(
      'moveit-transfer-alb-primary',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup: moveitServiceStack.primaryTransferServersList,
        recoveryInstancesForTargetGroup:
          moveitServiceStack.recoveryTransferServersList,
        dfAlbProps: {
          internal: true,
          subDomain: 'move-it.prod',
          stackShell: albStackShell,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 443,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/',
            healthCheckPort: '443',
            healthCheckProtocol: 'HTTPS',
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
      'moveit-automation-alb-primary',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup:
          moveitServiceStack.primaryAutomationServersList,
        recoveryInstancesForTargetGroup:
          moveitServiceStack.recoveryAutomationServersList,
        dfAlbProps: {
          internal: true,
          subDomain: 'moveit-automation.prod',
          stackShell: albStackShell,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 80,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/',
            healthCheckPort: '443',
            healthCheckProtocol: 'HTTPS',
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
   * This method deploys the shared Uob Resources
   */
  private createSharedUobResources() {
    this.prodUobHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      clusterType: 'uob',
      uobReplicaConfig: {
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        replicateKey: true,
      },
      ansibleVars: {
        privateKeySsmParameterName: 'shared-bld-01-private-key',
        prodServiceAccounts: false,
      },
    });

    this.prodUobHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    this.prodUobHelper.createUobEfs({
      constructName: 'UOB',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    this.prodUobHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'shared-bld-01',
    });

    const sharedProdClusterStack = new UobStack(
      `shared-prod-cluster-stack`,
      this.stackConfig,
      {
        primaryVpc: this.vpcPrimary.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    this.sharedProdCluster = new UobCluster({
      helper: this.prodUobHelper,
      uobStack: sharedProdClusterStack,
      sopsData: this.sopsData,
      clusterConfiguration:
        UobSharedProdEnvConfiguration.configuration.sharedProd,
    });

    new TerraformOutput(
      this.sharedProdCluster.stack,
      'SHARED_PROD_BLD_PUB_KEY',
      {
        value: this.prodUobHelper.uobInstanceKeyConstruct.getPubKey(),
        sensitive: true,
      }
    );
    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default'],
          instanceType: 't3.large',
          rootBlockDevice: {
            volumeSize: 100,
            encrypted: true,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobwprodmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwprodmgr01.prod',
          envSubdomain: SharedProdEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.WINDOWS_2022_DEFAULT_V4
          ],
          instanceType: 't3.2xlarge',
          rootBlockDevice: {
            volumeSize: 50,
            encrypted: true,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 250,
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobwprodmgr02',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwprodmgr02.prod',
          envSubdomain: SharedProdEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);
  }

  /**
   * @return {string}
   */
  public static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_SHARED_PROD;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'sharedProd';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'prod';
  }

  /**
   * @return {string}
   */
  private static get dockerPushRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${SharedProdEnvironment.ACCOUNT_ID}:role/${SharedProdEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name DockerPush \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text)) 
    `;
  }

  /**
   * @return {string}
   */
  public static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @return {AccountProviderConfig}
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: SharedProdEnvironment.ACCOUNT_ID,
      accountName: SharedProdEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: SharedProdEnvironment.PROVIDER_ROLE_NAME,
    };
  }

  /**
   *
   * Singleton constructor for the SharedProd class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {SharedProdEnvironment}
   *
   */
  public static getInstance(app: App): SharedProdEnvironment {
    if (!SharedProdEnvironment.instance) {
      SharedProdEnvironment.instance = new SharedProdEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
        envName: SharedProdEnvironment.ENVIRONMENT_NAME,
        envTier: 'prod',
        sharedSpoke: true,
        spokeVpcStackPrefix: 'prod',
        recoverySpokeVpcStackPrefix: 'prod',
        isRecoverySpelledWrong: true,
      });
      SharedProdEnvironment.instance.deployStacks();
    }

    return SharedProdEnvironment.instance;
  }

  /**
   *
   * @param {RemoteStack}requestingStack
   * @param {string} id
   * @return {string}
   */
  public lookupBuildKey(requestingStack: RemoteStack, id: string) {
    return new DataTerraformRemoteStateS3(
      requestingStack,
      id,
      this.sharedProdCluster.stack.s3BackendPropsResource()
    ).getString('SHARED_PROD_BLD_PUB_KEY');
  }
}
