import {
  DfAliasedKeyConstruct,
  DfCustomerAlbConstruct,
  DfCustomerNlbConstruct,
  DfKeyPairConstruct,
  DfPrivateInstanceConstruct,
  DfPublicIngressConstruct,
  DfSqlServerRdsConstruct,
  NlbConstruct,
} from '@dragonfly/constructs';
import {
  DfSpokeVpcStack,
  DfWafStack,
  RemoteStack,
  StackConfig,
} from '../stacks';
import {
  AccountProviderConfig,
  Constants,
  DfAccounts,
  PlatformSecrets,
  Utils,
} from '@dragonfly/utils';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DataTerraformRemoteStateS3, S3BackendConfig } from 'cdktf';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';

interface ServiceConfig {
  vpcMap: {
    [x: string]: DfSpokeVpcStack;
  };
  prodDeploy: boolean;
  masterAccountProviderConfig: AccountProviderConfig;
  sharedNetworkAccountProviderConfig: AccountProviderConfig;
  networkInstanceS3BackendProps: S3BackendConfig;
  recoveryNetworkInstanceS3BackendProps: S3BackendConfig;
  ingressCidrBlocks: string[];
  multiRegion?: boolean;
  kmsNameOverride?: string;
}

/**
 * MOVEit Service Stack
 */
export class MoveitServiceStack extends RemoteStack {
  private moveitSessionRole: IamRole;
  private providerArray: AwsProvider[];
  private primaryTransferServers: DfPrivateInstanceConstruct[] = [];
  private recoveryTransferServers: DfPrivateInstanceConstruct[] = [];
  private primaryAutomationServers: DfPrivateInstanceConstruct[] = [];
  private recoveryAutomationServers: DfPrivateInstanceConstruct[] = [];
  private sopsData: PlatformSecrets;
  private masterProvider: AwsProvider;
  private hubProvider: AwsProvider;

  /**
   *
   * @param {string} stackId - Stack Id
   * @param {StackConfig} stackConfig - Config for the stack
   * @param {ServiceConfig} serviceConfig - service configuration
   */
  public constructor(
    protected stackId: string,
    protected stackConfig: StackConfig,
    protected serviceConfig: ServiceConfig
  ) {
    super(stackId, stackConfig);
    this.stackConfig = stackConfig;

    // Create an array of providers that the resources will be deployed to
    this.providerArray = [this.primaryProvider, this.recoveryProvider];

    // Retrieve sops data that contains rds credentials
    this.sopsData = Utils.getSecretsForNode(this.node);

    this.masterProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: this.serviceConfig.masterAccountProviderConfig,
    });

    this.hubProvider = this.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        this.primaryProvider.region
      ),
      forAccount: this.serviceConfig.sharedNetworkAccountProviderConfig,
    });

    this.createIamRole();
    this.createMoveitServers();
    this.createMoveitRds();
    this.publicAccess();
    this.vpnAccess();
  }

  /**
   * Creates the Moveit IAM role
   */
  private createIamRole(): void {
    // Create the Iam Role for the moveit servers
    this.moveitSessionRole = new IamRole(this, 'moveit-session-role', {
      provider: this.primaryProvider,
      name: 'moveit-session-role',
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/AmazonSSMDirectoryServiceAccess',
      ],
      tags: {
        stackId: this.stackId,
        Name: 'moveit-session-role',
      },
    });
  }

  /**
   * Creates the ebs volume encryption key
   * @param {AwsProvider} provider - Current stack provider
   * @param {Number} index - Index number to create a dynamic Encryption key per region
   * @return {DfAliasedKeyConstruct} - The AwsProvider that matches the passed in region
   */
  private createEncryptionKey(
    provider: AwsProvider,
    index: number
  ): DfAliasedKeyConstruct {
    return new DfAliasedKeyConstruct(this, `ebs-encryption-key-${index}`, {
      name: `moveit-ebs-encryption-key-${index}`,
      description: 'The KMS key for encypting the Moveit Ebs Volumes',
      provider: provider,
    });
  }

  /**
   * Creates the Moveit Key Pair and Windows Servers
   */
  private createMoveitServers(): void {
    // Loop through and create resources in primary and recovery regions
    this.providerArray.forEach((currentProvider, index) => {
      let tagName;
      if (currentProvider === this.recoveryProvider) {
        tagName = 'dr-moveit-server';
      } else {
        tagName = 'moveit-server';
      }
      const encryptionKeyConstruct = this.createEncryptionKey(
        currentProvider,
        index
      );

      // Create the key pair for the moveit servers
      const keyPairConfig = {
        keyName: tagName,
        provider: currentProvider,
        index: index,
      };
      const moveitKeyPair = new DfKeyPairConstruct(
        this,
        tagName,
        keyPairConfig
      );

      // Create the windows moveit transfer servers withe efs userdata and ami by region
      const transferServer = DfPrivateInstanceConstruct.windowsInstanceFactory({
        scope: this,
        name: `${tagName}-transfer`,
        constructProps: {
          vpc: this.serviceConfig.vpcMap[currentProvider.region].vpcConstruct,
          accountDefinition: this.stackConfig.accountDefinition,
          instanceResourceConfig: {
            disableApiTermination: true,
            ami: this.getWindowsAmi(currentProvider.region, 'transfer'),
            instanceType: 'm5.2xlarge',
            keyName: moveitKeyPair.getKeyPairResource().keyName,
            rootBlockDevice: {
              volumeSize: 1024, // Volume size in GB: 1024GB -> 1TB
              encrypted: true,
              deleteOnTermination: false,
              kmsKeyId: encryptionKeyConstruct.arn,
            },
            tags: {
              tier: `${tagName}-transfer`,
              stackId: this.stackId,
              Name: `${tagName}-transfer`,
            },
          },
          options: {
            provider: currentProvider,
            recoveredInstance:
              currentProvider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
            instanceProfileRole: this.moveitSessionRole,
            subnet: {
              azIndex: 0,
            },
          },
        },
      });
      this.addServerToList(currentProvider, transferServer, 'transfer');

      const secondTransferServer =
        DfPrivateInstanceConstruct.windowsInstanceFactory({
          scope: this,
          name: `${tagName}-transfer-secondary`,
          constructProps: {
            vpc: this.serviceConfig.vpcMap[currentProvider.region].vpcConstruct,
            accountDefinition: this.stackConfig.accountDefinition,
            instanceResourceConfig: {
              disableApiTermination: true,
              ami: this.getWindowsAmi(
                currentProvider.region,
                'transferSecondary'
              ),
              instanceType: 'm5.2xlarge',
              keyName: moveitKeyPair.getKeyPairResource().keyName,
              rootBlockDevice: {
                volumeSize: 1024, // Volume size in GB: 1024GB -> 1TB
                encrypted: true,
                deleteOnTermination: false,
                kmsKeyId: encryptionKeyConstruct.arn,
              },
              tags: {
                tier: `${tagName}-transfer`,
                stackId: this.stackId,
                Name: `${tagName}-transfer-secondary`,
              },
            },
            options: {
              provider: currentProvider,
              recoveredInstance:
                currentProvider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
              instanceProfileRole: this.moveitSessionRole,
              subnet: {
                azIndex: 1,
              },
            },
          },
        });
      this.addServerToList(currentProvider, secondTransferServer, 'transfer');

      // Create the windows moveit automation servers with efs userdata and ami by region
      const automationServer =
        DfPrivateInstanceConstruct.windowsInstanceFactory({
          scope: this,
          name: `${tagName}-automation`,
          constructProps: {
            vpc: this.serviceConfig.vpcMap[currentProvider.region].vpcConstruct,
            accountDefinition: this.stackConfig.accountDefinition,
            instanceResourceConfig: {
              disableApiTermination: true,
              ami: this.getWindowsAmi(currentProvider.region, 'automation'),
              instanceType: 'm5.2xlarge',
              keyName: moveitKeyPair.getKeyPairResource().keyName,
              rootBlockDevice: {
                volumeSize: 1024, // Volume size in GB: 1024GB -> 1TB
                encrypted: true,
                deleteOnTermination: false,
                kmsKeyId: encryptionKeyConstruct.arn,
              },
              tags: {
                tier: `${tagName}-automation`,
                stackId: this.stackId,
                Name: `${tagName}-automation`,
              },
            },
            options: {
              provider: currentProvider,
              recoveredInstance:
                currentProvider.region === Constants.AWS_REGION_MAP.DFRECOVERY,
              instanceProfileRole: this.moveitSessionRole,
              subnet: {
                azIndex: 0,
              },
              securityGroup: {
                ingresses: [
                  {
                    description: `Allow all ingress traffic from ${this.stackConfig.envSubdomain} VPCs`,
                    fromPort: 0,
                    toPort: 0,
                    protocol: '-1',
                    cidrBlocks: this.serviceConfig.ingressCidrBlocks,
                  },
                  {
                    description: 'Allow traffic between automation servers',
                    fromPort: 3472,
                    toPort: 3473,
                    protocol: 'tcp',
                    cidrBlocks: [
                      this.serviceConfig.vpcMap[currentProvider.region]
                        .vpcConstruct.vpcCidrBlock,
                    ],
                  },
                ],
              },
            },
          },
        });
      this.addServerToList(currentProvider, automationServer, 'automation');

      // Only deploy secondary automation server during prod deployment
      if (this.serviceConfig.prodDeploy) {
        const secondaryAutomationServer =
          DfPrivateInstanceConstruct.windowsInstanceFactory({
            scope: this,
            name: `${tagName}-automation-secondary`,
            constructProps: {
              vpc: this.serviceConfig.vpcMap[currentProvider.region]
                .vpcConstruct,
              accountDefinition: this.stackConfig.accountDefinition,
              instanceResourceConfig: {
                disableApiTermination: true,
                ami: this.getWindowsAmi(
                  currentProvider.region,
                  'automationSecondary'
                ),
                instanceType: 'm5.2xlarge',
                keyName: moveitKeyPair.getKeyPairResource().keyName,
                rootBlockDevice: {
                  volumeSize: 1024, // Volume size in GB: 1024GB -> 1TB
                  encrypted: true,
                  deleteOnTermination: false,
                  kmsKeyId: encryptionKeyConstruct.arn,
                },
                tags: {
                  tier: `${tagName}-automation`,
                  stackId: this.stackId,
                  Name: `${tagName}-automation-secondary`,
                },
              },
              options: {
                recoveredInstance:
                  currentProvider.region ===
                  Constants.AWS_REGION_MAP.DFRECOVERY,
                provider: currentProvider,
                instanceProfileRole: this.moveitSessionRole,
                subnet: {
                  azIndex: 1,
                },
                securityGroup: {
                  ingresses: [
                    {
                      description: `Allow all ingress traffic from ${this.stackConfig.envSubdomain} VPCs`,
                      fromPort: 0,
                      toPort: 0,
                      protocol: '-1',
                      cidrBlocks: this.serviceConfig.ingressCidrBlocks,
                    },
                    {
                      description: 'Allow traffic between automation servers',
                      fromPort: 3472,
                      toPort: 3473,
                      protocol: 'tcp',
                      cidrBlocks: [
                        this.serviceConfig.vpcMap[currentProvider.region]
                          .vpcConstruct.vpcCidrBlock,
                      ],
                    },
                  ],
                },
              },
            },
          });
        this.addServerToList(
          currentProvider,
          secondaryAutomationServer,
          'automation'
        );
      }
    });
    const rootZone = new DataAwsRoute53Zone(
      this,
      `private-hosted-dragonflyft-zone`,
      {
        provider: this.hubProvider,
        name: 'dragonflyft.com',
        privateZone: true,
      }
    );
    this.primaryAutomationServers.forEach((instance) => {
      const name = instance.constructName.includes('secondary')
        ? 'secondary'
        : 'primary';
      new Route53Record(this, `${name}-automation-record`, {
        provider: this.hubProvider,
        name: `moveit-automation-${name}.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        type: 'A',
        records: [instance.instanceResource.privateIp],
        zoneId: rootZone.id,
        ttl: 60,
        allowOverwrite: true,
      });
    });

    new NlbConstruct({
      scope: this,
      stackName: this.stackUuid,
      constructName: 'moveit-nlb',
      nlbName: 'moveit-transfer',
      route53RecordName: `moveit-sftp.${this.stackConfig.envSubdomain}`,
      vpc: this.serviceConfig.vpcMap[this.primaryProvider.region].vpcConstruct,
      recoveryVpc:
        this.serviceConfig.vpcMap[this.recoveryProvider.region].vpcConstruct,
      networkInstanceS3BackendProps:
        this.serviceConfig.networkInstanceS3BackendProps,
      portAndProtocols: [
        {
          port: 22,
          protocol: 'TCP',
          primaryTargetInstances: this.primaryTransferServers,
          recoveryTargetInstances: this.recoveryTransferServers,
        },
      ],
      masterProvider: this.masterProvider,
      hubProvider: this.hubProvider,
      provider: this.primaryProvider,
      recocveryProvider: this.recoveryProvider,
      accountDefinition: this.stackConfig.accountDefinition,
    });
  }

  /**
   * Creates the Moveit Rds sql server
   */
  private createMoveitRds(): void {
    const dbServer = DfSqlServerRdsConstruct.sqlServerRdsInstanceFactory({
      envName: this.stackConfig.envName,
      scope: this,
      dbId: 'move-it',
      accountDefinition: this.stackConfig.accountDefinition,
      subnetIds:
        this.serviceConfig.vpcMap[Constants.AWS_REGION_MAP.DFPRIMARY]
          .vpcConstruct.dataSubnetIds,
      vpcResource:
        this.serviceConfig.vpcMap[Constants.AWS_REGION_MAP.DFPRIMARY]
          .vpcConstruct,
      constructId: 'moveit-sql-server',
      multiAz: this.serviceConfig.multiRegion ?? false,
      rdsCredentials: {
        username: this.sopsData.RDS_CONFIG_CREDS.moveit.username,
        password: this.sopsData.RDS_CONFIG_CREDS.moveit.password,
      },
      backupRetentionPeriod: 2,
      multiRegion: this.serviceConfig.multiRegion ?? false,
      kmsNameOverride: this.serviceConfig.kmsNameOverride,
      replicaConfig: this.serviceConfig.multiRegion
        ? {
            vpc: this.serviceConfig.vpcMap[Constants.AWS_REGION_MAP.DFRECOVERY]
              .vpcConstruct,
            replicaProvider: this.recoveryProvider,
            replicaClusterParameterGroupName: null,
            replicaClusterParameters: null,
            replicaClusterFamily: null,
            instanceIdentifierOverride: null,
            clusterIdentifierOverride: null,
          }
        : null,
      primaryProvider: this.primaryProvider,
      prodCustomerData: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        this.stackConfig.federatedAccountId
      )
        ? true
        : false,
    });

    const remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
      this,
      `remote-state-move-it-to-shared-network-primary`,
      this.serviceConfig.networkInstanceS3BackendProps
    );

    const isSharedProd =
      this.stackConfig.accountDefinition.accountNumber ===
      DfAccounts.getSharedProdAccountDef().accountNumber;

    new Route53Record(this, `sql-server-r53-record`, {
      // Hub
      provider: this.hubProvider,
      name: `move-it${isSharedProd ? '-automation' : ''}-db.${
        this.stackConfig.envSubdomain
      }.dragonflyft.com`,
      type: 'CNAME',
      zoneId: remoteStateSharedNetworkStack.getString(
        Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
      ),
      records: [dbServer.sqlServerDbInstanceResource.address],
      ttl: 300,
    });

    if (isSharedProd) {
      const transferDbServer =
        DfSqlServerRdsConstruct.sqlServerRdsInstanceFactory({
          envName: this.stackConfig.envName,
          scope: this,
          dbId: 'move-it-transfer',
          accountDefinition: this.stackConfig.accountDefinition,
          subnetIds:
            this.serviceConfig.vpcMap[Constants.AWS_REGION_MAP.DFPRIMARY]
              .vpcConstruct.dataSubnetIds,
          vpcResource:
            this.serviceConfig.vpcMap[Constants.AWS_REGION_MAP.DFPRIMARY]
              .vpcConstruct,
          constructId: 'moveit-transfer-sql-server',
          multiAz: this.serviceConfig.multiRegion ?? false,
          rdsCredentials: {
            username: this.sopsData.RDS_CONFIG_CREDS.moveit.username,
            password: this.sopsData.RDS_CONFIG_CREDS.moveit.password,
          },
          backupRetentionPeriod: 2,
          multiRegion: this.serviceConfig.multiRegion ?? false,
          kmsNameOverride: `move-it-transfer-sql-server-key-multi-regional`,
          replicaConfig: this.serviceConfig.multiRegion
            ? {
                vpc: this.serviceConfig.vpcMap[
                  Constants.AWS_REGION_MAP.DFRECOVERY
                ].vpcConstruct,
                replicaProvider: this.recoveryProvider,
                replicaClusterParameterGroupName: null,
                replicaClusterParameters: null,
                replicaClusterFamily: null,
                instanceIdentifierOverride: null,
                clusterIdentifierOverride: null,
              }
            : null,
          primaryProvider: this.primaryProvider,
          prodCustomerData: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
            this.stackConfig.federatedAccountId
          )
            ? true
            : false,
        });
      new Route53Record(this, `sql-server-transfer-r53-record`, {
        // Hub
        provider: this.hubProvider,
        name: `move-it-transfer-db.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        type: 'CNAME',
        zoneId: remoteStateSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID
        ),
        records: [transferDbServer.sqlServerDbInstanceResource.address],
        ttl: 300,
      });
    }
  }

  /**
   * Creates public access for MoveIt
   */
  private publicAccess() {
    const moveItWaf = new DfWafStack('moveItWaf', this.stackConfig, {
      ipv4WhiteList: Constants.MOVE_IT_WHITELIST,
      listName: 'moveItWhitelist',
    });

    new DfPublicIngressConstruct(
      this,
      'moveit',
      null,
      {
        providers: {
          constructProvider: this.primaryProvider,
          networkProvider: this.hubProvider,
          masterProvider: this.masterProvider,
          route53Provider: this.hubProvider,
          recoveryProvider: this.recoveryProvider,
        },
        networkBackendProps: this.serviceConfig.networkInstanceS3BackendProps,
        recoveryNetworkBackendProps:
          this.serviceConfig.recoveryNetworkInstanceS3BackendProps,
        certDomainName: `move-it.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        r53RecordName: `move-it.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        albName: 'moveItAlb',
        instancesForTargetGroup: this.primaryTransferServers,
        wafId: moveItWaf.webAclArn,
        shared: {},
        bucketNameOverride:
          this.stackConfig.envName === 'sharedProd'
            ? 'moveit-prod-cloudfront-logging-bucket'
            : undefined,
        staticIps: false,
        deployToXL: true,
      },
      false,
      this.stackConfig.accountDefinition
    );

    new DfPublicIngressConstruct(
      this,
      'moveit-nlb',
      {
        providers: {
          constructProvider: this.primaryProvider,
          networkProvider: this.hubProvider,
          masterProvider: this.masterProvider,
          route53Provider: this.hubProvider,
          recoveryProvider: this.recoveryProvider,
        },
        networkBackendProps: this.serviceConfig.networkInstanceS3BackendProps,
        recoveryNetworkBackendProps:
          this.serviceConfig.recoveryNetworkInstanceS3BackendProps,
        certDomainName: `moveit-sftp.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        r53RecordName: `moveit-sftp.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        albName: 'moveItNlb',
        instancesForTargetGroup: this.primaryTransferServers,
        wafId: moveItWaf.webAclArn,
        shared: {},
        bucketNameOverride:
          this.stackConfig.envName === 'sharedProd'
            ? 'moveit-sftp-prod-cloudfront-logging-bucket'
            : undefined,
        ipWhitelist: Constants.MOVE_IT_WHITELIST,
        staticIps: true,
        deployToXL: true,
      },
      null,
      true,
      this.stackConfig.accountDefinition
    );
  }

  private vpnAccess() {
    new DfCustomerAlbConstruct(this, 'moveit-vpn-alb-internal-alb', {
      lbName: 'moveItVpnAlb',
      accountDefinition: this.stackConfig.accountDefinition,
      lbProps: {
        targetGroups: [
          {
            constructName: 'internal-alb-target-group',
            tgAttachmentConstructNameOverride:
              'moveit-vpn-alb-internal-alb-target-group',
            targetGroupNameOverride: 'moveItVpnAlb',
            instancesForTargetGroup: this.primaryTransferServers,
            recoveryInstancesForTargetGroup: this.recoveryTransferServers,
            targetPort: 443,
            targetProtocol: 'HTTPS',
            healthCheck: {
              path: '/',
              port: '443',
              protocol: 'HTTPS',
            },
            listeners: [
              {
                lbPort: 443,
                lbProtocol: 'HTTPS',
                name: 'internal-alb-tls-listener',
                overrideListenerConstructName:
                  'moveit-vpn-alb-internal-alb-internal-alb-tls-listener',
              },
            ],
          },
        ],
      },
      certDomainName: `move-it.internal.${this.stackConfig.envSubdomain}.dragonflyft.com`,
      networkBackendProps: this.serviceConfig.networkInstanceS3BackendProps,
      recoveryNetworkBackendProps:
        this.serviceConfig.recoveryNetworkInstanceS3BackendProps,
      providers: {
        constructProvider: this.primaryProvider,
        networkProvider: null,
        masterProvider: this.masterProvider,
        route53Provider: null,
        recoveryProvider: this.recoveryProvider,
      },
      customerDefinition: DfAccounts.customers.shared,
      deployToRegisteredCidr: false,
    });

    new DfCustomerAlbConstruct(this, 'moveit-registered-alb', {
      lbName: 'moveItVpnRegisteredAlb',
      accountDefinition: this.stackConfig.accountDefinition,
      lbProps: {
        targetGroups: [
          {
            constructName: 'moveit-registered-alb-tg',
            tgAttachmentConstructNameOverride: 'moveit-registered-alb-tg',
            targetGroupNameOverride: 'moveItRegisteredAlb',
            instancesForTargetGroup: this.primaryTransferServers,
            recoveryInstancesForTargetGroup: this.recoveryTransferServers,
            targetPort: 443,
            targetProtocol: 'HTTPS',
            healthCheck: {
              path: '/',
              port: '443',
              protocol: 'HTTPS',
            },
            listeners: [
              {
                lbPort: 443,
                lbProtocol: 'HTTPS',
                name: 'moveIt-registered-alb-tls-listener',
                overrideListenerConstructName:
                  'moveit-registered-alb-tls-listener',
              },
            ],
          },
        ],
      },
      certDomainName: `move-it.registered.${this.stackConfig.envSubdomain}.dragonflyft.com`,
      networkBackendProps: this.serviceConfig.networkInstanceS3BackendProps,
      recoveryNetworkBackendProps:
        this.serviceConfig.recoveryNetworkInstanceS3BackendProps,
      providers: {
        constructProvider: this.primaryProvider,
        networkProvider: null,
        masterProvider: this.masterProvider,
        route53Provider: null,
        recoveryProvider: this.recoveryProvider,
      },
      customerDefinition: DfAccounts.customers.shared,
      deployToRegisteredCidr: true,
    });

    new DfCustomerNlbConstruct(this, 'moveit-sftp-vpn-nlb', this.stackConfig, {
      lbName: 'moveItSFTP-VPN-NLb',
      customerDefinition: DfAccounts.customers.shared,
      accountDefinition: this.stackConfig.accountDefinition,
      lbProps: {
        targetGroups: [
          {
            constructName: 'target',
            instancesForTargetGroup: this.primaryTransferServers,
            recoveryInstancesForTargetGroup: this.recoveryTransferServers,
            targetPort: 22,
            targetProtocol: 'TCP',
            listeners: [
              {
                name: 'listener',
                lbPort: 22,
                lbProtocol: 'TCP',
              },
            ],
          },
        ],
      },
      certDomainName: `moveit-sftp.internal.${this.stackConfig.envSubdomain}.dragonflyft.com`,
      networkBackendProps: this.serviceConfig.networkInstanceS3BackendProps,
      recoveryNetworkBackendProps:
        this.serviceConfig.recoveryNetworkInstanceS3BackendProps,
      providers: {
        constructProvider: this.primaryProvider,
        networkProvider: null,
        masterProvider: this.masterProvider,
        route53Provider: null,
        recoveryProvider: this.recoveryProvider,
      },
      deployToRegisteredCidr: false,
    });

    new DfCustomerNlbConstruct(
      this,
      'moveit-sftp-registered',
      this.stackConfig,
      {
        lbName: 'moveItSFTP-registered-NLb',
        customerDefinition: DfAccounts.customers.shared,
        accountDefinition: this.stackConfig.accountDefinition,
        lbProps: {
          targetGroups: [
            {
              constructName: 'target',
              instancesForTargetGroup: this.primaryTransferServers,
              recoveryInstancesForTargetGroup: this.recoveryTransferServers,
              targetPort: 22,
              targetProtocol: 'TCP',
              listeners: [
                {
                  name: 'listener',
                  lbPort: 22,
                  lbProtocol: 'TCP',
                },
              ],
            },
          ],
        },
        certDomainName: `moveit-sftp.registered.${this.stackConfig.envSubdomain}.dragonflyft.com`,
        networkBackendProps: this.serviceConfig.networkInstanceS3BackendProps,
        recoveryNetworkBackendProps:
          this.serviceConfig.recoveryNetworkInstanceS3BackendProps,
        providers: {
          constructProvider: this.primaryProvider,
          networkProvider: null,
          masterProvider: this.masterProvider,
          route53Provider: null,
          recoveryProvider: this.recoveryProvider,
        },
        deployToRegisteredCidr: true,
      }
    );
  }

  /**
   *
   * @param {string} region
   * @param {string} serverType
   * @return {string}
   */
  private getWindowsAmi(
    region: string,
    serverType?:
      | 'transfer'
      | 'transferSecondary'
      | 'automation'
      | 'automationSecondary'
  ): string {
    switch (region) {
      case Constants.AWS_REGION_MAP.DFPRIMARY:
        return Constants.MANAGED_AMI_IDS.DFPRIMARY[
          Constants.AMIS.WINDOWS_2022_DEFAULT
        ];
      case Constants.AWS_REGION_MAP.DFRECOVERY:
        switch (serverType) {
          case 'transfer':
            if (this.stackConfig.accountDefinition.accountType === 'prod') {
              return 'ami-027f7852e321a6c16';
            } else return 'ami-02a76957b69142736';
          case 'transferSecondary':
            if (this.stackConfig.accountDefinition.accountType === 'prod') {
              return 'ami-00e16d32931559cb2';
            } else return 'ami-0fddad5601561a30e';
          case 'automation':
            if (this.stackConfig.accountDefinition.accountType === 'prod') {
              return 'ami-0b6d8189def80067e';
            } else return 'ami-04f5d6205512c4abf';
          case 'automationSecondary':
            if (this.stackConfig.accountDefinition.accountType === 'prod') {
              return 'ami-0c97432dedc6e53bb';
            } else return 'ami-04f5d6205512c4abf';
        }
        break;
      case Constants.AWS_REGION_MAP.LEGACY:
        return Constants.MANAGED_AMI_IDS.LEGACY[
          Constants.AMIS.WINDOWS_2022_DEFAULT
        ];
    }
  }

  /**
   * Adds server to either primary or recovery server list
   * @param {AwsProvider} provider
   * @param {DfPrivateInstanceConstruct} server
   * @param {string} serverType
   */
  private addServerToList(
    provider: AwsProvider,
    server: DfPrivateInstanceConstruct,
    serverType: string
  ) {
    if (provider === this.primaryProvider && serverType === 'transfer') {
      this.primaryTransferServers.push(server);
    } else if (
      provider === this.primaryProvider &&
      serverType === 'automation'
    ) {
      this.primaryAutomationServers.push(server);
    } else if (
      provider === this.recoveryProvider &&
      serverType === 'transfer'
    ) {
      this.recoveryTransferServers.push(server);
    } else if (
      provider === this.recoveryProvider &&
      serverType === 'automation'
    ) {
      this.recoveryAutomationServers.push(server);
    }
  }

  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public get primaryTransferServersList(): DfPrivateInstanceConstruct[] {
    return this.primaryTransferServers;
  }

  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public get recoveryTransferServersList(): DfPrivateInstanceConstruct[] {
    return this.recoveryTransferServers;
  }
  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public get primaryAutomationServersList(): DfPrivateInstanceConstruct[] {
    return this.primaryAutomationServers;
  }

  /**
   * @return {DfPrivateInstanceConstruct[]}
   */
  public get recoveryAutomationServersList(): DfPrivateInstanceConstruct[] {
    return this.recoveryAutomationServers;
  }
}
