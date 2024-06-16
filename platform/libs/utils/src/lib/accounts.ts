import { Constants } from './constants';
import { AuthorizedGroupConfig } from './helpers';
import {
  CustomerSubnet,
  GatewayVpcRegionalCidrs,
  RegionalVpcCidrs,
} from './helpers/types';

export type accountNames =
  | 'aciProdSupport'
  | 'aftManagement'
  | 'architectureSandbox'
  | 'audit'
  | 'csiUat'
  | 'dev'
  | 'developerSandbox'
  | 'eastWestBankProd'
  | 'eastWestBankUat'
  | 'ebCit'
  | 'ebQe'
  | 'ebUat'
  | 'ebProd'
  | 'ist'
  | 'logArchive'
  | 'multiTenantProd'
  | 'multiTenantUat'
  | 'nonProdSharedNetwork'
  | 'performance'
  | 'platformSandbox'
  | 'platformSandboxSharedNetwork'
  | 'prodSharedNetwork'
  | 'qe'
  | 'santanderProd'
  | 'santanderUat'
  | 'sharedProd'
  | 'sharedTools'
  | 'sharedUat'
  | 'stateStreetprod'
  | 'stateStreetUat'
  | 'securitySandbox';

export type customerNames =
  | 'dragonfly'
  | 'csi'
  | 'eastWestBank'
  | 'ist'
  | 'muob'
  | 'santander'
  | 'stateStreet'
  | 'eb'
  | 'shared';

export type customerTypes = 'uob' | 'eb' | 'internal';
export type accountTypes =
  | 'prod'
  | 'uat'
  | 'ist'
  | 'sandbox'
  | 'dev'
  | 'qe'
  | 'internal'
  | 'nonProdNetwork'
  | 'prodNetwork'
  | 'perf';

export type GatewaySubnetConfig = {
  nonProdPrimaryGatewaySubnet: CustomerSubnet;
  nonProdRecoveryGatewaySubnet: CustomerSubnet;
  prodPrimaryGatewaySubnet: CustomerSubnet;
  prodRecoveryGatewaySubnet: CustomerSubnet;
  platformSandboxPrimaryGatewaySubnet: CustomerSubnet;
  platformSandboxRecoveryGatewaySubnet: CustomerSubnet;
};

export type CustomerDefinition = {
  customerType: customerTypes;
  customerName: customerNames;
  gatewaySubnetConfig?: GatewaySubnetConfig;
  accounts: AccountDefinition[];
};
export type DfCustomer = {
  [key in customerNames]: CustomerDefinition;
};

export type AccountDefinition = {
  name: string;
  accountNumber: string;
  accountType: accountTypes;
  alias: string;
  complianceScoped: boolean;
  platformSandbox: boolean;
  ouId: string;
  organizationalUnit: string;
  additionalAuthorizedGroupConfigs: AuthorizedGroupConfig[];
  networkType:
    | 'sharedNetwork'
    | 'nonProd'
    | 'prod'
    | 'ps'
    | 'none'
    | 'isolated';
  primaryRegion: Constants.AWS_REGION_ALIASES;
  recoveryRegion: Constants.AWS_REGION_ALIASES;
  vpcCidrs: {
    main?: RegionalVpcCidrs;
    inspection?: RegionalVpcCidrs;
    clientVpn?: RegionalVpcCidrs;
    gateway?: GatewayVpcRegionalCidrs;
  };
  refrainFromRecoveryDeployment?: boolean;
};

export type DfAccount = {
  [key in accountNames]: AccountDefinition;
};

/**
 * Object describing Dragonfly FT AWS accounts
 */
export abstract class DfAccounts {
  static readonly customers: DfCustomer = {
    eb: {
      customerType: 'eb',
      customerName: 'eb',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'eb',
          purpose: 'Subnet for Eb',
          azCidrRanges: {
            azA: '100.95.22.0/27',
            azB: '100.95.22.32/27',
            azC: '100.95.22.64/27',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'eb',
          purpose: 'Subnet for Eb',
          azCidrRanges: {
            azA: '100.115.22.0/27',
            azB: '100.115.22.32/27',
            azC: '100.115.22.64/27',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'eb',
          purpose: 'Subnet for Eb',
          azCidrRanges: {
            azA: '198.18.22.0/27',
            azB: '198.18.22.32/27',
            azC: '198.18.22.64/27',
          },
          customerNat: {
            uat: '10.252.22.0/27',
            prod: '10.252.22.32/27',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'eb',
          purpose: 'Subnet for Eb',
          azCidrRanges: {
            azA: '198.19.22.0/27',
            azB: '198.19.22.32/27',
            azC: '198.19.22.64/27',
          },
          customerNat: {
            uat: '10.254.22.0/27',
            prod: '10.254.22.32/27',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'eb',
          purpose: 'Subnet for Eb',
          azCidrRanges: {
            azA: '10.104.22.0/27',
            azB: '10.104.22.32/27',
            azC: '10.104.22.64/27',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'eb',
          purpose: 'Subnet for Eb',
          azCidrRanges: {
            azA: '10.102.22.0/27',
            azB: '10.102.22.32/27',
            azC: '10.102.22.64/27',
          },
        },
      },
      accounts: [
        {
          name: 'EbCit',
          accountType: 'qe',
          accountNumber: '746597437630',
          alias: 'eb-cit',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.QE_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.QE_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'AWS EB Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_EB_ADMINS,
              authroizedGroupDescription: 'AWS EB Admins',
            },
          ],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.38.0.0/16',
              recovery: '10.39.0.0/16',
            },
          },
        },
        {
          name: 'EbQe',
          accountType: 'qe',
          accountNumber: '752642178475',
          alias: 'eb-qe',
          complianceScoped: false,
          platformSandbox: false,
          ouId: Constants.QE_OU_ID,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          organizationalUnit: Constants.OU_ID_MAP[Constants.QE_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.40.0.0/16',
              recovery: '10.41.0.0/16',
            },
          },
        },
        {
          name: 'EbUat',
          accountType: 'uat',
          accountNumber: '370920975040',
          alias: 'eb-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.42.0.0/16',
              recovery: '10.43.0.0/16',
            },
          },
        },
        {
          name: 'EbProd',
          accountType: 'prod',
          accountNumber: '256273496362',
          alias: 'eb-prod',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.44.0.0/16',
              recovery: '10.45.0.0/16',
            },
          },
        },
      ],
    },
    shared: {
      customerType: 'uob',
      customerName: 'shared',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'shared',
          purpose: 'Subnet for Shared',
          azCidrRanges: {
            azA: '100.95.23.0/27',
            azB: '100.95.23.32/27',
            azC: '100.95.23.64/27',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'shared',
          purpose: 'Subnet for Shared',
          azCidrRanges: {
            azA: '100.115.23.0/27',
            azB: '100.115.23.32/27',
            azC: '100.115.23.64/27',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'shared',
          purpose: 'Subnet for Shared',
          azCidrRanges: {
            azA: '198.18.23.0/27',
            azB: '198.18.23.32/27',
            azC: '198.18.23.64/27',
          },
          customerNat: {
            uat: '10.252.23.0/27',
            prod: '10.252.23.32/27',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'shared',
          purpose: 'Subnet for Shared',
          azCidrRanges: {
            azA: '198.19.23.0/27',
            azB: '198.19.23.32/27',
            azC: '198.19.23.64/27',
          },
          customerNat: {
            uat: '10.254.23.0/27',
            prod: '10.254.23.32/27',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'shared',
          purpose: 'Subnet for shared',
          azCidrRanges: {
            azA: '10.104.23.0/27',
            azB: '10.104.23.32/27',
            azC: '10.104.23.64/27',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'shared',
          purpose: 'Subnet for shared',
          azCidrRanges: {
            azA: '10.102.23.0/27',
            azB: '10.102.23.32/27',
            azC: '10.102.23.64/27',
          },
        },
      },
      accounts: [
        {
          name: 'SharedProd',
          accountType: 'prod',
          accountNumber: '639483828455',
          alias: 'shared-prod',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'UC4 Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_UC4_ADMINS,
              authroizedGroupDescription: 'UC4 Admins',
            },
            {
              authorizedGroupName: 'MoveIT Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_MOVEIT_ADMINS,
              authroizedGroupDescription: 'MoveIT Admins',
            },
            {
              authorizedGroupName: 'AWS MoveIT Web Interface & SFTP',
              authorizedGroupId:
                Constants.AUTHORIZED_GROUP_MOVEIT_WEB_INTERFACE_AND_SFTP,
              authroizedGroupDescription: 'AWS MoveIT Web Interface & SFTP',
            },
          ],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.30.0.0/16',
              recovery: '10.31.0.0/16',
            },
          },
        },
        {
          name: 'SharedUAT',
          accountType: 'uat',
          accountNumber: '344860351693',
          alias: 'shared-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'UC4 Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_UC4_ADMINS,
              authroizedGroupDescription: 'UC4 Admins',
            },
            {
              authorizedGroupName: 'MoveIT Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_MOVEIT_ADMINS,
              authroizedGroupDescription: 'MoveIT Admins',
            },
            {
              authorizedGroupName: 'AWS MoveIT Web Interface & SFTP',
              authorizedGroupId:
                Constants.AUTHORIZED_GROUP_MOVEIT_WEB_INTERFACE_AND_SFTP,
              authroizedGroupDescription: 'AWS MoveIT Web Interface & SFTP',
            },
          ],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.10.0.0/16',
              recovery: '10.27.0.0/16',
            },
          },
        },
      ],
    },
    dragonfly: {
      customerType: 'internal',
      customerName: 'dragonfly',
      accounts: [
        {
          name: 'Log Archive',
          accountType: 'internal',
          accountNumber: '506625313654',
          alias: 'log-archive',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.MASTER_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.MASTER_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'none',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: 'na',
              recovery: 'na',
            },
          },
        },
        {
          name: 'AciProdSupport',
          accountType: 'prod',
          accountNumber: '273731360122',
          alias: 'aci-prod-support',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          refrainFromRecoveryDeployment: true,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'isolated',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.54.0.0/16',
              recovery: '10.55.0.0/16',
            },
          },
        },
        {
          name: 'ATF-Management',
          accountType: 'internal',
          accountNumber: '836063030363',
          alias: 'atf-management',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.AFT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.AFT_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'none',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: 'na',
              recovery: 'na',
            },
          },
        },
        {
          name: 'ArchitectureSandbox',
          accountType: 'sandbox',
          accountNumber: '327441322700',
          alias: 'architecture-sandbox',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.SANDBOX_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.SANDBOX_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'allVpnUsers',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_SINGLE_SIGN_ON,
              authroizedGroupDescription:
                'Architecture Sandbox VPC all VPN users',
            },
          ],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: '10.6.0.0/16',
              primary: '10.14.0.0/16',
              recovery: '10.23.0.0/16',
            },
          },
        },
        {
          name: 'audit',
          accountType: 'internal',
          accountNumber: '235848468354',
          alias: 'audit',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.MASTER_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.MASTER_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'none',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: 'na',
              recovery: 'na',
            },
          },
        },
        {
          name: 'Dev',
          accountType: 'dev',
          accountNumber: '824249975673',
          alias: 'dev',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.DEV_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.DEV_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: '10.2.0.0/16',
              primary: '10.18.0.0/16',
              recovery: '10.19.0.0/16',
            },
          },
        },
        {
          name: 'DeveloperSandbox',
          accountType: 'sandbox',
          accountNumber: '358219470856',
          alias: 'developer-sandbox',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.SANDBOX_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.SANDBOX_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: null,
              authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_SINGLE_SIGN_ON,
              authroizedGroupDescription: null,
            },
          ],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: '10.4.0.0/16',
              primary: '10.12.0.0/16',
              recovery: '10.21.0.0/16',
            },
          },
        },
        {
          name: 'nonProdSharedNetwork',
          accountType: 'nonProdNetwork',
          accountNumber: '413455294286',
          alias: 'non-prod-shared-network',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.NETWORK_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.NETWORK_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'sharedNetwork',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: 'na',
              recovery: 'na',
            },
            inspection: {
              legacy: '172.16.0.0/16',
              primary: '172.30.0.0/16',
              recovery: '172.31.0.0/16',
            },
            clientVpn: {
              legacy: '172.20.0.0/16',
              primary: '172.21.0.0/16',
              recovery: '172.22.0.0/16',
            },
            gateway: {
              legacy: {
                gatewayVpcCidr: '10.90.0.0/16',
                clientVpnCidr: '172.20.0.0/16',
                subnets: {
                  egress: {
                    azA: '10.90.0.0/27',
                    azB: '10.90.0.32/27',
                    azC: '10.90.0.64/27',
                  },
                  archReserved: {
                    azA: '10.90.2.0/27',
                    azB: '10.90.2.32/27',
                    azC: '10.90.2.64/27',
                  },
                  internet: {
                    azA: '10.90.3.0/27',
                    azB: '10.90.3.32/27',
                    azC: '10.90.3.64/27',
                  },
                  transit: {
                    azA: '10.90.1.0/28',
                    azB: '10.90.1.16/28',
                    azC: '10.90.1.32/28',
                  },
                  clientVpn: {
                    azA: '10.90.4.0/24',
                    azB: '10.90.5.0/24',
                    azC: '10.90.6.0/24',
                  },
                  customerEdge: {
                    azA: '10.90.7.0/28',
                    azB: '10.90.7.16/28',
                    azC: '10.90.7.32/28',
                  },
                  globalProtect: '10.90.1.48/28',
                },
              },
              primary: {
                gatewayVpcCidr: '100.95.0.0/16',
                clientVpnCidr: '172.21.0.0/16',
                subnets: {
                  egress: {
                    azA: '100.95.0.0/27',
                    azB: '100.95.0.32/27',
                    azC: '100.95.0.64/27',
                  },
                  archReserved: {
                    azA: '100.95.2.0/27',
                    azB: '100.95.2.32/27',
                    azC: '100.95.2.64/27',
                  },
                  internet: {
                    azA: '100.95.3.0/27',
                    azB: '100.95.3.32/27',
                    azC: '100.95.3.64/27',
                  },
                  transit: {
                    azA: '100.95.1.0/28',
                    azB: '100.95.1.16/28',
                    azC: '100.95.1.32/28',
                  },
                  clientVpn: {
                    azA: '100.95.4.0/24',
                    azB: '100.95.5.0/24',
                    azC: '100.95.6.0/24',
                  },
                  customerEdge: {
                    azA: '100.95.7.0/28',
                    azB: '100.95.7.16/28',
                    azC: '100.95.7.32/28',
                  },
                  globalProtect: '100.95.1.48/28',
                },
              },
              recovery: {
                gatewayVpcCidr: '100.115.0.0/16',
                clientVpnCidr: '172.22.0.0/16',
                subnets: {
                  egress: {
                    azA: '100.115.0.0/27',
                    azB: '100.115.0.32/27',
                    azC: '100.115.0.64/27',
                  },
                  archReserved: {
                    azA: '100.115.2.0/27',
                    azB: '100.115.2.32/27',
                    azC: '100.115.2.64/27',
                  },
                  internet: {
                    azA: '100.115.3.0/27',
                    azB: '100.115.3.32/27',
                    azC: '100.115.3.64/27',
                  },
                  transit: {
                    azA: '100.115.1.0/28',
                    azB: '100.115.1.16/28',
                    azC: '100.115.1.32/28',
                  },
                  clientVpn: {
                    azA: '100.115.4.0/24',
                    azB: '100.115.5.0/24',
                    azC: '100.115.6.0/24',
                  },
                  customerEdge: {
                    azA: '100.115.7.0/28',
                    azB: '100.115.7.16/28',
                    azC: '100.115.7.32/28',
                  },
                  globalProtect: '100.115.1.48/28',
                },
              },
            },
          },
        },
        {
          name: 'Performance',
          accountType: 'perf',
          accountNumber: '260869750235',
          alias: 'performance',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PERFORMANCE_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PERFORMANCE_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'allVpnUsers',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_SINGLE_SIGN_ON,
              authroizedGroupDescription: 'Performance VPC Dev VPN access',
            },
          ],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: '10.7.0.0/16',
              primary: '10.15.0.0/16',
              recovery: '10.24.0.0/16',
            },
          },
        },
        {
          name: 'platformSandbox',
          accountType: 'sandbox',
          accountNumber: '259311287469',
          alias: 'platform-sandbox',
          complianceScoped: false,
          platformSandbox: true,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.SANDBOX_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.SANDBOX_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'AWS Jenkins Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_JENKINS_ADMINS,
              authroizedGroupDescription:
                'Grants network access to Platform Sandbox for all Jenkns Admins',
            },
          ],
          networkType: 'sharedNetwork',
          vpcCidrs: {
            main: {
              legacy: '10.5.0.0/16',
              primary: '10.13.0.0/16',
              recovery: '10.22.0.0/16',
            },
          },
        },
        {
          name: 'PlatformSandboxSharedNetwork',
          accountType: 'nonProdNetwork',
          accountNumber: '117875293752',
          alias: 'platform-sandbox-shared-network',
          complianceScoped: false,
          platformSandbox: true,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.SANDBOX_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.SANDBOX_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'AWS Jenkins Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_JENKINS_ADMINS,
              authroizedGroupDescription:
                'Grants network access to Platform Sandbox for all Jenkns Admins',
            },
          ],
          networkType: 'sharedNetwork',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: 'na',
              recovery: 'na',
            },
            inspection: {
              legacy: '172.17.0.0/16',
              primary: '172.19.0.0/16',
              recovery: '172.18.0.0/16',
            },
            clientVpn: {
              legacy: '192.168.0.0/17',
              primary: '192.168.128.0/20',
              recovery: '192.168.144.0/20',
            },
            gateway: {
              legacy: {
                gatewayVpcCidr: '10.100.0.0/16',
                clientVpnCidr: '192.168.0.0/17',
                subnets: {
                  egress: {
                    azA: '10.100.0.0/27',
                    azB: '10.100.0.32/27',
                    azC: '10.100.0.64/27',
                  },
                  archReserved: {
                    azA: '10.100.2.0/27',
                    azB: '10.100.2.32/27',
                    azC: '10.100.2.64/27',
                  },
                  internet: {
                    azA: '10.100.3.0/27',
                    azB: '10.100.3.32/27',
                    azC: '10.100.3.64/27',
                  },
                  transit: {
                    azA: '10.100.1.0/28',
                    azB: '10.100.1.16/28',
                    azC: '10.100.1.32/28',
                  },
                  clientVpn: {
                    azA: '10.100.4.0/24',
                    azB: '10.100.5.0/24',
                    azC: '10.100.6.0/24',
                  },
                  customerEdge: {
                    azA: '10.100.7.0/28',
                    azB: '10.100.7.16/28',
                    azC: '10.100.7.32/28',
                  },
                },
              },
              primary: {
                gatewayVpcCidr: '10.104.0.0/16',
                clientVpnCidr: '192.168.128.0/20',
                subnets: {
                  egress: {
                    azA: '10.104.0.0/27',
                    azB: '10.104.0.32/27',
                    azC: '10.104.0.64/27',
                  },
                  archReserved: {
                    azA: '10.104.2.0/27',
                    azB: '10.104.2.32/27',
                    azC: '10.104.2.64/27',
                  },
                  internet: {
                    azA: '10.104.3.0/27',
                    azB: '10.104.3.32/27',
                    azC: '10.104.3.64/27',
                  },
                  transit: {
                    azA: '10.104.1.0/28',
                    azB: '10.104.1.16/28',
                    azC: '10.104.1.32/28',
                  },
                  clientVpn: {
                    azA: '10.104.4.0/24',
                    azB: '10.104.5.0/24',
                    azC: '10.104.6.0/24',
                  },
                  customerEdge: {
                    azA: '10.104.7.0/28',
                    azB: '10.104.7.16/28',
                    azC: '10.104.7.32/28',
                  },
                },
              },
              recovery: {
                gatewayVpcCidr: '10.102.0.0/16',
                clientVpnCidr: '192.168.144.0/20',
                subnets: {
                  egress: {
                    azA: '10.102.0.0/27',
                    azB: '10.102.0.32/27',
                    azC: '10.102.0.64/27',
                  },
                  archReserved: {
                    azA: '10.102.2.0/27',
                    azB: '10.102.2.32/27',
                    azC: '10.102.2.64/27',
                  },
                  internet: {
                    azA: '10.102.3.0/27',
                    azB: '10.102.3.32/27',
                    azC: '10.102.3.64/27',
                  },
                  transit: {
                    azA: '10.102.1.0/28',
                    azB: '10.102.1.16/28',
                    azC: '10.102.1.32/28',
                  },
                  clientVpn: {
                    azA: '10.102.4.0/24',
                    azB: '10.102.5.0/24',
                    azC: '10.102.6.0/24',
                  },
                  customerEdge: {
                    azA: '10.102.7.0/28',
                    azB: '10.102.7.16/28',
                    azC: '10.102.7.32/28',
                  },
                },
              },
            },
          },
        },
        {
          name: 'ProdSharedNetwork',
          accountType: 'prodNetwork',
          accountNumber: '008257427062',
          alias: 'prod-shared-network',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.NETWORK_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.NETWORK_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'sharedNetwork',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: 'na',
              recovery: 'na',
            },
            inspection: {
              legacy: '172.17.0.0/16',
              primary: '172.18.0.0/16',
              recovery: '172.19.0.0/16',
            },
            clientVpn: {
              legacy: '192.168.0.0/17',
              primary: '192.168.128.0/20',
              recovery: '192.168.144.0/20',
            },
            gateway: {
              legacy: {
                gatewayVpcCidr: '10.0.0.0/16',
                clientVpnCidr: '192.168.0.0/17',
                subnets: {
                  egress: {
                    azA: '10.0.0.0/27',
                    azB: '10.0.0.32/27',
                    azC: '10.0.0.64/27',
                  },
                  archReserved: {
                    azA: '10.0.2.0/27',
                    azB: '10.0.2.32/27',
                    azC: '10.0.2.64/27',
                  },
                  internet: {
                    azA: '10.0.3.0/27',
                    azB: '10.0.3.32/27',
                    azC: '10.0.3.64/27',
                  },
                  internetXL: {
                    azA: '10.0.100.0/22',
                    azB: '10.0.104.0/22',
                    azC: '10.0.108.0/22',
                  },
                  transit: {
                    azA: '10.0.1.0/28',
                    azB: '10.0.1.16/28',
                    azC: '10.0.1.32/28',
                  },
                  clientVpn: {
                    azA: '10.0.4.0/24',
                    azB: '10.0.5.0/24',
                    azC: '10.0.6.0/24',
                  },
                  customerEdge: {
                    azA: '10.0.7.0/28',
                    azB: '10.0.7.16/28',
                    azC: '10.0.7.32/28',
                  },
                },
              },
              primary: {
                gatewayVpcCidr: '198.18.0.0/16',
                additionalCidrs: ['66.234.15.0/24'],
                clientVpnCidr: '192.168.128.0/20',
                subnets: {
                  egress: {
                    azA: '198.18.0.0/27',
                    azB: '198.18.0.32/27',
                    azC: '198.18.0.64/27',
                  },
                  archReserved: {
                    azA: '198.18.2.0/27',
                    azB: '198.18.2.32/27',
                    azC: '198.18.2.64/27',
                  },
                  internet: {
                    azA: '198.18.3.0/27',
                    azB: '198.18.3.32/27',
                    azC: '198.18.3.64/27',
                  },
                  internetXL: {
                    azA: '198.18.100.0/22',
                    azB: '198.18.104.0/22',
                    azC: '198.18.108.0/22',
                  },
                  transit: {
                    azA: '198.18.7.0/28',
                    azB: '198.18.7.16/28',
                    azC: '198.18.7.32/28',
                  },
                  clientVpn: {
                    azA: '198.18.4.0/24',
                    azB: '198.18.5.0/24',
                    azC: '198.18.6.0/24',
                  },
                  customerEdge: {
                    azA: '198.18.1.0/28',
                    azB: '198.18.1.16/28',
                    azC: '198.18.1.32/28',
                  },
                  pupiCustomerEdge: {
                    azA: '66.234.15.0/26',
                    azB: '66.234.15.64/26',
                  },
                },
              },
              recovery: {
                gatewayVpcCidr: '198.19.0.0/16',
                additionalCidrs: ['66.234.15.0/24'],
                clientVpnCidr: '192.168.144.0/20',
                subnets: {
                  egress: {
                    azA: '198.19.0.0/27',
                    azB: '198.19.0.32/27',
                    azC: '198.19.0.64/27',
                  },
                  archReserved: {
                    azA: '198.19.2.0/27',
                    azB: '198.19.2.32/27',
                    azC: '198.19.2.64/27',
                  },
                  internet: {
                    azA: '198.19.3.0/27',
                    azB: '198.19.3.32/27',
                    azC: '198.19.3.64/27',
                  },
                  internetXL: {
                    azA: '198.19.100.0/22',
                    azB: '198.19.104.0/22',
                    azC: '198.19.108.0/22',
                  },
                  transit: {
                    azA: '198.19.7.0/28',
                    azB: '198.19.7.16/28',
                    azC: '198.19.7.32/28',
                  },
                  clientVpn: {
                    azA: '198.19.4.0/24',
                    azB: '198.19.5.0/24',
                    azC: '198.19.6.0/24',
                  },
                  customerEdge: {
                    azA: '198.19.1.0/28',
                    azB: '198.19.1.16/28',
                    azC: '198.19.1.32/28',
                  },
                  pupiCustomerEdge: {
                    azA: '66.234.15.128/26',
                    azB: '66.234.15.192/26',
                  },
                },
              },
            },
          },
        },
        {
          name: 'QE',
          accountType: 'qe',
          accountNumber: '876883457223',
          alias: 'qe',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.QE_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.QE_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: '10.8.0.0/16',
              primary: '10.16.0.0/16',
              recovery: '10.25.0.0/16',
            },
          },
        },
        {
          name: 'SharedTools',
          accountType: 'prod',
          accountNumber: '207348267374',
          alias: 'tools',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.TOOLS_OU_ID,
          refrainFromRecoveryDeployment: true,
          organizationalUnit: Constants.OU_ID_MAP[Constants.TOOLS_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'AWS Single Sign on users',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_SINGLE_SIGN_ON,
              authroizedGroupDescription: 'AWS Single Sign on users',
            },
            {
              authorizedGroupName: 'QE Dev Group Fisheye 1',
              authorizedGroupId: '8b88549a-6257-46f8-871a-38edd35793eb',
              authroizedGroupDescription: 'Allow devs internal Fisheye access',
              authorizedCidr: '10.180.64.54/32',
            },
            {
              authorizedGroupName: 'QE Dev Group Fisheye 2',
              authorizedGroupId: '8b88549a-6257-46f8-871a-38edd35793eb',
              authroizedGroupDescription: 'Allow devs internal Fisheye access',
              authorizedCidr: '10.180.56.251/32',
            },
            {
              authorizedGroupName: 'QE Dev Group Fisheye 3',
              authorizedGroupId: '8b88549a-6257-46f8-871a-38edd35793eb',
              authroizedGroupDescription: 'Allow devs internal Fisheye access',
              authorizedCidr: '10.180.92.95/32',
            },
          ],
          networkType: 'sharedNetwork',
          vpcCidrs: {
            main: {
              legacy: '10.3.0.0/16',
              primary: '10.11.0.0/16',
              recovery: '10.20.0.0/16',
            },
          },
        },
        {
          name: 'SecSandbox',
          accountType: 'sandbox',
          accountNumber: '679068833598',
          alias: 'security-sandbox',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.SANDBOX_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.SANDBOX_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupId: Constants.AUTHORIZED_GROUP_AWS_SECURITY,
              authorizedGroupName: 'Aws security',
              authroizedGroupDescription: 'Security group',
            },
          ],
          networkType: 'nonProd',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.56.0.0/16',
              recovery: '10.57.0.0/16',
            },
          },
        },
      ],
    },
    csi: {
      customerType: 'uob',
      customerName: 'csi',
      accounts: [
        {
          name: 'CsiUat',
          accountType: 'uat',
          accountNumber: '294542547211',
          alias: 'csi-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.62.0.0/16',
              recovery: '10.63.0.0/16',
            },
          },
        },
      ],
    },
    eastWestBank: {
      customerType: 'uob',
      customerName: 'eastWestBank',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'ewb',
          purpose: 'Subnet for East West Bank',
          azCidrRanges: {
            azA: '100.95.20.0/27',
            azB: '100.95.20.32/27',
            azC: '100.95.20.64/27',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'ewb',
          purpose: 'Subnet for East West Bank',
          azCidrRanges: {
            azA: '100.115.20.0/27',
            azB: '100.115.20.32/27',
            azC: '100.115.20.64/27',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'ewb',
          purpose: 'Subnet for East West Bank',
          azCidrRanges: {
            azA: '198.18.20.0/27',
            azB: '198.18.20.32/27',
            azC: '198.18.20.64/27',
          },
          customerNat: {
            uat: '10.252.20.0/27',
            prod: '10.252.20.32/27',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'ewb',
          purpose: 'Subnet for East West Bank',
          azCidrRanges: {
            azA: '198.19.20.0/27',
            azB: '198.19.20.32/27',
            azC: '198.19.20.64/27',
          },
          customerNat: {
            uat: '10.254.20.0/27',
            prod: '10.254.20.32/27',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'ewb',
          purpose: 'Subnet for East West Bank',
          azCidrRanges: {
            azA: '10.104.20.0/27',
            azB: '10.104.20.32/27',
            azC: '10.104.20.64/27',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'ewb',
          purpose: 'Subnet for East West Bank',
          azCidrRanges: {
            azA: '10.102.20.0/27',
            azB: '10.102.20.32/27',
            azC: '10.102.20.64/27',
          },
        },
      },
      accounts: [
        {
          name: 'EastWestBankProd',
          accountType: 'prod',
          accountNumber: '505874256341',
          alias: 'east-west-bank-prod',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.36.0.0/16',
              recovery: '10.37.0.0/16',
            },
          },
        },
        {
          name: 'EastWestBankUAT',
          accountType: 'uat',
          accountNumber: '190240132920',
          alias: 'east-west-bank-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'UC4 Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_UC4_ADMINS,
              authroizedGroupDescription: 'UC4 Admins',
            },
            {
              authorizedGroupName: 'MoveIT Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_MOVEIT_ADMINS,
              authroizedGroupDescription: 'MoveIT Admins',
            },
          ],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.28.0.0/16',
              recovery: '10.29.0.0/16',
            },
          },
        },
      ],
    },
    ist: {
      customerType: 'uob',
      customerName: 'ist',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'ist',
          purpose: 'Subnet for Ist',
          azCidrRanges: {
            azA: '100.95.25.0/27',
            azB: '100.95.25.32/27',
            azC: '100.95.25.64/27',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'ist',
          purpose: 'Subnet for Ist',
          azCidrRanges: {
            azA: '100.115.25.0/27',
            azB: '100.115.25.32/27',
            azC: '100.115.25.64/27',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'ist',
          purpose: 'Subnet for Ist',
          azCidrRanges: {
            azA: '198.18.25.0/27',
            azB: '198.18.25.32/27',
            azC: '198.18.25.64/27',
          },
          customerNat: {
            uat: '10.252.25.0/14',
            prod: '10.252.25.0/14',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'ist',
          purpose: 'Subnet for Ist',
          azCidrRanges: {
            azA: '198.19.25.0/27',
            azB: '198.19.25.32/27',
            azC: '198.19.25.64/27',
          },
          customerNat: {
            uat: '10.254.25.0/14',
            prod: '10.254.25.0/14',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'ist',
          purpose: 'Subnet for Ist',
          azCidrRanges: {
            azA: '10.104.25.0/27',
            azB: '10.104.25.32/27',
            azC: '10.104.25.64/27',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'ist',
          purpose: 'Subnet for Ist',
          azCidrRanges: {
            azA: '10.102.25.0/27',
            azB: '10.102.25.32/27',
            azC: '10.102.25.64/27',
          },
        },
      },
      accounts: [
        {
          name: 'IST',
          accountType: 'ist',
          accountNumber: '900339839666',
          alias: 'ist',
          complianceScoped: false,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.LEGACY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.IST_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.IST_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'Group for IST DBAs',
              authorizedGroupId: 'ca2e3273-552d-44cf-8dee-982f8de20176',
              authroizedGroupDescription: 'IST DBAs',
            },
            {
              authorizedGroupName: 'Group for IST users',
              authorizedGroupId: '4014d478-2e3f-480c-9813-7665e8a08377',
              authroizedGroupDescription: 'IST Users',
            },
          ],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: '10.9.0.0/16',
              primary: '10.58.0.0/16',
              recovery: '10.26.0.0/16',
            },
          },
        },
      ],
    },
    muob: {
      customerType: 'uob',
      customerName: 'muob',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'muob',
          purpose: 'Subnet for Muob',
          azCidrRanges: {
            azA: '100.95.10.0/26',
            azB: '100.95.10.64/26',
            azC: '100.95.10.128/26',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'muob',
          purpose: 'Subnet for Muob',
          azCidrRanges: {
            azA: '100.115.10.0/26',
            azB: '100.115.10.64/26',
            azC: '100.115.10.128/26',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'muob',
          purpose: 'Subnet for Muob',
          azCidrRanges: {
            azA: '198.18.10.0/26',
            azB: '198.18.10.64/26',
            azC: '198.18.10.128/26',
          },
          customerNat: {
            uat: '10.252.10.0/27',
            prod: '10.252.10.32/27',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'muob',
          purpose: 'Subnet for Muob',
          azCidrRanges: {
            azA: '198.19.10.0/26',
            azB: '198.19.10.64/26',
            azC: '198.19.10.128/26',
          },
          customerNat: {
            uat: '10.254.10.0/27',
            prod: '10.254.10.32/27',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'muob',
          purpose: 'Subnet for Muob',
          azCidrRanges: {
            azA: '10.104.10.0/26',
            azB: '10.104.10.64/26',
            azC: '10.104.10.128/26',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'muob',
          purpose: 'Subnet for Muob',
          azCidrRanges: {
            azA: '10.102.10.0/26',
            azB: '10.102.10.64/26',
            azC: '10.102.10.128/26',
          },
        },
      },
      accounts: [
        {
          name: 'MultiTenantProd',
          accountType: 'prod',
          accountNumber: '251147478556',
          alias: 'multi-tenant-prod',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.52.0.0/16',
              recovery: '10.53.0.0/16',
            },
          },
        },
        {
          name: 'MultiTenantUAT',
          accountType: 'uat',
          accountNumber: '918714997132',
          alias: 'multi-tenant-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.34.0.0/16',
              recovery: '10.35.0.0/16',
            },
          },
        },
      ],
    },
    santander: {
      customerType: 'uob',
      customerName: 'santander',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'santander',
          purpose: 'Subnet for Santander',
          azCidrRanges: {
            azA: '100.95.21.0/27',
            azB: '100.95.21.32/27',
            azC: '100.95.21.64/27',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'santander',
          purpose: 'Subnet for Santander',
          azCidrRanges: {
            azA: '100.115.21.0/27',
            azB: '100.115.21.32/27',
            azC: '100.115.21.64/27',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'santander',
          purpose: 'Subnet for Santander',
          azCidrRanges: {
            azA: '198.18.21.0/27',
            azB: '198.18.21.32/27',
            azC: '198.18.21.64/27',
          },
          customerNat: {
            uat: '10.252.21.0/27',
            prod: '10.252.21.32/27',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'santander',
          purpose: 'Subnet for Santander',
          azCidrRanges: {
            azA: '198.19.21.0/27',
            azB: '198.19.21.32/27',
            azC: '198.19.21.64/27',
          },
          customerNat: {
            uat: '10.254.21.0/27',
            prod: '10.254.21.32/27',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'santander',
          purpose: 'Subnet for Santander',
          azCidrRanges: {
            azA: '10.104.21.0/27',
            azB: '10.104.21.32/27',
            azC: '10.104.21.64/27',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'santander',
          purpose: 'Subnet for Santander',
          azCidrRanges: {
            azA: '10.102.21.0/27',
            azB: '10.102.21.32/27',
            azC: '10.102.21.64/27',
          },
        },
      },
      accounts: [
        {
          name: 'SantanderProd',
          accountType: 'prod',
          accountNumber: '536264819586',
          alias: 'santander-prod',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.50.0.0/16',
              recovery: '10.51.0.0/16',
            },
          },
        },
        {
          name: 'SantanderUAT',
          accountType: 'uat',
          accountNumber: '856665374486',
          alias: 'santander-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.32.0.0/16',
              recovery: '10.33.0.0/16',
            },
          },
        },
      ],
    },
    stateStreet: {
      customerType: 'uob',
      customerName: 'stateStreet',
      gatewaySubnetConfig: {
        nonProdPrimaryGatewaySubnet: {
          subnetName: 'stateStreet',
          purpose: 'Subnet for State Street',
          azCidrRanges: {
            azA: '100.95.24.0/27',
            azB: '100.95.24.32/27',
            azC: '100.95.24.64/27',
          },
        },
        nonProdRecoveryGatewaySubnet: {
          subnetName: 'stateStreet',
          purpose: 'Subnet for State Street',
          azCidrRanges: {
            azA: '100.115.24.0/27',
            azB: '100.115.24.32/27',
            azC: '100.115.24.64/27',
          },
        },
        prodPrimaryGatewaySubnet: {
          subnetName: 'stateStreet',
          purpose: 'Subnet for State Street',
          azCidrRanges: {
            azA: '198.18.24.0/27',
            azB: '198.18.24.32/27',
            azC: '198.18.24.64/27',
          },
          customerNat: {
            uat: '10.252.24.0/27',
            prod: '10.252.24.32/27',
          },
        },
        prodRecoveryGatewaySubnet: {
          subnetName: 'stateStreet',
          purpose: 'Subnet for State Street',
          azCidrRanges: {
            azA: '198.19.24.0/27',
            azB: '198.19.24.32/27',
            azC: '198.19.24.64/27',
          },
          customerNat: {
            uat: '10.254.24.0/27',
            prod: '10.254.24.32/27',
          },
        },
        platformSandboxPrimaryGatewaySubnet: {
          subnetName: 'stateStreet',
          purpose: 'Subnet for State Street',
          azCidrRanges: {
            azA: '10.104.24.0/27',
            azB: '10.104.24.32/27',
            azC: '10.104.24.64/27',
          },
        },
        platformSandboxRecoveryGatewaySubnet: {
          subnetName: 'stateStreet',
          purpose: 'Subnet for State Street',
          azCidrRanges: {
            azA: '10.102.24.0/27',
            azB: '10.102.24.32/27',
            azC: '10.102.24.64/27',
          },
        },
      },
      accounts: [
        {
          name: 'StateStreetProd',
          accountType: 'prod',
          accountNumber: '031810701581',
          alias: 'state-street-prod',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.PROD_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.PROD_OU_ID],
          additionalAuthorizedGroupConfigs: [],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.48.0.0/16',
              recovery: '10.49.0.0/16',
            },
          },
        },
        {
          name: 'StateStreetUAT',
          accountType: 'uat',
          accountNumber: '713902029510',
          alias: 'state-street-uat',
          complianceScoped: true,
          platformSandbox: false,
          primaryRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
          recoveryRegion: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
          ouId: Constants.UAT_OU_ID,
          organizationalUnit: Constants.OU_ID_MAP[Constants.UAT_OU_ID],
          additionalAuthorizedGroupConfigs: [
            {
              authorizedGroupName: 'UC4 Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_UC4_ADMINS,
              authroizedGroupDescription: 'UC4 Admins',
            },
            {
              authorizedGroupName: 'MoveIT Admins',
              authorizedGroupId: Constants.AUTHORIZED_GROUP_MOVEIT_ADMINS,
              authroizedGroupDescription: 'MoveIT Admins',
            },
          ],
          networkType: 'prod',
          vpcCidrs: {
            main: {
              legacy: 'na',
              primary: '10.46.0.0/16',
              recovery: '10.47.0.0/16',
            },
          },
        },
      ],
    },
  };

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getNonProdSharedNetworkAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'nonProdSharedNetwork'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getProdSharedNetworkAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'ProdSharedNetwork'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getToolsAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'SharedTools'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getSharedProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.shared.accounts,
      'SharedProd'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getSharedUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.shared.accounts,
      'SharedUAT'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getAciProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'AciProdSupport'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getArchitectureSandboxAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'ArchitectureSandbox'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getCsiUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.csi.accounts,
      'uat'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getDevAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'Dev'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getAuditAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'audit'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getDeveloperSandboxAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'DeveloperSandbox'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getEbCitAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.eb.accounts,
      'EbCit'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getEbProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.eb.accounts,
      'EbProd'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getEbQeAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.eb.accounts,
      'EbQe'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getEbUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.eb.accounts,
      'EbUat'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getEwbProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.eastWestBank.accounts,
      'prod'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getEwbUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.eastWestBank.accounts,
      'uat'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getIstAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.ist.accounts,
      'ist'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getLogArchiveAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'Log Archive'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getPlatformSandboxSharedNetworkAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'PlatformSandboxSharedNetwork'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getPlatformSandboxAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'platformSandbox'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getSecuritySandboxAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'SecSandbox'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getMuobProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.muob.accounts,
      'prod'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getMuobUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.muob.accounts,
      'uat'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getPerfAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'Performance'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getQeAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByName(
      DfAccounts.customers.dragonfly.accounts,
      'QE'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getSantanderProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.santander.accounts,
      'prod'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getSantanderUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.santander.accounts,
      'uat'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getStateStreetProdAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.stateStreet.accounts,
      'prod'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getStateStreetUatAccountDef(): AccountDefinition {
    return DfAccounts.getAccountByType(
      DfAccounts.customers.stateStreet.accounts,
      'uat'
    );
  }

  /**
   * This is meant as a wrapper to abstract away the structure of DfAccounts
   * @return {AccountDefinition}
   */
  public static getAccounts(): DfAccounts {
    const myAccounts = [];
    Object.values(DfAccounts.customers).forEach((i) =>
      i.accounts.forEach((account) => myAccounts.push(account))
    );
    return myAccounts;
  }

  /**
   * @return {string[]} - returns an array of all account numbers
   */
  public static getAllAccountNumbers(): string[] {
    return Object.values(DfAccounts.getAccounts).map(
      (account) => account.accountNumber
    );
  }

  /**
   *
   * @param {AccountDefinition[]} accounts
   * @param {string} accountType
   * @return {AccountDefinition}
   */
  public static getAccountByType(
    accounts: AccountDefinition[],
    accountType: string
  ): AccountDefinition {
    return accounts.find((i) => i.accountType === accountType);
  }
  /**
   *
   * @param {AccountDefinition[]} accounts
   * @param {string} name
   * @return {AccountDefinition}
   */
  public static getAccountByName(
    accounts: AccountDefinition[],
    name: string
  ): AccountDefinition {
    const x = accounts.find((i) => i.name === name);
    return x;
  }

  /**
   *
   * @param {string[]} types
   * @return {CustomerDefinition[]}
   */
  public static getCustomersByTypes(types: string[]): CustomerDefinition[] {
    return Object.values(DfAccounts.customers).filter((customer) =>
      types.includes(customer.customerType)
    );
  }

  public static getExternalCustomers(): CustomerDefinition[] {
    return Object.values(DfAccounts.customers).filter(
      (customer) =>
        (customer.customerType === 'uob' || customer.customerType === 'eb') &&
        customer.gatewaySubnetConfig
    );
  }

  public static getSharedAccountCidrByAccountType(
    accountType: accountTypes
  ): string[] {
    switch (accountType) {
      case 'uat': {
        return [
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.primary,
          DfAccounts.getSharedUatAccountDef().vpcCidrs.main.recovery,
        ];
      }
      case 'prod': {
        return [
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.primary,
          DfAccounts.getSharedProdAccountDef().vpcCidrs.main.recovery,
        ];
      }
      default: {
        throw new Error(
          `DF ERROR: Account type ${accountType} is not a supported shared account type`
        );
      }
    }
  }

  public static getSharedAccounts(): AccountDefinition[] {
    return DfAccounts.customers.shared.accounts;
  }

  public static getCustomerByAccountDefinition(
    accountDefinition: AccountDefinition
  ): CustomerDefinition {
    return Object.values(DfAccounts.customers).find((customer) => {
      return customer.accounts.find((account) => account === accountDefinition);
    });
  }
}
