import {
  DfJenkinsStack,
  RemoteStack,
  DfBuildProcessStack,
  DfPrismaCloudIntegrationStack,
  DfSvnStack,
  DfAmiBuilderStack,
  DfSopsStack,
  DfCodeBuildCredentialStack,
  DfNexusStack,
  DfEcrDeployStack,
  DfNexusWorkStationStack,
  CyberArkStack,
  DfWindowsS1AgentStack,
  DfMicrosoftActiveDirectory,
  DfBackupResourcesStack,
  GitHubRunnerStack,
  DfAmiSharingStack,
  DfDms,
  DfFisheyeCrucibleStack,
  DfInventoryStack,
  DfSonarStack,
  DfNetworkSensorStack,
  DfWindowsNetworkSensorAgentInstallerBucketStack,
  DfWindowsNetworkSensorAgentAssociationStack,
  EbCrossAccountEfsShareBucketStack,
  DfPaloAltoPanorama,
  DfAnsibleStateManagerAssociation,
  MicrosoftOutboundResolver,
  DfFortiManager,
  DfNewRelicNetworkMonitorStack,
  DfLambdaAssetsBucketStack,
  WindowsWorkstationStack,
} from '@dragonfly/stacks';
import { App, S3BackendConfig, TerraformStack } from 'cdktf';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { default as SharedNetworkEnvironment } from './environment.sharedNetwork';
import { ToolsNetworkableEnvironment } from './toolsNetworkableEnvironment';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  Utils,
} from '@dragonfly/utils';
import { Route53Attachment } from '../crossEnvironmentHelpers/route53Attachment';
import MasterEnvironment from './environment.master';
import { DfPrivateInstanceConstruct } from '@dragonfly/constructs';
import LogArchiveEnvironment from './environment.logArchive';

/** Tools Environment */
export default class ToolsEnvironment extends ToolsNetworkableEnvironment {
  private microsoftActiveDirectory: DfMicrosoftActiveDirectory;
  private microsoftActiveDirectoryRecovery: DfMicrosoftActiveDirectory;
  private static instance: ToolsEnvironment;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();

    new DfInventoryStack(
      'inventory',
      this.stackConfig,
      LogArchiveEnvironment.getInstance(
        this.app
      ).crossAccountSsmInventoryBucketStack
    );

    // Jenkins in Legacy
    const jenkinsAlbStack = new RemoteStack(
      'InternalAlbShell',
      this.stackConfig
    );

    const jenkinsAlb = new DfAlb('jenkins', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      overrideDefaultRegion: true,
      deployHTTPS: true,
      dfAlbProps: {
        internal: true,
        subDomain: 'jenkins',
        stackShell: jenkinsAlbStack,
        vpc: this.vpcLegacy.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        targetGroupProps: {
          targetGroupPort: 8080,
          targetGroupProtocol: 'HTTP',
          healthCheckPath: '/login',
          healthCheckPort: '8080',
        },
        createR53Record: true,
      },
      app: this.app,
      networkAccountProviderConfig:
        Utils.getSharedNetworkAccountProviderConfig(),
    });

    const legacyJenkins = new DfJenkinsStack(
      DfJenkinsStack.STACK_ID,
      this.stackConfig,
      {
        spokeVpc: this.vpcLegacy.vpcConstruct,
        targetGroupArn: jenkinsAlb.targetGroupArn,
        albSgId: jenkinsAlb.albSgId,
        dockerPushRoleAssumption: ToolsEnvironment.dockerPushRoleAssumption,
        domainName: jenkinsAlb.r53RecordName,
        activeSecondaryUOBBuildInstances: 8,
        activeSecondaryEBBuildInstances: 1,
      },
      null
    );

    legacyJenkins.uobBuildServers.forEach(
      (instanceConstruct: DfPrivateInstanceConstruct, index: number) => {
        const instanceIndex = index < 9 ? `0${index + 1}` : `${index + 1}`;
        new Route53Attachment({
          requestingStack: legacyJenkins,
          recordType: 'A',
          dnsName: `uobxtoolswin${instanceIndex}.tools`,
          awsPrivateIpOrPrivateDns: [
            instanceConstruct.instanceResource.privateIp,
          ],
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        });
      }
    );

    legacyJenkins.ebBuildServers.forEach(
      (instanceConstruct: DfPrivateInstanceConstruct, index: number) => {
        const instanceIndex = index < 9 ? `0${index + 1}` : `${index + 1}`;
        new Route53Attachment({
          requestingStack: legacyJenkins,
          recordType: 'A',
          dnsName: `ebxtoolswin${instanceIndex}.tools`,
          awsPrivateIpOrPrivateDns: [
            instanceConstruct.instanceResource.privateIp,
          ],
          region: Constants.AWS_REGION_ALIASES.LEGACY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
        });
      }
    );

    // DMS Stacks
    new DfDms(this.stackConfig, {
      vpc: this.vpcPrimary.vpcConstruct,
      networkInstanceS3BackendProps:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ).s3BackendProps,
      instanceConfig: [
        {
          instanceType: 'dms.t3.medium',
          rootBlockVolumeSize: 150,
        },
        {
          instanceType: 'dms.t3.large',
          rootBlockVolumeSize: 200,
        },
        {
          instanceType: 'dms.c4.2xlarge',
          rootBlockVolumeSize: 400,
        },
      ],
      transitInstanceConfig: [
        {
          instanceType: 'dms.r4.2xlarge',
          rootBlockVolumeSize: 150,
        },
        {
          instanceType: 'dms.r4.2xlarge',
          rootBlockVolumeSize: 200,
        },
        {
          instanceType: 'dms.r4.2xlarge',
          rootBlockVolumeSize: 400,
        },
      ],
    });

    // Jenkins in Primary
    const jenkinsAlbPrimaryStack = new RemoteStack(
      'InternalAlbShellPrimary',
      this.stackConfig
    );

    const jenkinsAlbPrimary = new DfAlb(
      'jenkins-primary',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: 'jenkins-prod',
          stackShell: jenkinsAlbPrimaryStack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 8080,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/login',
            healthCheckPort: '8080',
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfJenkinsStack(
      `${DfJenkinsStack.STACK_ID}-primary`,
      this.stackConfig,
      {
        spokeVpc: this.vpcPrimary.vpcConstruct,
        targetGroupArn: jenkinsAlbPrimary.targetGroupArn,
        albSgId: jenkinsAlbPrimary.albSgId,
        dockerPushRoleAssumption: ToolsEnvironment.dockerPushRoleAssumption,
        domainName: jenkinsAlbPrimary.r53RecordName,
        activeSecondaryUOBBuildInstances: 0,
        activeSecondaryEBBuildInstances: 0,
      },
      'prod',
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfBuildProcessStack('build-process', this.stackConfig, {
      branch: 'master',
      platformSandboxDeploy: false,
    });

    new DfEcrDeployStack('codebuild-image', this.stackConfig, {
      servicePrincipal: 'codebuild.amazonaws.com',
    });

    new DfEcrDeployStack('sonarqube', this.stackConfig, {
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
    });

    new DfEcrDeployStack(
      Constants.INGRESS_NGINX_REVERSE_PROXY,
      this.stackConfig,
      {
        accountId: Constants.ACCOUNT_NUMBER_SHARED_NETWORK,
      }
    );

    new DfPrismaCloudIntegrationStack(this.stackConfig, {
      adminIntegration: false,
    });

    const svnStack = new DfSvnStack('svn-repo', this.stackConfig, {
      vpc: this.vpcLegacy,
      regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      sopsData: this.sopsData,
      masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
      sharedNetworkAccountProviderConfig:
        Utils.getSharedNetworkAccountProviderConfig(),
      networkInstanceS3BackendProps:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.LEGACY
        ).s3BackendProps,
    });

    new Route53Attachment({
      requestingStack: svnStack,
      recordType: 'A',
      dnsName: 'svn.tools',
      awsPrivateIpOrPrivateDns: [
        svnStack.svnInstanceConstruct.instanceResource.privateIp,
      ],
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const svnAlbStack = new RemoteStack(
      'svn-alb-stack-shell',
      this.stackConfig
    );

    new DfAlb(
      'svn',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.LEGACY
        ),
        instancesForTargetGroup: [svnStack.svnInstanceConstruct],
        deployHTTPS: true,
        overrideDefaultRegion: true,
        dfAlbProps: {
          internal: true,
          subDomain: 'svn-lb.tools',
          stackShell: svnAlbStack,
          vpc: this.vpcLegacy.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 80,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/',
            healthCheckPort: '80',
          },
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.LEGACY
    );

    new DfSopsStack('sops', this.stackConfig);

    // ! Codebuild only allows a single credential per given server type in a given region, deploy  this first.
    const codeBuildCredentialsStack = new DfCodeBuildCredentialStack(
      'toolsCodeBuildCredentials',
      this.stackConfig
    );

    new DfAmiBuilderStack(
      'amiBuilder',
      this.stackConfig,
      'https://github.com/dragonflyft/amibuilder.git',
      this.vpcLegacy.vpcConstruct,
      codeBuildCredentialsStack
    );

    // * There's currently no config stack in tools, deploying this as standalone
    new DfWindowsS1AgentStack('windows-s1-agent', this.stackConfig);

    new DfWindowsNetworkSensorAgentInstallerBucketStack(
      this.stackConfig,
      'network-sensor-windows-agent-upload',
      {
        regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      }
    );

    new DfWindowsNetworkSensorAgentAssociationStack(
      this.stackConfig,
      'network-sensor-windows-agent-association-primary-region',
      {
        regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      }
    );

    new DfWindowsNetworkSensorAgentAssociationStack(
      this.stackConfig,
      'network-sensor-windows-agent-association-legacy-region',
      {
        regionAlias: Constants.AWS_REGION_ALIASES.LEGACY,
      }
    );

    this.createNexus();
    this.createCyberArkProxies();
    this.createAd();
    this.createLambdaAssetsBuckets();
    this.createGithubRunners();
    new DfBackupResourcesStack('backup-resources', this.stackConfig, {
      additionalRegions: [Constants.AWS_REGION_ALIASES.LEGACY],
      enableColdStorage: false,
    });
    this.deployFisheyeCrucible();
    this.deployNetworkSensorStack();
    this.deployNewRelicNetworkMonitorStack();
    this.createWindowsWorkstation();

    const sonarAlbStack = new RemoteStack(
      'InternalSonarAlbShell',
      this.stackConfig
    );

    const sonarAlb = new DfAlb(
      'sonar',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: 'sonar',
          stackShell: sonarAlbStack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 9000,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/',
            healthCheckPort: '9000',
          },
          idleTimeout: 300,
          createR53Record: true,
        },
        app: this.app,
        networkAccountProviderConfig:
          Utils.getSharedNetworkAccountProviderConfig(),
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );

    new DfSonarStack('sonar-security', this.stackConfig, {
      vpc: this.vpcPrimary.vpcConstruct,
      rdsCredentials: {
        username: this.sopsData.RDS_CONFIG_CREDS.sonar.username,
        password: this.sopsData.RDS_CONFIG_CREDS.sonar.password,
      },
      targetGroupArn: sonarAlb.targetGroupArn,
    });

    /**
     * ! When this AMI is deployed, it keeps running into a Kernal Panic on boot.
     * ! Andre is opening a ticket with Palo Alto 01/16/24
     */
    new DfPaloAltoPanorama('palo-alto-panorama', this.stackConfig, {
      vpcs: {
        primary: this.vpcPrimary.vpcConstruct,
        recovery: this.vpcRecovery.vpcConstruct,
      },
    });

    new DfFortiManager('fortigate-fortimanager', this.stackConfig, {
      vpcs: {
        primary: this.vpcPrimary.vpcConstruct,
        recovery: this.vpcRecovery.vpcConstruct,
      },
      networkInstanceS3BackendProps:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ).s3BackendProps,
      recoveryNetworkInstanceS3BackendProps:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_RECOVERY
        ).s3BackendProps,
    });

    new EbCrossAccountEfsShareBucketStack(
      'eb-cross-account-efs-share-bucket',
      this.stackConfig,
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
   * Creates nexus
   */
  private createNexus(): void {
    const nexusAlbStack = new RemoteStack(
      'InternalNexusAlbShell',
      this.stackConfig
    );

    const nexusAlb = new DfAlb('nexus', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      overrideDefaultRegion: true,
      dfAlbProps: {
        internal: true,
        subDomain: 'nexus',
        stackShell: nexusAlbStack,
        vpc: this.vpcLegacy.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        targetGroupProps: {
          targetGroupPort: 8081,
          targetGroupProtocol: 'HTTP',
          healthCheckPath: '/',
          healthCheckPort: '8081',
        },
        createR53Record: true,
      },
      app: this.app,
      networkAccountProviderConfig:
        Utils.getSharedNetworkAccountProviderConfig(),
    });

    const nexusStack = new DfNexusStack('nexus', this.stackConfig, {
      spokeVpc: this.vpcLegacy.vpcConstruct,
      targetGroupArn: nexusAlb.targetGroupArn,
      albSgId: nexusAlb.albSgId,
    });

    new DfNexusWorkStationStack('NexusWorkStation', this.stackConfig, {
      spokeVpc: this.vpcLegacy.vpcConstruct,
      instanceType: 't2.small',
      keyPairName: 'nexus-ssh-key-pair',
      nexusEfsConstruct: nexusStack.nexusEfsConstruct,
    });
  }

  /**
   * Creates CyberArk proxies
   */
  private createCyberArkProxies(): void {
    const cyberArkStack = new CyberArkStack(this.stackConfig, {
      cyberArkPrimaryWindowsInstanceConfig: {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default'],
          instanceType: 'c4.2xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
        },
        options: {
          securityGroup: {
            ports: {
              tcp: [8080, [49152, 65535]],
              udp: [],
            },
          },
        },
      },
      cyberArkSecondaryWindowsInstanceConfig: {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default'],
          instanceType: 'c4.2xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
        },
        options: {
          securityGroup: {
            ports: {
              tcp: [8080, [49152, 65535]],
              udp: [],
            },
          },
        },
      },
      cyberArkPrimaryLinuxInstanceConfig: {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'c4.2xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          tags: {
            hostname: 'cyberarklinuxprimary',
            'ansible-managed': 'false',
            application: 'cyberark',
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
      },
      cyberArkSecondaryLinuxInstanceConfig: {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY[
            Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
          ],
          instanceType: 'c4.2xlarge',
          rootBlockDevice: {
            volumeSize: 250,
          },
          tags: {
            hostname: 'cyberarklinuxsecondary',
            'ansible-managed': 'false',
            application: 'cyberark',
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
      },
      vpc: this.vpcPrimary.vpcConstruct,
      recoveryVpc: this.vpcRecovery.vpcConstruct,
      masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
      sharedNetworkAccountProviderConfig:
        Utils.getSharedNetworkAccountProviderConfig(),
      networkInstanceS3BackendProps:
        SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ).s3BackendProps,
    });

    cyberArkStack.switchRegion(Constants.AWS_REGION_ALIASES.DF_PRIMARY);

    new DfAmiSharingStack('ami-sharing-stack', this.stackConfig);

    cyberArkStack.createRoute53Records([
      {
        dnsName: 'cyberark01.tools',
        instance: cyberArkStack.cyberArkPrimaryWindowsInstanceConstruct,
      },
      {
        dnsName: 'cyberark02.tools',
        instance: cyberArkStack.cyberArkSecondaryWindowsInstanceConstruct,
      },
      {
        dnsName: 'cyberarklinuxprimary.tools',
        instance: cyberArkStack.cyberArkPrimaryLinuxInstanceConstruct,
      },
      {
        dnsName: 'cyberarklinuxsecondary.tools',
        instance: cyberArkStack.cyberArkSecondaryLinuxInstanceConstruct,
      },
    ]);
  }

  /**
   * Creates the tools cross account lambda assets bucket to store all lambda assets
   */
  private createLambdaAssetsBuckets() {
    new DfLambdaAssetsBucketStack('lambda-assets-buckets', this.stackConfig);
  }

  /**
   *
   */
  private createGithubRunners() {
    const ghRunnerAlbStack = new RemoteStack(
      'GitHubRunnerAlbStack',
      this.stackConfig
    );

    const ghRunnerAlb = new DfAlb('github-runner', this.stackConfig, {
      networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
        Constants.AWS_REGION_ALIASES.LEGACY
      ),
      deployHTTPS: true,
      overrideDefaultRegion: true,
      dfAlbProps: {
        internal: true,
        subDomain: 'gh-runners',
        stackShell: ghRunnerAlbStack,
        vpc: this.vpcLegacy.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
        targetGroupProps: {
          targetGroupPort: 80,
          targetGroupProtocol: 'HTTP',
          healthCheckPath: '/',
          healthCheckPort: '80',
        },
        createR53Record: true,
      },
      app: this.app,
      networkAccountProviderConfig:
        Utils.getSharedNetworkAccountProviderConfig(),
    });

    const ghRunners = new GitHubRunnerStack(this.stackConfig, {
      region: Constants.AWS_REGION_ALIASES.LEGACY,
      targetGroupArn: ghRunnerAlb.targetGroupArn,
      albSgId: ghRunnerAlb.albSgId,
      subnetIds: this.vpcLegacy.vpcConstruct.appSubnetIds,
      assets: {
        assetsPath: 'docker/tools/gh-runners',
        imageName: 'gh-runners',
        dockerPushRoleAssumption: ToolsEnvironment.dockerPushRoleAssumption,
      },
    });

    ghRunners.addDependency(ghRunnerAlbStack);
  }

  /**
   * Create AD
   */
  private createAd(): void {
    this.microsoftActiveDirectory = new DfMicrosoftActiveDirectory(
      'microsoft-active-directory',
      this.stackConfig,
      {
        domainName: Constants.MICROSOFT_ACTIVE_DIRECTORY_DOMAIN_NAME,
        vpcs: {
          primaryDomainControllersVpc: this.vpcPrimary.vpcConstruct,
          replicaDomainControllersVpcs: {
            [Constants.AWS_REGION_ALIASES.DF_RECOVERY]:
              this.vpcRecovery.vpcConstruct,
            [Constants.AWS_REGION_ALIASES.LEGACY]: this.vpcLegacy.vpcConstruct,
          },
        },
      }
    );

    new MicrosoftOutboundResolver({
      stackId: 'microsoft-ad-outbound-resolver',
      stackConfig: this.stackConfig,
      deployToTools: true,
      dfMicrosoftActiveDirectoryStack: this.microsoftActiveDirectory,
      resolverVpcs: {
        legacyVpc: this.vpcLegacy.vpcConstruct,
        primaryVpc: this.vpcPrimary.vpcConstruct,
        recoveryVpc: this.vpcRecovery.vpcConstruct,
      },
    });
  }

  /**
   * Deploy Fisheye Crucible
   */
  private deployFisheyeCrucible(): void {
    const fisheyeCrucibleStack = new DfFisheyeCrucibleStack(
      'fisheye-crucible',
      this.stackConfig,
      {
        provider: this.vpcPrimary.primaryProvider,
        vpc: this.vpcPrimary.vpcConstruct,
        instanceType: 't3.medium',
        sharedNetworkProviderConfig:
          SharedNetworkEnvironment.accountProviderConfig,
        masterProviderConfig: MasterEnvironment.accountProviderConfig,
        sharedNetworkBackendProps:
          SharedNetworkEnvironment.regionalNetworkConfig(
            Constants.AWS_REGION_ALIASES.DF_PRIMARY
          ).s3BackendProps,
        recoverySharedNetworkBackendProps:
          SharedNetworkEnvironment.regionalNetworkConfig(
            Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ).s3BackendProps,
      }
    );

    // * Fisheye/Crucible EC2 instance R53name
    new Route53Attachment({
      requestingStack: fisheyeCrucibleStack,
      recordType: 'A',
      dnsName: `fecru.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [
        fisheyeCrucibleStack.fisheyeCrucibleInstanceResource.instanceResource
          .privateIp,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    // * Fisheye/Crucible RDS instance R53name
    new Route53Attachment({
      requestingStack: fisheyeCrucibleStack,
      recordType: 'CNAME',
      dnsName: `fecrudb.${this.stackConfig.envSubdomain}`,
      awsPrivateIpOrPrivateDns: [
        fisheyeCrucibleStack.fisheyeDbResource.address,
      ],
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
    });

    const fisheyeCrucibleAlbStack = new RemoteStack(
      'fecruInternalAlbShell',
      this.stackConfig
    );

    new DfAlb(
      'fisheye-crucible',
      this.stackConfig,
      {
        networkInstance: SharedNetworkEnvironment.regionalNetworkConfig(
          Constants.AWS_REGION_ALIASES.DF_PRIMARY
        ),
        instancesForTargetGroup: [
          fisheyeCrucibleStack.fisheyeCrucibleInstanceResource,
        ],
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: 'fisheye-crucible.tools',
          stackShell: fisheyeCrucibleAlbStack,
          vpc: this.vpcPrimary.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 8060,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/',
            healthCheckPort: '8060',
          },
          createR53Record: true,
          successCodes: '200-302', // * Initial setup returns 302. Can scope down to 200 after setup is complete.
        },
        app: this.app,
        networkAccountProviderConfig:
          SharedNetworkEnvironment.accountProviderConfig,
      },
      Constants.AWS_REGION_ALIASES.DF_PRIMARY
    );
  }

  /**
   * Deploy Network Sensor Instances
   */
  private deployNetworkSensorStack(): void {
    new DfNetworkSensorStack('network-sensor-primary', this.stackConfig, {
      provider: this.vpcPrimary.primaryProvider,
      vpc: this.vpcPrimary.vpcConstruct,
      instanceType: 't3.medium',
      regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      sopsData: this.sopsData,
    });

    new DfNetworkSensorStack('network-sensor-recovery', this.stackConfig, {
      provider: this.vpcRecovery.recoveryProvider,
      vpc: this.vpcRecovery.vpcConstruct,
      instanceType: 't3.medium',
      regionAlias: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      sopsData: this.sopsData,
    });
  }

  /**
   * Deploy NewRelic Network Monitor Instances
   */
  private deployNewRelicNetworkMonitorStack(): void {
    new DfNewRelicNetworkMonitorStack(
      'newrelic-network-monitor-primary',
      this.stackConfig,
      {
        provider: this.vpcPrimary.primaryProvider,
        vpc: this.vpcPrimary.vpcConstruct,
        regionAlias: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      }
    );

    new DfNewRelicNetworkMonitorStack(
      'newrelic-network-monitor-recovery',
      this.stackConfig,
      {
        provider: this.vpcRecovery.recoveryProvider,
        vpc: this.vpcRecovery.vpcConstruct,
        regionAlias: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      }
    );
  }

  /**
   * Deploy Windows Workstation stacks
   */
  private createWindowsWorkstation(): void {
    new WindowsWorkstationStack(this.stackConfig, [
      {
        vpc: this.vpcPrimary.vpcConstruct,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          ami: Constants.MANAGED_AMI_IDS.DFPRIMARY['windows-2022-default-v4'],
          instanceType: 'm5.xlarge',
          rootBlockDevice: {
            volumeSize: 100,
          },
          ebsBlockDevice: [
            {
              deviceName: '/dev/xvda',
              volumeSize: 100,
              encrypted: true,
              volumeType: 'gp3',
            },
          ],
          keyName: 'gothamWatch',
          tags: {
            Name: 'gothamWatch',
          },
        },
        route53Config: {
          region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          accountProviderConfig: Utils.getSharedNetworkAccountProviderConfig(),
          dnsName: 'gothamWatch.tools',
          envSubdomain: ToolsEnvironment.ENVIRONMENT_SUBDOMAIN,
        },
        options: {
          provider: this.vpcPrimary.primaryProvider,
          createKeyPair: true,
        },
      },
    ]);
  }

  /**
   * @return {string}
   */
  public static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_TOOLS;
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'tools';
  }

  /**
   * @return {string}
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'tools';
  }

  /**
   * @return {string}
   */
  private static get dockerPushRoleAssumption(): string {
    return `
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
      $(aws sts assume-role \
      --role-arn arn:aws:iam::${ToolsEnvironment.ACCOUNT_ID}:role/${ToolsEnvironment.PROVIDER_ROLE_NAME} \
      --role-session-name DockerPush \
      --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
      --output text))
    `;
  }

  /**
   * @return {string}
   */
  public static get PROVIDER_ROLE_NAME(): string {
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @constructor
   * @param {App} app - The CDK App
   * @return {ToolsEnvironment} - An instance of the ToolsEnvironment
   */
  public static getInstance(app: App): ToolsEnvironment {
    if (!ToolsEnvironment.instance) {
      ToolsEnvironment.instance = new ToolsEnvironment({
        app: app,
        vpcCidrPrimary: DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
        vpcCidrRecovery: DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery,
        envName: ToolsEnvironment.ENVIRONMENT_NAME,
        envTier: 'tools',
        sharedSpoke: false,
        spokeVpcStackPrefix: 'main',
        vpcCidrLegacy: DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy,
      });
      ToolsEnvironment.instance.deployStacks();
    }
    return ToolsEnvironment.instance;
  }

  /**
   * @return {string}
   */
  public static dfMicrosoftActiveDirectoryStackConfig(): S3BackendConfig {
    return Utils.createS3BackendProps(
      'microsoft-active-directory',
      ToolsEnvironment.ENVIRONMENT_NAME
    );
  }

  /**
   * @return {string}
   */
  public static toolsLegacyVpcStackConfig(): S3BackendConfig {
    return Utils.createS3BackendProps(
      'main-Spoke-VPC',
      ToolsEnvironment.ENVIRONMENT_NAME
    );
  }

  /**
   * @return {string}
   */
  public static toolsPrimaryVpcStackConfig(): S3BackendConfig {
    return Utils.createS3BackendProps(
      'main-primary-vpc-Spoke-VPC',
      ToolsEnvironment.ENVIRONMENT_NAME
    );
  }

  /**
   * @return {string}
   */
  public static toolsRecoveryVpcStackConfig(): S3BackendConfig {
    return Utils.createS3BackendProps(
      'main-recovery-vpc-Spoke-VPC',
      ToolsEnvironment.ENVIRONMENT_NAME
    );
  }

  /**
   *
   */
  public static get accountProviderConfig(): AccountProviderConfig {
    return {
      accountId: ToolsEnvironment.ACCOUNT_ID,
      accountName: ToolsEnvironment.ENVIRONMENT_NAME,
      accountProvisionRole: ToolsEnvironment.PROVIDER_ROLE_NAME,
    };
  }
}
