import {
  DfKeyPairConstruct,
  DfPrivateInstanceConstruct,
  DfPrivateInstanceConstructProps,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
  NlbConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Instance } from '@cdktf/provider-aws/lib/instance';
import {
  AccountProviderConfig,
  Constants,
  DfMultiRegionDeployment,
  DfMultiRegionDeploymentBase,
  Utils,
} from '@dragonfly/utils';
import { Aspects, S3BackendConfig } from 'cdktf';
import { IConstruct } from 'constructs';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';

interface Route53Configs {
  dnsName: string;
  instance: DfPrivateInstanceConstruct;
}
interface CyberArkConfig {
  cyberArkPrimaryWindowsInstanceConfig: DfPrivateInstanceConstructProps;
  cyberArkSecondaryWindowsInstanceConfig: DfPrivateInstanceConstructProps;
  cyberArkPrimaryLinuxInstanceConfig: DfPrivateInstanceConstructProps;
  cyberArkSecondaryLinuxInstanceConfig: DfPrivateInstanceConstructProps;
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  recoveryVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  masterAccountProviderConfig: AccountProviderConfig;
  sharedNetworkAccountProviderConfig: AccountProviderConfig;
  networkInstanceS3BackendProps: S3BackendConfig;
}

/**
 * CyberArkStack
 */
export class CyberArkStack
  extends RemoteStack
  implements DfMultiRegionDeployment
{
  public readonly cyberArkPrimaryWindowsInstanceConstruct: DfPrivateInstanceConstruct;
  public readonly cyberArkSecondaryWindowsInstanceConstruct: DfPrivateInstanceConstruct;
  public readonly cyberArkPrimaryLinuxInstanceConstruct: DfPrivateInstanceConstruct;
  public readonly cyberArkSecondaryLinuxInstanceConstruct: DfPrivateInstanceConstruct;
  private sharedNetworkHubProvider: AwsProvider;
  /**
   *
   * @param {StackConfig} stackConfig
   * @param {CyberArkConfig} cyberArkConfig
   */
  constructor(stackConfig: StackConfig, cyberArkConfig: CyberArkConfig) {
    super('CyberArkStack', stackConfig);

    const masterProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: cyberArkConfig.masterAccountProviderConfig,
    });

    this.sharedNetworkHubProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: cyberArkConfig.sharedNetworkAccountProviderConfig,
    });

    const cyberArkKeyPair = new DfKeyPairConstruct(this, 'CyberArkKeyPair', {
      keyName: 'cyberArkKeyPair',
    });

    [
      cyberArkConfig.cyberArkPrimaryWindowsInstanceConfig,
      cyberArkConfig.cyberArkSecondaryWindowsInstanceConfig,
      cyberArkConfig.cyberArkPrimaryLinuxInstanceConfig,
      cyberArkConfig.cyberArkSecondaryLinuxInstanceConfig,
    ].forEach((config) => {
      config.instanceResourceConfig = {
        ...config.instanceResourceConfig,
        ...{
          keyName: cyberArkKeyPair.getKeyPairResource().keyName,
        },
      };

      config.options = {
        ...config.options,
        ...{
          createKeyPair: false,
        },
      };
    });

    this.cyberArkPrimaryWindowsInstanceConstruct =
      new DfPrivateInstanceConstruct({
        scope: this,
        name: 'CyberArkPrimaryWindows',
        constructProps: cyberArkConfig.cyberArkPrimaryWindowsInstanceConfig,
      });
    this.cyberArkSecondaryWindowsInstanceConstruct =
      new DfPrivateInstanceConstruct({
        scope: this,
        name: 'CyberArkSecondaryWindows',
        constructProps: cyberArkConfig.cyberArkSecondaryWindowsInstanceConfig,
      });
    this.cyberArkPrimaryLinuxInstanceConstruct = new DfPrivateInstanceConstruct(
      {
        scope: this,
        name: 'CyberArkPrimaryLinux',
        constructProps: cyberArkConfig.cyberArkPrimaryLinuxInstanceConfig,
      }
    );
    this.cyberArkSecondaryLinuxInstanceConstruct =
      new DfPrivateInstanceConstruct({
        scope: this,
        name: 'CyberArkSecondaryLinux',
        constructProps: cyberArkConfig.cyberArkSecondaryLinuxInstanceConfig,
      });

    new NlbConstruct({
      scope: this,
      stackName: this.stackUuid,
      constructName: 'cyberark-nlb',
      nlbName: 'cyberark',
      route53RecordName: 'psm',
      vpc: cyberArkConfig.vpc,
      recoveryVpc: cyberArkConfig.recoveryVpc,
      networkInstanceS3BackendProps:
        cyberArkConfig.networkInstanceS3BackendProps,
      portAndProtocols: [
        {
          port: 22,
          protocol: 'TCP',
          primaryTargetInstances: [
            this.cyberArkPrimaryLinuxInstanceConstruct,
            this.cyberArkSecondaryLinuxInstanceConstruct,
          ],
          recoveryTargetInstances: [],
        },
        {
          port: 3389,
          protocol: 'TCP',
          primaryTargetInstances: [
            this.cyberArkPrimaryWindowsInstanceConstruct,
            this.cyberArkSecondaryWindowsInstanceConstruct,
          ],
          recoveryTargetInstances: [],
          healthCheck: {
            healthCheckProtocol: 'HTTPS',
            healthCheckPath: '/psm/api/health',
            matcher: '200',
          },
        },
      ],
      masterProvider: masterProvider,
      hubProvider: this.sharedNetworkHubProvider,
      provider: this.primaryProvider,
      recocveryProvider: this.recoveryProvider,
      accountDefinition: this.stackConfig.accountDefinition,
      importCertificate: {
        certificateBodyPath: 'cyberark/psm_dragonflyft_com.crt',
        certificateChainPath: 'cyberark/psm_dragonflyft_chain.ca-bundle',
        certificatePrivateKeySopsKey: 'CYBER_ARK_PSM_CERT_PRIVATE_KEY',
      },
    });
  }

  /**
   *
   * @param {Constants.AWS_REGION_ALIASES} region
   */
  public switchRegion(region: Constants.AWS_REGION_ALIASES): void {
    Aspects.of(this).add({
      visit: (node: IConstruct) => {
        DfMultiRegionDeploymentBase.basicMultiRegionDeployment(
          this,
          region,
          node
        );

        if (
          node instanceof Instance &&
          node.amiInput ===
            Constants.MANAGED_AMI_IDS.LEGACY[
              Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
            ]
        ) {
          switch (region) {
            case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
              node.ami =
                Constants.MANAGED_AMI_IDS[
                  Constants.AWS_REGION_ALIASES.DF_PRIMARY
                ][Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7];
              break;
            case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
              node.ami =
                Constants.MANAGED_AMI_IDS[
                  Constants.AWS_REGION_ALIASES.DF_RECOVERY
                ][Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7];
              break;
            case Constants.AWS_REGION_ALIASES.LEGACY:
              node.ami =
                Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.LEGACY][
                  Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7
                ];
              break;
          }
        }
        if (
          node instanceof Instance &&
          node.amiInput ===
            Constants.MANAGED_AMI_IDS.LEGACY['windows-2022-default']
        ) {
          switch (region) {
            case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
              node.ami =
                Constants.MANAGED_AMI_IDS[
                  Constants.AWS_REGION_ALIASES.DF_PRIMARY
                ]['windows-2022-default'];
              break;
            case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
              node.ami =
                Constants.MANAGED_AMI_IDS[
                  Constants.AWS_REGION_ALIASES.DF_RECOVERY
                ]['windows-2022-default'];

              break;
            case Constants.AWS_REGION_ALIASES.LEGACY:
              node.ami =
                Constants.MANAGED_AMI_IDS[Constants.AWS_REGION_ALIASES.LEGACY][
                  'windows-2022-default'
                ];

              break;
          }
        }
      },
    });
  }

  /**
   * Creates a R53 record for CyberArk Instances
   * @param {Route53Configs[]} route53Configs
   */
  public createRoute53Records(route53Configs: Route53Configs[]) {
    route53Configs.forEach((route53Config) => {
      const route53Zone = new DataAwsRoute53Zone(
        this,
        `${route53Config.dnsName}privateZoneLookup`,
        {
          provider: this.sharedNetworkHubProvider,
          name: 'dragonflyft.com',
          privateZone: true,
        }
      );

      new Route53Record(this, `${route53Config.dnsName}R53Record`, {
        provider: this.sharedNetworkHubProvider,
        name: `${route53Config.dnsName}.${route53Zone.name}`,
        type: 'A',
        zoneId: route53Zone.zoneId,
        records: [route53Config.instance.instanceResource.privateIp],
        ttl: 300,
      });
    });
  }
}
