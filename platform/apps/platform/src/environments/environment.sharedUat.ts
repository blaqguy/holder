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
import { UobSharedUatEnvConfiguration } from '../uobEnvConfigurations/uat/uobSharedUatEnvConfiguration';
import MasterEnvironment from './environment.master';
import { NetworkableEnvironment } from './networkableEnvironment';
import LogArchiveEnvironment from './environment.logArchive';
import { CustomerObjectSubnet } from '@dragonfly/constructs';

/** Shared UAT Environment */
export default class SharedUatEnvironment extends NetworkableEnvironment {
  private static instance: SharedUatEnvironment;
  protected vpcMap: {
    [x: string]: DfSpokeVpcStack;
  };
  private sharedDirectoryIds: {
    [x: string]: string;
  };

  private sharedUatCluster: UobCluster;
  private sharedUatHelper: UobHelperStack;
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
          dbDnsName: 'uc4-uat-aurora-postgres.uat',
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        },
        enableReplica: true,
        activeRegion: Constants.AWS_REGION_MAP.DFPRIMARY,
        engineVersion: '14.5',
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
          subDomain: 'uc4.uat',
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
          createR53Record:
            uc4AutomationStack.activeRegion ===
            Constants.AWS_REGION_MAP.DFPRIMARY,
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
      targetAccountId: SharedUatEnvironment.ACCOUNT_ID,
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
        value.organizationalUnit == Constants.OU_ID_MAP[Constants.UAT_OU_ID]
      ) {
        ingressCidrBlocks.push(value.vpcCidrs.main.primary);
      }
    }
    const moveitServiceStack = new MoveitServiceStack(
      'moveit-service-stack',
      this.stackConfig,
      {
        vpcMap: this.vpcMap,
        prodDeploy: false,
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
          subDomain: 'move-it.uat',
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
          subDomain: 'moveit-automation.uat',
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
    const customerSubnets: CustomerObjectSubnet[] =
      SharedNetworkEnvironment.getInstance(
        this.app
      ).primaryNetwork.getClientObjectSubnetByCustomerName(
        DfAccounts.customers.shared.customerName
      );

    this.sharedUatHelper = new UobHelperStack(this.stackConfig, {
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      customerObjectSubnet: customerSubnets,
      uobReplicaConfig: {
        recoveryVpc: this.vpcRecovery.vpcConstruct,
      },
      ansibleVars: {
        privateKeySsmParameterName: 'shared-bld-01-private-key',
        prodServiceAccounts: false,
      },
    });

    this.sharedUatHelper.createUobInstanceRole({
      resourceName: 'uob-iam-role',
      envName: this.stackConfig.envName,
    });

    this.sharedUatHelper.createUobEfs({
      constructName: 'UOB',
      vpc: this.vpcPrimary.vpcConstruct,
    });

    this.sharedUatHelper.createUobInstanceKey({
      keyName: 'uobKeyPair',
      constructName: 'shared-bld-01',
    });

    const sharedUatClusterStack = new UobStack(
      `shared-uat-cluster-stack`,
      this.stackConfig,
      {
        primaryVpc: this.vpcPrimary.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
    this.sharedUatCluster = new UobCluster({
      helper: this.sharedUatHelper,
      uobStack: sharedUatClusterStack,
      sopsData: this.sopsData,
      clusterConfiguration:
        UobSharedUatEnvConfiguration.configuration.sharedUat,
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
      customerDefinition: DfAccounts.customers.shared,
    });

    new TerraformOutput(this.sharedUatCluster.stack, 'SHARED_UAT_BLD_PUB_KEY', {
      value: this.sharedUatHelper.uobInstanceKeyConstruct.getPubKey(),
      sensitive: true,
    });

    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2019-default'],
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
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobwuatmgr01',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwuatmgr01.uat',
          envSubdomain: SharedUatEnvironment.ENVIRONMENT_SUBDOMAIN,
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
            },
          ],
          keyName: 'uobKeyPair',
          tags: {
            Name: 'uobwuatmgr02',
          },
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'uobwuatmgr02.uat',
          envSubdomain: SharedUatEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
      },
    ]);

    new DfAlb(
      'sharedUat-ewbu1-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup:
          this.sharedUatCluster.getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `eastwestbanku1.${SharedUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: sharedUatClusterStack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 30103,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/',
            healthCheckPort: '30103',
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
      'sharedUat-ewbu2-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup:
          this.sharedUatCluster.getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `eastwestbanku2.${SharedUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: sharedUatClusterStack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 30102,
            targetGroupProtocol: 'HTTPS',
            healthCheckPath: '/',
            healthCheckPort: '30102',
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
      'sharedUat-ewbu3-alb',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        instancesForTargetGroup:
          this.sharedUatCluster.getInstancesByTier('web'),
        enableHttp2: false,
        dfAlbProps: {
          internal: true,
          subDomain: `eastwestbanku3.${SharedUatEnvironment.ENVIRONMENT_SUBDOMAIN}`,
          stackShell: sharedUatClusterStack,
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
  }

  /**
   * @return {string}
   */
  public static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_SHARED_UAT;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'shareduat';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'uat';
  }

  /**
   * @return {string}
   */
  private static get dockerPushRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${SharedUatEnvironment.ACCOUNT_ID}:role/${SharedUatEnvironment.PROVIDER_ROLE_NAME} \
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
      accountId: SharedUatEnvironment.ACCOUNT_ID,
      accountName: SharedUatEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: SharedUatEnvironment.PROVIDER_ROLE_NAME,
    };
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
  public static getInstance(app: App): SharedUatEnvironment {
    if (!SharedUatEnvironment.instance) {
      SharedUatEnvironment.instance = new SharedUatEnvironment({
        app: app,
        vpcCidrPrimary:
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery:
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
        envName: SharedUatEnvironment.ENVIRONMENT_NAME,
        envTier: 'uat',
        sharedSpoke: true,
        spokeVpcStackPrefix: 'uat',
        recoverySpokeVpcStackPrefix: 'uat',
        isRecoverySpelledWrong: true,
      });
      SharedUatEnvironment.instance.deployStacks();
    }

    return SharedUatEnvironment.instance;
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
      this.sharedUatCluster.stack.s3BackendPropsResource()
    ).getString('SHARED_UAT_BLD_PUB_KEY');
  }
}
