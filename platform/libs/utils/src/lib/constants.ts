/**
 * This class's purpose is to define constants that can be used throughout the application
 */
export abstract class Constants {
  // static readonly DEFAULT_WINDOWS_INSTANCE_AMI = 'ami-0e38fa17744b2f6a5';

  static readonly STATE_BUCKET_NAME = 'dragonflyft-tf-state';
  static readonly STATE_ACCOUNT_ID = '446554332519';
  static readonly STATE_ROLE_NAME = 'dragonflyft-state-admin';
  static readonly PROD_LEGACY_SHARED_NETWORK_STACK_ID = 'prod-VPC';
  static readonly PROD_PRIMARY_SHARED_NETWORK_STACK_ID = 'prod-VPC-PRIMARY';
  static readonly PROD_RECOVERY_SHARED_NETWORK_STACK_ID = 'prod-VPC-RECOVERY';

  static readonly NON_PROD_LEGACY_SHARED_NETWORK_STACK_ID = 'VPC';
  static readonly NON_PROD_PRIMARY_SHARED_NETWORK_STACK_ID = 'VPC-PRIMARY';
  static readonly NON_PROD_RECOVERY_SHARED_NETWORK_STACK_ID = 'VPC-RECOVERY';

  static readonly PS_LEGACY_SHARED_NETWORK_STACK_ID = 'VPC';
  static readonly PS_PRIMARY_SHARED_NETWORK_STACK_ID = 'VPC-PRIMARY';
  static readonly PS_RECOVERY_SHARED_NETWORK_STACK_ID = 'VPC-RECOVERY';

  static readonly SITE_TO_SITE_VPN_SUMMARY_CIDR = '10.252.0.0/14';

  static readonly DRAGONFLYFT_PUBLIC_HOSTED_ZONE_ID = 'Z02201352K0UO1LQQP53C';

  static readonly CENTRAL_CLOUDTRAIL_BUCKET_NAME =
    'aws-aft-logs-506625313654-us-east-1';

  static readonly SELF_SERVICE_BUCKET_NAME = 'dft-tools-self-service';

  static readonly DFT_LAMBDA_ASSETS_BUCKET_NAME = 'dft-tools-all-lambda-assets';

  static readonly MICROSOFT_ACTIVE_DIRECTORY_DOMAIN_NAME =
    'dragonflyft-internal.com';

  static readonly SENDGRID_PROXY_TOOLS_SUB_DOMAIN_NAME = 'sendgrid-proxy.tools';
  static readonly SENDGRID_PROXY_SUB_DOMAIN_NAME = 'sendgrid-proxy.app';

  static readonly CLOUDFRONT_LEGACY_PREFIX_LIST_ID = 'pl-3b927c52';
  static readonly CLOUDFRONT_PRIMARY_PREFIX_LIST_ID = 'pl-b6a144df';
  static readonly CLOUDFRONT_RECOVERY_PREFIX_LIST_ID = 'pl-82a045eb';

  /* Networkable VPC CIDR Blocks */
  static readonly VPC_CIDR_BLOCK_ANY_SPOKE = '10.0.0.0/8';

  // Egress
  static readonly SHARED_NETWORK_VPC_CIDR_BLOCK_EGRESS_PRIMARY =
    '10.202.0.0/16';
  static readonly SHARED_NETWORK_VPC_CIDR_BLOCK_EGRESS_RECOVERY =
    '10.203.0.0/16';
  // Inspection
  static readonly SHARED_NETWORK_VPC_CIDR_BLOCK_INSPECTION_PRIMARY =
    '172.30.0.0/16';
  static readonly SHARED_NETWORK_VPC_CIDR_BLOCK_INSPECTION_RECOVERY =
    '172.31.0.0/16';

  // Client VPN
  static readonly SHARED_NETWORK_VPC_CIDR_BLOCK_CLIENT_VPN_PRIMARY =
    '192.168.128.0/20';
  static readonly SHARED_NETWORK_VPC_CIDR_BLOCK_CLIENT_VPN_RECOVERY =
    '192.168.144.0/20';

  /* Platform Sandbox Shared Network VPC CIDR Blocks */
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_INGRESS =
    '10.100.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_EGRESS =
    '10.101.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_INGRESS_RECOVERY =
    '10.102.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_EGRESS_RECOVERY =
    '10.103.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_INGRESS_PRIMARY =
    '10.104.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_EGRESS_PRIMARY =
    '10.105.0.0/16';

  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_INSPECTION =
    '172.17.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_INSPECTION_RECOVERY =
    '172.18.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_INSPECTION_PRIMARY =
    '172.19.0.0/16';
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_CLIENT_VPN =
    '192.168.160.0/20';
  // ! This is not a valid internal ip range. 192.168.0.0 to 192.168.255.255 is reserved for private networks.
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_CLIENT_VPN_RECOVERY =
    '192.169.160.0/20';
  // ! Same as above
  static readonly PLATFORM_SHARED_NETWORK_VPC_CIDR_BLOCK_CLIENT_VPN_PRIMARY =
    '192.170.160.0/20';

  static readonly ACI_DESTINATION_CIDR_BLOCKS = [
    '172.30.5.0/24',
    '172.30.227.0/24',
    '10.16.59.0/24',
    '10.17.14.0/24',
    '10.17.39.0/24',
  ];

  static readonly MTS_ACI_DESTINATION_CIDR_BLOCKS = ['100.126.0.208/28'];

  static readonly DX_DRAGONFLY_DCG = 'Dragonfly-DCG';
  static readonly DX_DRAGONFLY_MTS = 'Dragonfly-DCG-MTS-ACI';

  /* Account Names */
  static readonly ENVIRONMENT_NAME_MASTER = 'master';
  static readonly ENVIRONMENT_NAME_SHARED_NETWORK = 'sharedNetwork';
  static readonly ENVIRONMENT_NAME_NON_PROD_SHARED_NETWORK =
    'nonProdSharedNetwork';
  static readonly ENVIRONMENT_NAME_PLATFORM_SANDBOX_SHARED_NETWORK =
    'platformSandboxSharedNetwork';
  static readonly ENVIRONMENT_NAME_STATE_STREET_UAT = 'stateStreetUat';
  static readonly ENVIRONMENT_NAME_STATE_STREET_PROD = 'stateStreetProd';
  static readonly ENVIRONMENT_NAME_SANTANDER_PROD = 'santProd';
  static readonly ENVIRONMENT_NAME_MULTI_TENANT_PROD = 'muobProd';

  /* Account Numbers */
  static readonly ACCOUNT_NUMBER_DEV = '824249975673';
  static readonly ACCOUNT_NUMBER_DEVELOPER_SANDBOX = '358219470856';
  static readonly ACCOUNT_NUMBER_MASTER = '446554332519';
  static readonly ACCOUNT_NUMBER_PLATFORM_SANDBOX_SHARED_NETWORK =
    '117875293752';
  static readonly ACCOUNT_NUMBER_SHARED_NETWORK = '008257427062';
  static readonly ACCOUNT_NUMBER_NON_PROD_SHARED_NETWORK = '413455294286';
  static readonly ACCOUNT_NUMBER_TOOLS = '207348267374';
  static readonly ACCOUNT_NUMBER_PLATFORM_SANDBOX = '259311287469';
  static readonly ACCOUNT_NUMBER_ARCHITECTURE_SANDBOX = '327441322700';
  static readonly ACCOUNT_NUMBER_PERFORMANCE = '260869750235';
  static readonly ACCOUNT_NUMBER_QE = '876883457223';
  static readonly ACCOUNT_NUMBER_IST = '900339839666';
  static readonly ACCOUNT_NUMBER_SHARED_UAT = '344860351693';
  static readonly ACCOUNT_NUMBER_EWB_UAT = '190240132920';
  static readonly ACCOUNT_NUMBER_LOG_ARCHIVE = '506625313654';
  static readonly ACCOUNT_NUMBER_SHARED_PROD = '639483828455';
  static readonly ACCOUNT_NUMBER_SANT_UAT = '856665374486';
  static readonly ACCOUNT_NUMBER_MUOB_UAT = '918714997132';
  static readonly ACCOUNT_NUMBER_EWB_PROD = '505874256341';
  static readonly ACCOUNT_NUMBER_EB_CIT = '746597437630';
  static readonly ACCOUNT_NUMBER_EB_QE = '752642178475';
  static readonly ACCOUNT_NUMBER_EB_UAT = '370920975040';
  static readonly ACCOUNT_NUMBER_EB_PROD = '256273496362';
  static readonly ACCOUNT_NUMBER_STATE_STREET_UAT = '713902029510';
  static readonly ACCOUNT_NUMBER_STATE_STREET_PROD = '031810701581';
  static readonly ACCOUNT_NUMBER_SANTANDER_PROD = '536264819586';
  static readonly ACCOUNT_NUMBER_MULTI_TENANT_PROD = '251147478556';
  static readonly ACCOUNT_NUMBER_ACI_PROD_SUPPORT = '273731360122';

  static readonly ACCOUNT_NUMBERS = [
    Constants.ACCOUNT_NUMBER_DEV,
    Constants.ACCOUNT_NUMBER_DEVELOPER_SANDBOX,
    Constants.ACCOUNT_NUMBER_MASTER,
    Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX_SHARED_NETWORK,
    Constants.ACCOUNT_NUMBER_SHARED_NETWORK,
    Constants.ACCOUNT_NUMBER_TOOLS,
    Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX,
    Constants.ACCOUNT_NUMBER_ARCHITECTURE_SANDBOX,
    Constants.ACCOUNT_NUMBER_PERFORMANCE,
    Constants.ACCOUNT_NUMBER_QE,
    Constants.ACCOUNT_NUMBER_IST,
    Constants.ACCOUNT_NUMBER_SHARED_UAT,
    Constants.ACCOUNT_NUMBER_EWB_UAT,
    Constants.ACCOUNT_NUMBER_LOG_ARCHIVE,
    Constants.ACCOUNT_NUMBER_SHARED_PROD,
    Constants.ACCOUNT_NUMBER_SANT_UAT,
    Constants.ACCOUNT_NUMBER_MUOB_UAT,
    Constants.ACCOUNT_NUMBER_EWB_PROD,
    Constants.ACCOUNT_NUMBER_EB_CIT,
    Constants.ACCOUNT_NUMBER_EB_QE,
    Constants.ACCOUNT_NUMBER_EB_UAT,
    Constants.ACCOUNT_NUMBER_EB_PROD,
    Constants.ACCOUNT_NUMBER_STATE_STREET_UAT,
    Constants.ACCOUNT_NUMBER_STATE_STREET_PROD,
    Constants.ACCOUNT_NUMBER_SANTANDER_PROD,
    Constants.ACCOUNT_NUMBER_MULTI_TENANT_PROD,
    Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT,
  ];

  static readonly ACCOUNT_NUMBER_ALIAS_MAP: { [key: string]: string } = {
    [Constants.ACCOUNT_NUMBER_DEV]: 'dev',
    [Constants.ACCOUNT_NUMBER_DEVELOPER_SANDBOX]: 'developer-sandbox',
    [Constants.ACCOUNT_NUMBER_MASTER]: 'master',
    [Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX_SHARED_NETWORK]:
      'platform-sandbox-shared-network',
    [Constants.ACCOUNT_NUMBER_SHARED_NETWORK]: 'shared-network',
    [Constants.ACCOUNT_NUMBER_TOOLS]: 'tools',
    [Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX]: 'platform-sandbox',
    [Constants.ACCOUNT_NUMBER_ARCHITECTURE_SANDBOX]: 'architecture-sandbox',
    [Constants.ACCOUNT_NUMBER_PERFORMANCE]: 'performance',
    [Constants.ACCOUNT_NUMBER_QE]: 'qe',
    [Constants.ACCOUNT_NUMBER_IST]: 'ist',
    [Constants.ACCOUNT_NUMBER_SHARED_UAT]: 'shared-uat',
    [Constants.ACCOUNT_NUMBER_EWB_UAT]: 'ewb-uat',
    [Constants.ACCOUNT_NUMBER_LOG_ARCHIVE]: 'log-archive',
    [Constants.ACCOUNT_NUMBER_SHARED_PROD]: 'shared-prod',
    [Constants.ACCOUNT_NUMBER_SANT_UAT]: 'sant-uat',
    [Constants.ACCOUNT_NUMBER_MUOB_UAT]: 'muob-uat',
    [Constants.ACCOUNT_NUMBER_EWB_PROD]: 'ewb-prod',
    [Constants.ACCOUNT_NUMBER_EB_CIT]: 'eb-cit',
    [Constants.ACCOUNT_NUMBER_EB_QE]: 'eb-qe',
    [Constants.ACCOUNT_NUMBER_EB_UAT]: 'eb-uat',
    [Constants.ACCOUNT_NUMBER_EB_PROD]: 'eb-prod',
    [Constants.ACCOUNT_NUMBER_STATE_STREET_UAT]: 'state-street-uat',
    [Constants.ACCOUNT_NUMBER_STATE_STREET_PROD]: 'state-street-prod',
    [Constants.ACCOUNT_NUMBER_SANTANDER_PROD]: 'santander-prod',
    [Constants.ACCOUNT_NUMBER_MULTI_TENANT_PROD]: 'multi-tenant-prod',
    [Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT]: 'aci-prod-support',
  };

  static readonly COMPLIANCE_SCOPED_ACCOUNTS = [
    Constants.ACCOUNT_NUMBER_SHARED_UAT,
    Constants.ACCOUNT_NUMBER_EWB_UAT,
    Constants.ACCOUNT_NUMBER_SHARED_NETWORK,
    Constants.ACCOUNT_NUMBER_SANT_UAT,
    Constants.ACCOUNT_NUMBER_MUOB_UAT,
    Constants.ACCOUNT_NUMBER_EWB_PROD,
    Constants.ACCOUNT_NUMBER_EB_UAT,
    Constants.ACCOUNT_NUMBER_EB_PROD,
    // Adding EB_CIT due to Soc2 compliance alerts
    Constants.ACCOUNT_NUMBER_EB_CIT,
    Constants.ACCOUNT_NUMBER_STATE_STREET_UAT,
    Constants.ACCOUNT_NUMBER_STATE_STREET_PROD,
    Constants.ACCOUNT_NUMBER_SANTANDER_PROD,
    Constants.ACCOUNT_NUMBER_MULTI_TENANT_PROD,
    Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT,
  ];

  static readonly PLATFORM_SANDBOX_ACCOUNT_NUMBERS: string[] = [
    Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX_SHARED_NETWORK,
    Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX,
  ];

  static readonly AUTHORIZED_GROUP_AWS_SINGLE_SIGN_ON =
    '8f09be8d-432c-48ec-95f1-e46f22ee3b6d';
  static readonly AUTHORIZED_GROUP_UC4_ADMINS =
    'caf31e91-624d-4be2-847f-5d399af0bbbe';
  static readonly AUTHORIZED_GROUP_MOVEIT_ADMINS =
    '8eeb50ec-b533-4a99-9651-a3de3f7da2fa';
  static readonly AUTHORIZED_GROUP_EB_ADMINS =
    '43370276-034a-41f8-89cf-ed222a104bc6';
  static readonly AUTHORIZED_GROUP_IST_DBAS =
    'ca2e3273-552d-44cf-8dee-982f8de20176';
  static readonly AUTHORIZED_GROUP_IST_USERS =
    '4014d478-2e3f-480c-9813-7665e8a08377';
  static readonly AUTHORIZED_GROUP_JENKINS_ADMINS =
    '91569bfa-8be9-4c3d-8845-9c3398cd135d';
  static readonly AUTHORIZED_GROUP_MOVEIT_WEB_INTERFACE_AND_SFTP =
    'd8ac74c2-9ca2-4957-8ae6-0be169fd791a';
  static readonly AUTHORIZED_GROUP_AWS_ADMINS =
    '6017fb5e-1eab-4c5e-8da3-e09ec859d725';
  static readonly AUTHORIZED_GROUP_AWS_SECURITY =
    'c689a188-bbc2-4034-a1a6-d91cdf8ee5d4';

  // New Prod Network Access groups
  static readonly AUTHORIZED_GROUP_UAT_NETWORK_SERVER_ACCESS =
    '3c722e91-97e7-4e17-8550-8d4c760fa893';
  static readonly AUTHORIZED_GROUP_PROD_NETWORK_SERVER_ACCESS =
    '4ff96d24-9824-41cd-b035-200a340081ee';

  static readonly AUTHORIZED_GROUP_UAT_NETWORK_DB_ACCESS =
    'fbee58b9-6c80-44d4-afbb-6ec339f0a10a';
  static readonly AUTHORIZED_GROUP_PROD_NETWORK_DB_ACCESS =
    'e3437512-9647-4cf1-9a22-a30710d2b015';

  static readonly OU = {
    root: {
      orgUnitId: 'r-drg8',
      name: 'root',
      adminAuthorizationGroup: null,
    },
    aft: {
      orgUnitId: 'ou-drg8-dg50via0',
      name: 'aft',
      adminAuthorizationGroup: null,
    },
    dev: {
      orgUnitId: 'ou-drg8-2z2cri84',
      name: 'dev',
      adminAuthorizationGroup: null,
    },
    ist: {
      orgUnitId: 'ou-drg8-563udqk3',
      name: 'ist',
      adminAuthorizationGroup: {
        authorizedGroupName: 'IST Admins',
        authroizedGroupDescription: 'IST Admins',
        authorizedGroupId: '5678b8c4-7d4e-4ddb-9556-813454e746e9',
      },
    },
    master: {
      orgUnitId: 'ou-drg8-orvl9tjq',
      name: 'master',
      adminAuthorizationGroup: null,
    },
    network: {
      orgUnitId: 'ou-drg8-l001smw3',
      name: 'network',
      adminAuthorizationGroup: null,
    },
    performance: {
      orgUnitId: 'ou-drg8-1qpfh8g3',
      name: 'performance',
      adminAuthorizationGroup: null,
    },
    qe: {
      orgUnitId: 'ou-drg8-2u46scq1',
      name: 'qe',
      adminAuthorizationGroup: {
        authorizedGroupName: 'QE Admins',
        authroizedGroupDescription: 'QE Admins',
        authorizedGroupId: '8b88549a-6257-46f8-871a-38edd35793eb',
      },
    },
    sandbox: {
      orgUnitId: 'ou-drg8-hlkw43mk',
      name: 'sandbox',
      adminAuthorizationGroup: null,
    },
    tools: {
      orgUnitId: 'ou-drg8-j81f5vr9',
      name: 'tools',
      adminAuthorizationGroup: {
        authorizedGroupName: 'Tools Admins',
        authroizedGroupDescription: 'Tools Admins',
        authorizedGroupId: '9c20273e-890f-47ec-88db-0e668f3bf3d2',
      },
    },
    uat: {
      orgUnitId: 'ou-drg8-24hschsc',
      name: 'uat',
      adminAuthorizationGroup: {
        authorizedGroupName: 'UAT Admins',
        authroizedGroupDescription: 'UAT Admins',
        authorizedGroupId: 'fc247f52-a754-438b-95e1-7ff6ec547ec9',
      },
    },
    prod: {
      orgUnitId: 'ou-drg8-2u6mt9y9',
      name: 'prod',
      adminAuthorizationGroup: {
        authorizedGroupName: 'Prod Admins',
        authroizedGroupDescription: 'Prod Admins',
        authorizedGroupId: 'c1263929-be12-4ccb-89ef-6b832374418b',
      },
    },
  };

  static readonly ROOT_OU_ID = 'r-drg8';
  static readonly AFT_OU_ID = 'ou-drg8-dg50via0';
  static readonly DEV_OU_ID = 'ou-drg8-2z2cri84';
  static readonly IST_OU_ID = 'ou-drg8-563udqk3';
  static readonly MASTER_OU_ID = 'ou-drg8-orvl9tjq';
  static readonly NETWORK_OU_ID = 'ou-drg8-l001smw3';
  static readonly PERFORMANCE_OU_ID = 'ou-drg8-1qpfh8g3';
  static readonly QE_OU_ID = 'ou-drg8-2u46scq1';
  static readonly SANDBOX_OU_ID = 'ou-drg8-hlkw43mk';
  static readonly TOOLS_OU_ID = 'ou-drg8-j81f5vr9';
  static readonly UAT_OU_ID = 'ou-drg8-24hschsc';
  static readonly PROD_OU_ID = 'ou-drg8-2u6mt9y9';

  static readonly OU_ID_MAP: { [key: string]: string } = {
    [Constants.ROOT_OU_ID]: 'root',
    [Constants.AFT_OU_ID]: 'aft',
    [Constants.DEV_OU_ID]: 'dev',
    [Constants.IST_OU_ID]: 'ist',
    [Constants.MASTER_OU_ID]: 'master',
    [Constants.NETWORK_OU_ID]: 'network',
    [Constants.PERFORMANCE_OU_ID]: 'performance',
    [Constants.QE_OU_ID]: 'qe',
    [Constants.SANDBOX_OU_ID]: 'sandbox',
    [Constants.TOOLS_OU_ID]: 'tools',
    [Constants.UAT_OU_ID]: 'uat',
    [Constants.PROD_OU_ID]: 'prod',
  };

  static readonly PRINCIPAL_ORG_ID = 'o-q4ohcirjpy';
  static readonly SANDBOX_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.SANDBOX_OU_ID}`;
  static readonly UAT_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.UAT_OU_ID}`;
  static readonly PROD_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.PROD_OU_ID}`;
  static readonly DEV_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.DEV_OU_ID}`;
  static readonly IST_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.IST_OU_ID}`; //
  static readonly PERFORMANCE_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.PERFORMANCE_OU_ID}`; //
  static readonly QE_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.QE_OU_ID}`; //
  static readonly TOOLS_ORG_OU_ARN = `arn:aws:organizations::${this.ACCOUNT_NUMBER_MASTER}:ou/${this.PRINCIPAL_ORG_ID}/${this.TOOLS_OU_ID}`;

  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID =
    'private-hosted-zone-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_POST_INSPECTION_TRAFFIC_ROUTE_TABLE_ID =
    'tgw-post-inspection-traffic-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_SHARED_TOOLS_TRAFFIC_TGW_ROUTE_TABLE_ID =
    'shared-tools-traffic-tgw-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_SHARED_UAT_TRAFFIC_TGW_ROUTE_TABLE_ID =
    'shared-uat-traffic-tgw-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_UAT_TRAFFIC_TGW_ROUTE_TABLE_ID =
    'uat-traffic-tgw-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_SHARED_PROD_TRAFFIC_TGW_ROUTE_TABLE_ID =
    'shared-prod-traffic-tgw-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_PROD_TRAFFIC_TGW_ROUTE_TABLE_ID =
    'prod-traffic-tgw-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_SPOKE_TRAFFIC_TGW_ROUTE_TABLE_ID =
    'spoke-traffic-tgw-route-table-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_CLIENT_VPN_RESOURCE_ENDPOINT_ID =
    'client-vpn-resource-endpoint-id';
  static readonly CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID = 'tgw-id';
  static readonly CROSS_STACK_OUTPUT_PRIMARY_MICROSOFT_DIRECTORY_ID =
    'directory-id';
  static readonly CROSS_STACK_OUTPUT_RECOVERY_MICROSOFT_DIRECTORY_ID =
    'recovery-directory-id';
  static readonly CROSS_STACK_OUTPUT_LEGACY_MICROSOFT_DIRECTORY_ID =
    'legacy-directory-id';
  static readonly CROSS_STACK_OUTPUT_RECOVERY_TO_PRIMARY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID =
    'recovery-tgw-peering-attachment-to-primary-accepter-id';
  static readonly CROSS_STACK_OUTPUT_PRIMARY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID =
    'primary-tgw-peering-attachment-to-legacy-accepter-id';
  static readonly CROSS_STACK_OUTPUT_RECOVERY_TO_LEGACY_TGW_PEERING_ATTACHMENT_CONNECTOR_ID =
    'recovery-tgw-peering-attachment-to-legacy-accepter-id';
  /* Cross stack output for backup policies */
  static readonly CROSS_STACK_OUTPUT_ROOT_OU_EC2 = 'root-ou-ec2';
  static readonly CROSS_STACK_OUTPUT_ROOT_OU_EFS = 'root-ou-efs';
  static readonly CROSS_STACK_OUTPUT_ROOT_OU_RDS = 'root-ou-rds';
  static readonly CROSS_STACK_OUTPUT_INGRESS_VPC_ID = 'ingress-vpc-id';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_ID = 'gateway-vpc-id';
  static readonly CROSS_STACK_OUTPUT_INGRESS_VPC_APP_SUBNET_IDS =
    'ingress-vpc-app-subnet-ids';
  static readonly CROSS_STACK_OUTPUT_INGRESS_VPC_PUBLIC_SUBNET_IDS =
    'ingress-vpc-public-subnet-ids';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_IDS =
    'ingress-vpc-internet-subnet-ids';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_A =
    'ingress-vpc-internet-subnet-id-az-a';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_B =
    'ingress-vpc-internet-subnet-id-az-b';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_C =
    'ingress-vpc-internet-subnet-id-az-c';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_IDS =
    'ingress-vpc-internet-xl-subnet-ids';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_A =
    'ingress-vpc-internet-xl-subnet-id-az-a';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_B =
    'ingress-vpc-internet-xl-subnet-id-az-b';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_C =
    'ingress-vpc-internet-xl-subnet-id-az-c';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_PUPI_EDGE_SUBNET_IDS =
    'ingress-vpc-pupi-edge-subnet-ids';
  static readonly CROSS_STACK_OUTPUT_GATEWAY_VPC_CUSTOMER_EDGE_SUBNET_IDS =
    'gateway-vpc-customer-edge-subnet-ids';
  static readonly CROSS_STACK_OUTPUT_CVPN_ENDPOINT_IDS =
    'client-vpn-endpoint-ids';
  static readonly CROSS_STACK_OUTPUT_SHARED_TOOLS_NON_PROD_TRANSIT_VPC_RTB_ID =
    'nonProdTransitVpcRtbId';
  static readonly CROSS_STACK_OUTPUT_SHARED_TOOLS_PROD_TRANSIT_VPC_RTB_ID =
    'prodTransitVpcRtbId';
  static readonly CROSS_STACK_OUTPUT_SHARED_TOOLS_VPC_PRIVATE_RTB_ID =
    'toolsVpcPrivateRtbId';
  static readonly CROSS_STACK_OUTPUT_PALO_ALTO_UNTRUSTED_INTERFACE_IP =
    'paloAltoUntrustedInterfaceIp';
  static readonly CROSS_STACK_OUTPUT_CLIENT_SUBNET = 'clientSubnet';

  /* Integration Constants */
  static readonly INTEGRATION_ARN_ACCOUNT_DATADOG =
    'arn:aws:iam::464622532012:root';
  static readonly INTEGRATION_ARN_ACCOUNT_SNYK =
    'arn:aws:iam::370134896156:role/generate-credentials';

  static readonly INTEGRATION_ARN_AMAZON_EKS_CLUSTER_POLICY =
    'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy';
  static readonly INTEGRATION_ARN_AMAZON_EKS_WORKER_CLUSTER_POLICY =
    'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy';
  static readonly INTEGRATION_ARN_AMAZON_EC2_CONTAINER_REGISTRY_READ_ONLY =
    'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly';
  static readonly INTEGRATION_ARN_AMAZON_EKS_CNI_POLICY =
    'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy';

  static readonly INTEGRATION_ARN_ACCOUNT_GITHUB;

  /* Role Constants */
  static readonly ROLE_PROVISION_ROLE_NAME = 'provision-role';

  /* ECR Repo Names */
  static readonly INGRESS_NGINX_REVERSE_PROXY = 'ingress-nginx-reverse-proxy';
  static readonly INTERNAL_SENDGRID_REVERSE_PROXY =
    'internal-sendgrid-reverse-proxy';
  static readonly INTERNAL_SENDGRID_REVERSE_PROXY_RECOVERY =
    'internal-sendgrid-reverse-proxy-recovery';

  /* Bucket Names */
  static readonly BUCKET_CODEPIPELINE_ARTIFACT = 'df-codepipeline-artifacts';

  /* Bucket Object Names */
  static readonly BUCKET_OBJECT_ENVIRONMENTS_VERSIONS_FILE =
    'build-pipeline/finalPackages/finalPackages.zip';

  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~UOB PORTS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* UOB Constants */
  static readonly UOB_UNKNOWN_PORTS_TCP: Array<number | [number, number]> = [
    // Ports listed, but not known what tier
    // [3154, 3156],
    // 3168,
    // 3360,
    // 3370,
    // 5580,
    // 8001,
    // [18012, 18014],
    // // Ports open, but not identified as needed yet
    // 2001,
    // 2220,
    // 3000,
    // [3152, 3153],
    // 3158,
    // [3361, 3369],
  ];

  static readonly UOB_ALL_TIERS_TCP: Array<number | [number, number]> = [
    // 8125
  ];

  // ! We need to refactor the security groups to pass in descriptions to the Console.
  static readonly UOB_PORTS_APP_TCP: Array<number | [number, number]> = [
    [0, 65535], // Jitesh approved this. 05/22/2024.
    // [1024, 65535],
    // [2412, 2437],
    // [3310, 3359],
    // [5060, 5065],
    // [5558, 5582],
    // [7276, 7290],
    // [8011, 8016],
    // [8021, 8022],
    // [9011, 9016],
    // [9021, 9022],
    // [16900, 16979],
    // [17010, 17011], // rmi ports
    // [10000, 15000], // jcs
    // [50000, 50203], // * Batch RMI ports
    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_APP_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // [8021, 8022],
    // [9021, 9022],
    // 16912,
    // 16925,
    // 16930,
    // [16985, 16989],
  ];

  static readonly UOB_PORTS_WEB_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // // No known extra ports for web tier

    // // Below ports are for AOD:
    // 8443,
    // 9443,
    // [30101, 30114],
    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_WEB_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_BLD_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // // No known extra ports for web tier

    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_BLD_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_MSI_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 1883,
    // [1098, 1099],
    // 4582,
    // [5555, 5556],
    // 5672,
    // [8060, 8065],
    // 8083,
    // 8088,
    // 8100,
    // 8200,
    // [8300, 8302],
    // [8500, 8501],
    // 8600,
    // 8700,
    // 8750,
    // 8840, // FedNow payment service
    // 8850,
    // [8888, 8890],
    // [8910, 8920],
    // 9010, // For inbound alert service
    // 9080,
    // 61613,
    // [61616, 61620],
    // [10000, 15000], // jcs
    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_MSI_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_RPT_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 5001,
    // [8000, 8001],
    // 8080,
    // [8010, 8011],
    // [8100, 8101],
    // 8111,
    // [8380, 8392],
    // [8432, 8433],
    // [8500, 8501],
    // 8700,
    // 8900,
    // 8903,
    // 8911,
    // 9432,
    // [11100, 11102],
    // 11550,
    // 12100,
    // [12200, 12201],
    // [12300, 12301],
    // [12400, 12401],
    // 13100,
    // 14000,
    // 14100,
    // 14200,
    // 15200,
    // [21000, 21010],
    // 21500,

    // // Extra ports needed for AOD
    // 8014,

    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_RPT_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912,
    // 16925,
    // 16985,
    // [41000, 42000],
  ];

  static readonly UOB_PORTS_MQ_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // [1414, 1464],
    // 1883,
    // 4582,
    // 5672,
    // [8060, 8065],
    // 61613,
    // [61616, 61620],

    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_MQ_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_UPF_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 4,
    // 27017,
    // 8200,
    // 8700,
    // 1414,
    // 3001,
    // 3003,
    // 3100,
    // 3102,
    // 3127,
    // [3150, 3151],
    // [3152, 3155],
    // 3157,
    // [3167, 3168],
    // 3300,
    // 3350,
    // 3357,
    // [3367, 3368],
    // [7000, 7030],
    // 8086,
    // 8090,

    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_UPF_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_CFM_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // // No known ports

    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_CFM_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_LBS_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // [1000, 1299],
    // 1414,
    // [3151, 3155],
    // 3158,
    // 3350,
    // 3360,
    // 3370,
    // [5000, 6000],
    // [8000, 9999],
    // [16900, 19100],
    // [25010, 25011],
    // 27017,

    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_LBS_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // 16912, 16925, 16985,
  ];

  static readonly UOB_PORTS_SIM_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 8086, 25010,
  ];

  static readonly UOB_PORTS_BAT_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 2300,
    // [2412, 2437],
    // 3300,
    // [3310, 3359],
    // [5060, 5065],
    // [5558, 5582],
    // [7276, 7290],
    // [8011, 8016],
    // [8021, 8023],
    // 8871,
    // [9011, 9037],
    // 15911,
    // 15931,
    // [16900, 16979],
    // [17010, 17011],
    // 24911,
    // [25830, 25831], // Per Amit, these ports are just for UAT
    // [25910, 25911], // Per Amit, these ports are just for UAT
    // [10000, 15000], // jcs
    // [50000, 50400], // batch - These were extended
    // ...Constants.UOB_UNKNOWN_PORTS_TCP,
    // ...Constants.UOB_ALL_TIERS_TCP,
  ];

  static readonly UOB_PORTS_BAT_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // [8021, 8022],
    // [9021, 9022],
    // 16912,
    // 16925,
    // 16930,
    // [16985, 16989],
  ];

  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~EB PORTS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  static readonly EB_PORTS_APP_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 2809,
    // [5060, 5063],
    // 6000,
    // 7062,
    // [7270, 7286],
    // 8878,
    // 9043,
    // [9201, 9202],
    // [9300, 9500],
    // 9629,
    // [9900, 9901],
    // [11000, 11100],
    // 33001,
    // 8888,
  ];

  static readonly EB_PORTS_APP_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // [11000, 11100],
  ];

  static readonly EB_PORTS_OFX_APP_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 2809,
    // 9809,
    // [9629, 9632],
    // 9100,
    // [9400, 9420],
    // [9040, 9060],
    // [9352, 9353],
    // [7060, 7062],
    // 5555,
    // [9900, 9901],
    // [9200, 9202],
    // [7272, 7277],
    // [5000, 5001],
    // [8878, 8879],
    // [11003, 11006],
    // 8888,
  ];
  static readonly EB_PORTS_OFX_APP_UDP: Array<number | [number, number]> = [];

  static readonly EB_PORTS_OFX_WEB_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 8008, 8888,
  ];

  static readonly EB_PORTS_OFX_WEB_UDP: Array<number | [number, number]> = [];

  static readonly EB_PORTS_MQ_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 1414, 1424, 8888,
  ];

  static readonly EB_PORTS_WEB_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 6000,
    // 8008,
    // 8888,
    // [9043, 9444],
    // [32001, 32100],
    // 33001,
  ];

  static readonly EB_PORTS_WEB_UDP: Array<number | [number, number]> = [];

  static readonly EB_PORTS_UTIL_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 2300,
    // 2809,
    // 5000,
    // 6000,
    // [7200, 7299],
    // [8000, 8200],
    // [8878, 8879],
    // 8888,
    // [9000, 9100],
    // [9300, 9500],
    // 9809,
    // [11000, 11100],
    // 13001,
    // 14001,
    // 15001,
    // 16001,
    // 17001,
    // 18001,
    // 19001,
    // 20001,
    // [21000, 21500],
    // 33001,
    // 37781,
    // 40121,
    // [50120, 50125],
    // [54300, 54350],
  ];

  static readonly EB_PORTS_UTIL_UDP: Array<number | [number, number]> = [
    [0, 65535],
    // [11000, 11100],
  ];

  static readonly EB_PORTS_WIND_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 6000,
    // 8888,
    // 9043,
    // 9444,
    // 33001,
    // 37781,
    // 40121,
    // [50120, 50125],
    // [54300, 54350],
  ];

  static readonly EB_PORTS_WIND_UDP: Array<number | [number, number]> = [];

  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~DBS PORTS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  static readonly DBS_PORTS_APP_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 8443, 8080, 7443, 9443, 10443, 7100,
  ];

  static readonly DBS_PORTS_WEB_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 1443, 2443, 8443, 8080,
  ];

  static readonly DBS_PORTS_DB_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 6603
  ];

  static readonly DBS_PORTS_MQ_TCP: Array<number | [number, number]> = [
    [0, 65535],
    // 1414
  ];

  /* Default region */
  static readonly AWS_DEFAULT_REGION = 'us-east-1';

  static readonly AWS_REGION_MAP: {
    [key in Constants.AWS_REGION_ALIASES]: string;
  } = {
    LEGACY: 'us-east-1',
    DFPRIMARY: 'us-east-2',
    DFRECOVERY: 'us-west-2',
    DFSYDNEY: 'ap-southeast-2',
  };

  static readonly DFT_STATIC_VPN = '44.232.26.251/32';

  static readonly NEW_RELIC_WHITELIST = [
    // New relic Washington, DC, USA
    '44.202.178.0/24',
    '44.202.180.0/23',
    '44.210.68.0/24',
    '44.210.110.0/25',

    // New relic Columbus, OH, USA
    '3.145.224.0/24',
    '3.145.225.0/25',
    '3.145.234.0/24',

    // New relic San Francisco, CA, USA
    '3.101.204.0/23',
    '3.101.212.0/24',
    '3.101.209.192/26',

    // New relic Portland, OR, USA
    '35.89.46.0/23',
    '35.92.27.0/24',

    // New relic Montreal, Québec, CA
    '3.99.200.0/24',
    '3.99.193.0/26',
    '3.99.253.128/25',

    // New relic Dublin, IE
    '3.251.231.0/24',
    '3.251.230.64/26',
    '3.252.47.0/25',

    // New Relic London, England, UK
    '13.40.201.0/24',
    '13.40.208.0/25',
    '13.41.206.128/25',
    '13.41.206.64/26',

    // New relic Paris, FR
    '13.38.68.128/25',
    '13.38.68.64/26',
    '13.38.202.128/26',
    '13.38.202.192/28',

    // New relic Frankfurt, DE
    '3.71.170.0/24',
    '3.71.103.96/27',
    '3.75.4.128/25',

    // New relic Stockholm, SE
    '16.16.1.128/25',
    '13.50.68.0/26',

    // New relic Milan, IT
    '15.160.105.128/25',
    '18.102.58.0/26',

    // New relic Tokyo, JP
    '35.77.208.0/24',
    '35.79.233.64/26',
    '35.79.233.128/28',

    // New relic Seoul, KR
    '3.38.229.128/25',
    '15.165.193.192/26',

    // New relic Singapore, SG
    '13.214.242.0/25',
    '13.214.223.192/26',
    '18.141.238.128/25',

    // New relic Sydney, AU
    '3.26.252.0/24',
    '3.26.245.128/25',
    '3.27.51.0/25',

    // New relic Mumbai, IN
    '3.110.73.192/26',
    '3.111.138.0/25',
    '43.205.150.128/26',
    '43.204.166.240/28',

    // New relic Hong Kong, HK
    '16.163.86.128/26',
    '16.163.220.0/25',
    '43.198.20.64/26',
    '43.198.20.128/28',

    // New relic Sao Paulo, BR
    '15.228.171.128/25',
    '15.229.44.0/26',
    '15.229.52.128/26',
    '15.229.52.80/28',

    // New relic  Manama, BH
    '157.241.17.0/26',
    '157.241.55.64/26',

    // New relic Cape Town, ZA
    '13.245.248.192/26',
    '13.245.248.160/27',
    '13.246.147.0/26',
  ];

  static readonly BBH_WHITELIST: string[] = [
    '58.220.95.0/24',
    '64.215.22.0/24',
    '94.188.139.64/26',
    '98.98.26.0/23',
    '98.98.28.0/24',
    '104.129.192.0/20',
    '124.248.141.0/24',
    '128.177.125.0/24',
    '136.226.0.0/16',
    '137.83.128.0/18',
    '140.210.152.0/23',
    '147.161.128.0/17',
    '154.113.23.0/24',
    '165.225.0.0/17',
    '165.225.192.0/18',
    '167.103.0.0/16',
    '170.85.0.0/16',
    '185.46.212.0/22',
    '196.23.154.96/27',
    '197.98.201.0/24',
    '211.144.19.0/24',
    '220.243.154.0/23',
    '221.122.91.0/24',
    '192.200.5.0/24',
    '204.136.26.0/24',
    '192.200.8.0/24',
  ];

  static readonly MOVE_IT_WHITELIST: string[] = [
    this.DFT_STATIC_VPN,

    // Celigo
    '44.204.21.0/24',

    // Kon personal IP for testing
    '47.36.65.145/32',
    // Amit
    '107.138.105.193/32',

    // Pen Test whitelisting
    '70.164.45.56/32',
    '204.13.200.248/32',
    '98.161.225.228/32',

    // ------- Customers ------ //

    // 1st Source Bank
    '12.197.121.132/32',
    '12.197.120.4/32',
    '12.239.143.132/32',

    // Associated Bank
    '185.46.212.0/22',
    '104.129.192.0/20',
    '165.225.0.0/17',
    '165.225.192.0/18',
    '147.161.128.0/17',
    '136.226.0.0/16',
    '137.83.128.0/18',
    '104.153.76.0/22',
    '199.244.112.0/22',
    '170.85.0.0/16',
    '170.85.6.0/23',
    '170.85.8.0/23',
    '170.85.10.0/23',
    '170.85.12.0/23',
    '170.85.14.0/23',
    '170.85.26.0/23',

    // Axos Bank
    '65.141.140.226/32',
    '67.134.110.162/32',
    '68.110.137.226/32',
    '69.43.196.4/32',
    '69.43.196.12/32',
    '69.43.196.15/32',
    '69.43.196.48/32',
    '69.43.198.0/28',
    '69.43.196.79/32',
    '69.43.196.4/32',
    '69.43.198.12/32',

    // Banco de Bogota
    '200.124.124.0/23',
    '200.124.125.32/32',
    '200.124.125.33/32',
    '200.124.125.34/32',
    '200.124.125.35/32',
    '200.124.125.36/32',
    '200.124.125.37/32',
    '200.124.124.81/32',
    '200.124.124.82/32',
    '200.124.124.83/32',
    '200.124.124.84/32',
    '200.124.124.88/32',

    // Brown Brothers Harriman
    '202.130.155.72/29',
    '204.136.26.0/24',
    '162.211.139.248/29',
    '212.2.168.200/29',
    '27.111.199.104/29',
    '204.136.23.0/24',
    '5.149.112.8/29',
    '192.200.5.0/24',
    '204.136.16.0/24',
    '204.136.21.0/24',
    '204.136.19.0/24',
    '192.200.1.0/24',
    '204.136.20.0/24',
    '217.192.152.216/29',
    '192.200.8.0/24',
    '204.136.17.0/24',
    '204.136.18.0/24',
    '204.136.24.0/24',
    '204.136.25.0/24',
    '204.136.29.0/24',
    '204.136.31.0/24',
    '98.217.195.65/32',
    '172.56.64.59/32',
    '98.25.80.88/32',
    '71.233.70.36/32',
    '70.124.170.7/32',
    '98.168.229.247/32',
    '75.130.250.183/32',
    '99.110.10.57/32',
    '75.76.220.62/32',
    '76.152.199.191/32',
    '98.224.226.194/32',
    '73.167.154.92/32',
    '192.200.2.25/32',
    '192.200.2.26/32',
    '192.200.8.25/32',
    '192.200.8.26/32',
    '204.136.27.25/32',
    '204.136.27.26/32',

    // Cadence Bank
    '63.78.207.0/24',
    '38.104.63.180/30',
    '173.235.101.40/29',
    '198.232.168.0/24',
    '198.232.169.0/24',
    '206.152.254.0/23',
    '206.153.254.0/24',
    '206.154.254.0/23',
    '208.62.116.64/27',
    '216.79.77.128/27',
    '74.120.88.0/23',
    '74.120.90.0/23',

    // Central Bank
    '216.84.108.0/26',
    '97.65.168.192/26',
    '165.225.35.20/32',

    // Central Technology Services
    '199.255.160.20/32',
    '199.255.161.20/32',
    '199.255.162.20/32',
    '199.255.163.20/32',
    '199.255.161.24/32',
    '199.255.163.24/32',
    '104.45.152.13/32',
    '104.211.58.13/32',
    '20.241.233.192/27',
    '13.68.194.79/32',
    '104.211.59.188/32',
    '20.115.207.224/27',
    '13.68.196.115/32',
    '104.211.60.235/32',
    '13.68.196.39/32',
    '104.211.60.25/32',
    '13.83.91.3/32',
    '104.42.7.107/32',
    '40.112.192.69/32',
    '13.92.80.171/32',
    '40.112.196.57/32',
    '168.62.223.35/32',
    '40.112.198.128/32',
    '40.112.192.69/32',
    '40.121.85.74/32',
    '40.112.196.57/32',
    '40.78.2.143/32',
    '40.112.198.128/32',
    '40.78.3.182/32',
    '40.114.68.21/32',
    '40.85.151.64/32',
    '40.76.17.6/32',
    '40.87.9.247/32',
    '40.78.2.143/32',
    '52.179.123.100/32',
    '40.78.3.182/32',

    // Citigroup Technologies
    '199.67.138.0/24',
    '199.67.138.0/24',
    '199.67.140.0/24',
    '192.193.171.0/24',
    '192.193.216.0/24',
    '192.193.25.0/24',
    '192.193.39.0/24',
    '192.193.17.0/24',
    '192.193.49.0/24',
    '192.193.37.0/24',
    '192.193.41.0/24',
    '192.193.38.0/24',
    '192.193.46.0/24',
    '192.193.68.0/24',
    '192.193.13.0/24',

    // DNBNOR
    '193.71.227.25/32',
    '193.71.227.26/32',
    '185.68.171.88/32',

    // Dollar Bank
    '204.148.16.114/32',
    '104.129.206.0/23',
    '104.129.192.0/23',
    '104.129.194.0/23',
    '104.129.196.0/23',
    '104.129.198.0/23',
    '104.129.204.0/23',
    '128.177.125.0/24',
    '136.226.0.0/23',
    '136.226.2.0/23',
    '136.226.48.0/23',
    '136.226.50.0/23',
    '136.226.52.0/23',
    '136.226.54.0/23',
    '136.226.56.0/23',
    '136.226.58.0/23',
    '136.226.60.0/23',
    '136.226.62.0/23',
    '136.226.64.0/23',
    '136.226.66.0/23',
    '136.226.68.0/23',
    '136.226.70.0/23',
    '136.226.72.0/23',
    '136.226.74.0/23',
    '136.226.78.0/23',
    '136.226.80.0/23',
    '137.83.154.0/24',
    '147.161.128.0/23',
    '165.225.0.0/23',
    '165.225.10.0/23',
    '165.225.14.0/23',
    '165.225.2.0/24',
    '165.225.208.0/23',
    '165.225.210.0/23',
    '165.225.212.0/23',
    '165.225.214.0/23',
    '165.225.216.0/23',
    '165.225.218.0/23',
    '165.225.220.0/23',
    '165.225.222.0/23',
    '165.225.242.0/23',
    '165.225.246.0/23',
    '165.225.32.0/23',
    '165.225.34.0/23',
    '165.225.36.0/23',
    '165.225.38.0/23',
    '165.225.48.0/24',
    '165.225.50.0/23',
    '165.225.56.0/22',
    '165.225.60.0/22',
    '165.225.8.0/23',
    '64.215.22.0/24',
    '185.46.212.0/22',
    '104.129.192.0/20',
    '165.225.192.0/18',
    '147.161.128.0/17',
    '136.226.0.0/16',
    '137.83.128.0/18',
    '44.232.26.251/32',
    '136.226.94.0/23',
    '112.196.99.180/32',
    '27.251.211.238/32',
    '147.161.238.0/23',
    '147.161.254.0/23',
    '136.226.84.0/23',
    '64.241.120.19/32',
    '64.241.120.53/32',
    '204.148.16.114/32',

    // EASCORP
    '63.117.120.97/32',
    '63.117.120.98/32',
    '69.38.149.225/32',
    '69.38.149.226/32',
    '208.252.57.195/32',
    '208.252.57.197/32',

    // East West Bank
    '208.65.144.249/32',
    '139.131.208.0/20',
    '139.131.224.0/20',
    '98.252.233.128/32',
    '207.105.125.0/24',
    '207.105.125.161/32',
    '63.157.54.0/24',
    '139.131.148.0/22',
    '208.81.65.192/32',
    '161.69.192.123/32',
    '161.69.206.27/32',
    '193.128.33.248/32',
    '208.81.64.248/32',
    '161.69.22.122/32',
    '208.42.251.123/32',
    '203.97.87.59/32',
    '124.47.168.139/32',
    '139.131.148.120/32',
    '210.5.29.116/32',
    '195.110.40.7/32',
    '31.168.235.72/29',
    '31.168.235.80/28',
    '212.143.240.235/32',
    '46.116.106.128/32',
    '210.5.169.85/32',
    '125.215.207.84/32',
    '136.179.39.30/32',
    '136.179.39.31/32',
    '63.157.54.30/32',
    '63.157.54.31/32',
    '125.215.207.85/32',
    '210.5.29.117/32',
    '223.197.12.0/28',
    '20.94.196.174/32',
    '52.143.111.101/32',

    // FHLBATL
    '66.104.159.12/32',
    '209.11.0.22/32',
    '209.10.152.22/32',

    // First National Bank of Omaha
    '204.58.233.6/32',
    '204.58.233.1/32',
    '216.205.197.132/32',
    '163.116.128.0/17',
    '74.217.93.0/24',
    '8.36.116.0/24',
    '23.23.244.143/32',
    '35.153.245.4/32',

    // FRB
    '139.131.82.36/32',
    '3.6.4.80/32',
    '3.8.11.29/32',
    '3.9.1.18/32',
    '3.13.215.99/32',
    '3.14.46.193/32',
    '3.39.44.47/32',
    '3.64.74.39/32',
    '3.73.87.246/32',
    '3.98.63.76/32',
    '3.98.135.215/32',
    '3.98.177.54/32',
    '3.111.249.154/32',
    '3.115.97.102/32',
    '3.115.103.179/32',
    '3.133.187.250/32',
    '3.140.226.194/32',
    '5.104.64.0/21',
    '8.4.36.0/24',
    '12.191.24.66/32',
    '13.39.33.165/32',
    '13.50.50.151/32',
    '13.53.185.231/32',
    '13.124.169.20/32',
    '13.209.121.230/32',
    '13.211.13.77/32',
    '13.215.4.206/32',
    '13.229.18.166/32',
    '13.232.105.59/32',
    '13.239.109.149/32',
    '13.251.163.211/32',
    '14.140.251.0/24',
    '15.152.208.131/32',
    '15.152.233.79/32',
    '15.152.247.163/32',
    '15.152.248.252/32',
    '15.188.200.20/32',
    '15.236.2.94/32',
    '16.16.49.21/32',
    '16.170.20.215/32',
    '18.135.110.64/32',
    '18.176.6.67/32',
    '18.181.24.204/32',
    '18.185.255.82/32',
    '18.196.131.210/32',
    '18.217.221.118/32',
    '18.229.198.5/32',
    '18.230.146.242/32',
    '20.80.228.137/32',
    '20.80.229.224/32',
    '20.85.73.229/32',
    '20.96.161.3/32',
    '34.196.24.89/32',
    '34.204.38.51/32',
    '34.209.182.191/32',
    '34.218.82.174/32',
    '34.226.48.135/32',
    '34.233.15.68/32',
    '34.242.32.159/32',
    '34.247.76.83/32',
    '34.249.32.59/32',
    '35.165.29.242/32',
    '35.178.6.185/32',
    '36.67.255.152/29',
    '41.63.64.0/18',
    '43.205.65.123/32',
    '44.207.182.11/32',
    '45.113.116.0/22',
    '45.227.88.0/22',
    '46.22.64.0/20',
    '46.183.88.0/21',
    '46.228.144.0/20',
    '49.231.126.0/24',
    '50.59.174.85/32',
    '50.59.174.180/32',
    '50.112.14.41/32',
    '52.18.75.108/32',
    '52.21.59.214/32',
    '52.25.205.193/32',
    '52.32.231.197/32',
    '52.47.191.80/32',
    '52.49.143.224/32',
    '52.52.60.84/32',
    '52.74.86.155/32',
    '52.205.28.174/32',
    '52.210.226.89/32',
    '54.0.0.0/8',
    '54.67.63.146/32',
    '54.153.96.228/32',
    '54.176.53.171/32',
    '54.176.233.47/32',
    '54.200.187.149/32',
    '54.206.123.161/32',
    '54.206.153.42/32',
    '54.207.0.245/32',
    '54.207.224.91/32',
    '54.215.63.167/32',
    '54.218.1.106/32',
    '61.221.181.64/26',
    '63.35.98.118/32',
    '64.12.0.0/16',
    '65.198.79.64/26',
    '65.199.146.192/26',
    '65.200.46.128/26',
    '65.200.151.160/27',
    '65.200.157.192/27',
    '65.222.137.0/26',
    '65.222.145.128/26',
    '66.54.215.50/32',
    '66.192.35.226/32',
    '68.130.0.0/17',
    '68.130.128.0/24',
    '68.130.136.0/21',
    '68.140.206.0/23',
    '68.142.64.0/18',
    '68.232.32.0/20',
    '69.28.128.0/18',
    '69.28.138.242/32',
    '69.164.0.0/18',
    '69.164.58.92/32',
    '70.124.170.7/32',
    '71.233.70.36/32',
    '72.21.80.0/20',
    '73.167.154.92/32',
    '73.218.224.113/32',
    '75.76.220.62/32',
    '75.130.250.183/32',
    '76.152.199.191/32',
    '87.248.192.0/19',
    '88.194.45.128/26',
    '88.194.47.224/27',
    '93.184.208.0/20',
    '95.140.224.0/20',
    '98.25.80.88/32',
    '98.168.229.247/32',
    '98.217.195.65/32',
    '98.224.226.194/32',
    '99.43.94.192/32',
    '99.79.155.151/32',
    '99.110.10.57/32',
    '100.20.238.81/32',
    '100.21.203.247/32',
    '101.226.203.0/24',
    '103.53.12.0/22',
    '104.11.167.177/32',
    '108.161.240.0/20',
    '110.164.36.0/24',
    '110.232.176.0/22',
    '111.119.0.0/19',
    '111.221.32.0/21',
    '117.18.232.0/21',
    '117.103.183.0/24',
    '117.121.248.0/21',
    '119.46.85.0/24',
    '120.132.137.0/25',
    '121.156.59.224/27',
    '121.189.46.0/23',
    '122.248.176.17/32',
    '136.228.144.0/24',
    '139.131.0.0/16',
    '139.131.109.10/32',
    '139.131.144.0/24',
    '139.131.148.0/24',
    '139.131.208.0/24',
    '139.131.241.0/24',
    '142.215.23.28/32',
    '142.215.23.29/32',
    '142.215.23.30/32',
    '142.215.34.172/32',
    '142.215.34.173/32',
    '142.215.34.174/32',
    '149.28.56.243/32',
    '152.190.247.0/24',
    '152.195.0.0/16',
    '152.199.0.0/16',
    '161.69.22.122/32',
    '165.227.140.17/32',
    '170.225.27.132/32',
    '172.56.64.59/32',
    '173.209.240.197/32',
    '173.209.242.0/24',
    '173.209.242.80/29',
    '173.252.130.61/32',
    '173.252.134.0/24',
    '173.252.134.80/29',
    '178.79.192.0/18',
    '178.249.104.0/21',
    '180.240.184.0/24',
    '184.169.172.3/32',
    '185.116.100.0/22',
    '192.16.0.0/18',
    '192.30.0.0/19',
    '192.229.128.0/17',
    '194.255.210.64/26',
    '194.255.242.160/27',
    '195.67.219.64/27',
    '198.7.16.0/20',
    '200.110.232.0/21',
    '202.59.216.0/21',
    '203.9.176.0/21',
    '203.66.205.0/24',
    '203.74.4.64/26',
    '203.77.184.0/21',
    '206.15.76.98/32',
    '206.165.200.0/22',
    '206.201.24.0/24',
    '208.42.251.112/28',
    '208.69.176.0/21',
    '208.111.128.0/18',
    '209.136.227.218/32',
    '209.213.214.242/32',
    '209.234.175.238/32',
    '213.64.234.0/26',
    '213.65.58.0/24',
    '213.175.80.0/24',
    '216.247.120.0/21',
    '216.253.231.0/29',
    '139.131.80.85/32',
    '3.6.4.80/32',
    '3.8.11.29/32',
    '3.9.1.18/32',
    '3.13.215.99/32',
    '3.14.46.193/32',
    '3.37.49.54/32',
    '3.39.44.47/32',
    '3.64.74.39/32',
    '3.73.87.246/32',
    '3.98.63.76/32',
    '3.98.135.215/32',
    '3.98.177.54/32',
    '3.111.249.154/32',
    '3.115.97.102/32',
    '3.115.103.179/32',
    '3.133.187.250/32',
    '3.134.8.27/32',
    '3.136.165.140/32',
    '3.140.226.194/32',
    '5.104.64.0/21',
    '8.4.36.0/24',
    '8.4.36.16/29',
    '13.39.33.165/32',
    '13.50.50.151/32',
    '13.53.185.231/32',
    '13.124.169.20/32',
    '13.209.121.230/32',
    '13.211.13.77/32',
    '13.215.4.206/32',
    '13.229.18.166/32',
    '13.232.105.59/32',
    '13.239.109.149/32',
    '13.251.163.211/32',
    '15.152.208.131/32',
    '15.152.233.79/32',
    '15.152.247.163/32',
    '15.152.248.252/32',
    '15.188.200.20/32',
    '15.236.2.94/32',
    '16.16.49.21/32',
    '16.170.20.215/32',
    '18.135.110.64/32',
    '18.176.6.67/32',
    '18.181.24.204/32',
    '18.185.255.82/32',
    '18.196.131.210/32',
    '18.217.221.118/32',
    '18.229.198.5/32',
    '18.230.146.242/32',
    '20.59.174.180/32',
    '23.11.229.128/25',
    '23.35.71.0/24',
    '23.45.183.0/24',
    '23.48.94.0/24',
    '23.48.209.0/24',
    '23.53.126.0/24',
    '23.56.175.0/24',
    '23.62.239.0/24',
    '23.67.42.0/24',
    '23.79.240.0/24',
    '23.213.54.0/24',
    '23.213.55.0/24',
    '23.223.149.0/24',
    '23.223.202.0/24',
    '34.196.24.89/32',
    '34.204.38.51/32',
    '34.209.182.191/32',
    '34.218.82.174/32',
    '34.226.48.135/32',
    '34.233.15.68/32',
    '34.242.32.159/32',
    '34.247.76.83/32',
    '34.249.32.59/32',
    '35.162.16.19/32',
    '35.165.25.90/32',
    '35.165.29.242/32',
    '35.178.6.185/32',
    '36.67.255.152/29',
    '41.63.64.0/18',
    '43.205.65.123/32',
    '44.207.182.11/32',
    '45.113.116.0/22',
    '45.227.88.0/22',
    '46.22.64.0/20',
    '46.183.88.0/21',
    '46.228.144.0/20',
    '49.231.126.0/24',
    '50.59.174.84/32',
    '50.59.174.85/32',
    '50.59.174.179/32',
    '50.59.174.180/32',
    '50.59.174.181/32',
    '50.59.174.182/32',
    '50.112.14.41/32',
    '52.11.254.203/32',
    '52.18.75.108/32',
    '52.21.59.214/32',
    '52.25.205.193/32',
    '52.32.231.197/32',
    '52.47.191.80/32',
    '52.49.143.224/32',
    '52.52.60.84/32',
    '52.53.75.159/32',
    '52.74.86.155/32',
    '52.205.28.174/32',
    '52.210.226.89/32',
    '54.0.0.0/8',
    '54.67.63.146/32',
    '54.153.96.228/32',
    '54.176.53.171/32',
    '54.176.233.47/32',
    '54.177.162.173/32',
    '54.186.179.123/32',
    '54.200.187.149/32',
    '54.206.123.161/32',
    '54.206.153.42/32',
    '54.207.0.245/32',
    '54.207.224.91/32',
    '54.215.63.167/32',
    '54.218.1.106/32',
    '61.221.181.64/26',
    '63.35.98.118/32',
    '64.12.0.0/16',
    '65.198.79.64/26',
    '65.199.146.192/26',
    '65.200.46.128/26',
    '65.200.151.160/27',
    '65.200.157.192/27',
    '65.222.137.0/26',
    '65.222.145.128/26',
    '66.54.215.50/32',
    '66.192.35.226/32',
    '68.130.0.0/17',
    '68.130.128.0/24',
    '68.130.136.0/21',
    '68.140.206.0/23',
    '68.142.64.0/18',
    '68.232.32.0/20',
    '69.28.128.0/18',
    '69.28.138.242/32',
    '69.164.0.0/18',
    '69.164.58.92/32',
    '70.124.170.7/32',
    '71.233.70.36/32',
    '72.21.80.0/20',
    '73.167.154.92/32',
    '73.218.224.113/32',
    '75.76.220.62/32',
    '75.130.250.183/32',
    '76.152.199.191/32',
    '87.248.192.0/19',
    '88.194.45.128/26',
    '88.194.47.224/27',
    '93.184.208.0/20',
    '95.140.224.0/20',
    '98.25.80.88/32',
    '98.168.229.247/32',
    '98.217.195.65/32',
    '98.224.226.194/32',
    '99.43.94.192/32',
    '99.79.155.151/32',
    '99.110.10.57/32',
    '100.20.238.81/32',
    '100.21.203.247/32',
    '101.226.203.0/24',
    '103.53.12.0/22',
    '104.11.167.177/32',
    '104.102.248.0/24',
    '104.119.189.0/24',
    '104.124.57.0/24',
    '104.124.60.0/24',
    '108.161.240.0/20',
    '110.164.36.0/24',
    '110.232.176.0/22',
    '111.119.0.0/19',
    '111.221.32.0/21',
    '117.18.232.0/21',
    '117.103.183.0/24',
    '117.121.248.0/21',
    '119.46.85.0/24',
    '120.132.137.0/25',
    '121.156.59.224/27',
    '121.189.46.0/23',
    '136.228.144.0/24',
    '139.131.0.0/16',
    '149.28.56.243/32',
    '152.190.247.0/24',
    '152.195.0.0/16',
    '152.199.0.0/16',
    '165.227.140.17/32',
    '172.56.64.59/32',
    '172.232.1.0/24',
    '172.232.5.0/24',
    '172.232.13.0/24',
    '173.209.240.197/32',
    '173.209.242.80/29',
    '173.252.130.61/32',
    '173.252.134.80/29',
    '178.79.192.0/18',
    '178.249.104.0/21',
    '180.240.184.0/24',
    '184.26.90.0/24',
    '184.28.156.0/24',
    '184.28.199.0/24',
    '184.51.151.0/24',
    '184.169.172.3/32',
    '185.116.100.0/22',
    '192.16.0.0/18',
    '192.30.0.0/19',
    '192.229.128.0/17',
    '194.255.210.64/26',
    '194.255.242.160/27',
    '195.67.219.64/27',
    '198.7.16.0/20',
    '200.110.232.0/21',
    '202.59.216.0/21',
    '203.9.176.0/21',
    '203.66.205.0/24',
    '203.74.4.64/26',
    '203.77.184.0/21',
    '204.237.142.0/24',
    '205.140.227.154/32',
    '206.15.76.98/32',
    '206.165.200.0/22',
    '208.69.176.0/21',
    '208.111.128.0/18',
    '209.136.227.218/32',
    '209.213.214.242/32',
    '209.234.175.238/32',
    '213.64.234.0/26',
    '213.65.58.0/24',
    '213.175.80.0/24',
    '216.34.161.154/32',
    '216.64.186.160/28',
    '216.247.120.0/21',
    '216.253.231.0/29',

    // Flagstar Bank
    '63.78.207.135/32',
    '12.220.103.1/32',
    '12.220.103.2/32',
    '12.220.103.3/32',
    '12.220.103.4/32',
    '12.220.103.5/32',
    '12.220.103.6/32',
    '12.220.103.7/32',
    '12.220.103.8/32',
    '208.71.55.1/32',
    '208.71.55.2/32',
    '208.71.55.3/32',
    '208.71.55.4/32',
    '208.71.55.5/32',
    '208.71.55.6/32',
    '208.71.55.7/32',
    '208.71.55.8/32',
    '208.71.54.1/32',
    '208.71.54.2/32',
    '208.71.54.3/32',
    '208.71.54.4/32',
    '208.71.54.5/32',
    '208.71.54.6/32',
    '208.71.54.7/32',
    '208.71.54.8/32',

    // German American Bank
    '40.142.51.133/32',
    '70.124.170.7/32',
    '71.233.70.36/32',
    '73.167.154.92/32',
    '73.218.224.113/32',
    '75.76.220.62/32',
    '75.130.250.183/32',
    '76.152.199.191/32',
    '98.25.80.88/32',
    '98.168.229.247/32',
    '98.217.195.65/32',
    '98.224.226.194/32',
    '99.110.10.57/32',
    '138.229.0.0/20',
    '139.131.0.0/16',
    '172.56.64.59/32',
    '206.201.24.0/24',
    '208.42.251.112/28',
    '216.27.43.13/32',
    '216.49.127.0/24',

    // Flusing Bank
    '76.191.42.68/32',

    // Mizuho Bank Ltd.
    '208.85.104.0/22',
    '8.2.79.0/24',
    '8.11.195.0/24',
    '208.65.144.249/32',

    // NORDEA
    '208.204.107.68/32',
    '208.204.107.69/32',
    '208.204.107.194/32',
    '208.204.107.209/32',
    '208.204.107.212/32',
    '208.204.107.241/32',
    '216.119.42.195/32',
    '65.200.156.28/32',
    '65.200.156.68/32',

    // Santander
    '24.47.168.139/32',
    '161.69.22.122/32',
    '161.69.192.123/32',
    '161.69.206.27/32',
    '193.128.33.248/32',
    '203.97.87.59/32',
    '208.81.64.248/32',
    '208.42.251.123/32',
    '193.127.134.0/24',
    '193.127.134.1/32',
    '193.127.132.0/24',
    '193.127.132.1/32',

    // Societe Generale
    '162.246.240.0/24',
    '162.246.241.0/24',
    '194.119.24.0/24',
    '194.119.40.0/24',
    '194.119.85.0/28',
    '207.45.240.16/28',
    '207.45.249.128/27',
    '170.55.208.180/32',
    '170.55.208.181/32',
    '170.52.140.218/32',
    '170.90.22.6/32',
    '170.91.23.227/32',
    '162.246.241.133/32',
    '162.246.240.134/32',
    '162.246.241.134/32',

    // State street
    '192.250.112.192/27',
    '192.250.175.192/27',
    '192.250.85.192/27',

    // SVB
    '104.129.192.0/23',
    '104.129.194.0/23',
    '104.129.196.0/23',
    '104.129.198.0/23',
    '104.129.200.0/23',
    '104.129.202.0/23',
    '104.129.204.0/23',
    '104.129.206.0/23',
    '136.226.66.0/23',
    '136.226.68.0/23',
    '165.225.0.0/17',
    '165.225.104.0/24',
    '165.225.106.0/23',
    '165.225.110.0/23',
    '165.225.112.0/23',
    '165.225.116.0/23',
    '165.225.192.0/18',
    '165.225.32.0/23',
    '165.225.34.0/23',
    '165.225.36.0/23',
    '165.225.38.0/23',
    '165.225.76.0/23',
    '165.225.80.0/22',
    '193.240.116.128/28',
    '198.212.183.0/24',
    '198.245.241.0/24',
    '198.245.242.0/24',
    '208.80.232.0/22',
    '3.227.189.166/32',
    '52.22.158.76/32',
    '52.36.227.109/32',
    '54.184.141.157/32',
    '10.98.33.229/32',
    '10.101.16.231/32',
    '23.93.206.19/32',
    '49.207.216.170/32',
    '122.50.203.249/32',
    '136.226.253.0/32',
    '136.226.253.34/32',
    '136.226.67.84/32',

    // TD Bank
    '142.205.13.124/32',
    '142.205.13.125/32',
    '142.205.13.126/32',
    '142.205.13.189/32',
    '142.205.13.190/32',
    '142.205.13.191/32',
    '142.205.130.124/32',
    '142.205.130.125/32',
    '142.205.130.126/32',
    '142.205.241.254/32',
    '142.205.241.253/32',
    '142.205.241.252/32',
    '142.205.241.251/32',
    '142.205.202.62/32',
    '162.12.220.0/24',
    '162.12.221.0/24',

    // UMB Bank N.A.
    '198.176.247.51/32',
    '66.209.71.137/32',
    '192.206.105.62/32',
    '192.206.105.140/32',
    '66.209.71.138/32',

    // UBT
    '204.128.130.242/32',

    // Westpac New Zealand
    '202.7.37.32/27',
    '202.7.37.64/27',
    '202.7.50.3/32',

    // Zions Bank
    '209.20.103.246/32',
    '209.20.103.246/32',
    '209.20.103.247/32',
    '209.20.122.64/32',
    '209.20.122.65/32',
    '148.64.8.32/32',
    '148.64.8.33/32',
    '34.93.163.32/32',
    '34.93.163.33/32',
    '98.158.240.32/32',
    '98.158.240.33/32',
    '34.102.2.70/32',
    '34.102.2.71/32',

    ...this.BBH_WHITELIST,
    ...this.NEW_RELIC_WHITELIST,
  ];

  static readonly FISHEYE_WHITELIST_IPV4: string[] = [
    '204.13.200.248/32',
    '72.83.230.59/32',
    '3.216.235.48/32',
    '34.231.96.243/32',
    '44.199.3.254/32',
    '174.129.205.191/32',
    '44.199.127.226/32',
    '44.199.45.64/32',
    '3.221.151.112/32',
    '52.205.184.192/32',
    '52.72.137.240/32',
    '34.232.119.183/32',
    '35.155.178.254/32',
    '34.216.18.129/32',
    '35.171.175.212/32',
    '35.160.177.10/32',
    '34.199.54.113/32',
    '52.204.96.37/32',
    '34.232.25.90/32',
    '52.202.195.162/32',
    '52.54.90.98/32',
    '52.203.14.55/32',
    '34.236.25.177/32',
    '18.236.52.165/32',
    '34.215.254.205/32',
    '35.160.6.102/32',
    '52.43.192.52/32',
    '52.89.100.78/32',
    '54.190.195.254/32',
    '54.214.155.219/32',
    '54.218.196.28/32',
    '3.26.128.128/26',
    '3.69.198.0/26',
    '3.101.177.128/26',
    '3.251.213.64/26',
    '13.52.5.0/25',
    '13.52.5.96/28',
    '13.200.41.128/25',
    '13.200.41.224/28',
    '13.214.1.0/26',
    '13.236.8.128/25',
    '13.236.8.224/28',
    '15.229.145.128/25',
    '15.229.145.224/28',
    '16.63.53.128/25',
    '16.63.53.224/28',
    '18.136.214.0/25',
    '18.136.214.96/28',
    '18.184.99.128/25',
    '18.184.99.224/28',
    '18.205.93.0/27',
    '18.234.32.128/25',
    '18.234.32.224/28',
    '18.246.31.128/25',
    '18.246.31.224/28',
    '34.218.156.209/32',
    '34.218.168.212/32',
    '35.84.197.128/26',
    '43.202.69.0/25',
    '43.202.69.96/28',
    '44.197.146.192/26',
    '52.41.219.63/32',
    '52.215.192.128/25',
    '52.215.192.224/28',
    '104.192.136.0/21',
    '104.192.136.0/24',
    '104.192.136.240/28',
    '104.192.137.0/24',
    '104.192.137.240/28',
    '104.192.138.0/24',
    '104.192.138.240/28',
    '104.192.140.0/24',
    '104.192.140.240/28',
    '104.192.142.0/24',
    '104.192.142.240/28',
    '104.192.143.0/24',
    '104.192.143.240/28',
    '185.166.140.0/22',
    '185.166.140.0/24',
    '185.166.140.112/28',
    '185.166.141.0/24',
    '185.166.141.112/28',
    '185.166.142.0/24',
    '185.166.142.240/28',
    '185.166.143.0/24',
    '185.166.143.240/28',

    // Abhinash ip
    '106.201.123.145/32',

    // Pen test
    '70.164.45.56/32',
  ];

  static readonly FISHEYE_WHITELIST_IPV6: string[] = [
    '2401:1d80:3000::/36',
    '2401:1d80:3200::/64',
    '2401:1d80:3200:2::/64',
    '2401:1d80:3200:5::/64',
    '2401:1d80:3204:3::/64',
    '2401:1d80:3204:4::/64',
    '2401:1d80:3204:5::/64',
    '2401:1d80:3208:3::/64',
    '2401:1d80:3208:4::/64',
    '2401:1d80:3208:5::/64',
    '2401:1d80:320c::/64',
    '2401:1d80:320c:1::/64',
    '2401:1d80:320c:2::/64',
    '2401:1d80:3210:3::/64',
    '2401:1d80:3210:4::/64',
    '2401:1d80:3210:5::/64',
    '2401:1d80:3214:3::/64',
    '2401:1d80:3214:4::/64',
    '2401:1d80:3214:5::/64',
    '2401:1d80:3218::/64',
    '2401:1d80:3218:2::/64',
    '2401:1d80:3218:5::/64',
    '2401:1d80:321c:3::/64',
    '2401:1d80:321c:4::/64',
    '2401:1d80:321c:5::/64',
    '2401:1d80:3220:2::/64',
    '2401:1d80:3220:3::/64',
    '2401:1d80:3224:3::/64',
    '2401:1d80:3224:4::/64',
    '2401:1d80:3224:5::/64',
    '2401:1d80:3228::/64',
    '2401:1d80:3228:1::/64',
    '2401:1d80:3228:4::/64',
    '2401:1d80:322c::/64',
    '2401:1d80:322c:1::/64',
    '2401:1d80:322c:4::/64',
    '2401:1d80:3230::/64',
    '2401:1d80:3230:2::/64',
    '2401:1d80:3230:4::/64',
    '2401:1d80:3234:3::/64',
    '2401:1d80:3234:4::/64',
    '2401:1d80:3234:5::/64',
    '2406:da18:809:e00::/56',
    '2406:da18:809:e04::/64',
    '2406:da18:809:e05::/64',
    '2406:da18:809:e06::/64',
    '2406:da1c:1e0:a200::/56',
    '2406:da1c:1e0:a204::/64',
    '2406:da1c:1e0:a205::/64',
    '2406:da1c:1e0:a206::/64',
    '2600:1f14:824:300::/56',
    '2600:1f14:824:304::/64',
    '2600:1f14:824:305::/64',
    '2600:1f14:824:306::/64',
    '2600:1f18:2146:e300::/56',
    '2600:1f18:2146:e304::/64',
    '2600:1f18:2146:e305::/64',
    '2600:1f18:2146:e306::/64',
    '2600:1f1c:cc5:2300::/56',
    '2600:1f1c:cc5:2304::/64',
    '2600:1f1c:cc5:2305::/64',
    '2a05:d014:f99:dd00::/56',
    '2a05:d014:f99:dd04::/64',
    '2a05:d014:f99:dd05::/64',
    '2a05:d014:f99:dd06::/64',
    '2a05:d018:34d:5800::/56',
    '2a05:d018:34d:5804::/64',
    '2a05:d018:34d:5805::/64',
    '2a05:d018:34d:5806::/64',
  ];

  static readonly FRB_SHORT_WHITELIST = [
    '173.209.242.0/24',
    '173.252.134.0/24',
    '8.4.36.0/24',
  ];

  static readonly FRB_TST_LOGIN_WHITELIST = [
    '139.131.82.36/32',
    '3.6.4.80/32',
    '3.8.11.29/32',
    '3.9.1.18/32',
    '3.13.215.99/32',
    '3.14.46.193/32',
    '3.39.44.47/32',
    '3.64.74.39/32',
    '3.73.87.246/32',
    '3.98.63.76/32',
    '3.98.135.215/32',
    '3.98.177.54/32',
    '3.111.249.154/32',
    '3.115.97.102/32',
    '3.115.103.179/32',
    '3.133.187.250/32',
    '3.140.226.194/32',
    '5.104.64.0/21',
    '8.4.36.0/24',
    '12.191.24.66/32',
    '13.39.33.165/32',
    '13.50.50.151/32',
    '13.53.185.231/32',
    '13.124.169.20/32',
    '13.209.121.230/32',
    '13.211.13.77/32',
    '13.215.4.206/32',
    '13.229.18.166/32',
    '13.232.105.59/32',
    '13.239.109.149/32',
    '13.251.163.211/32',
    '14.140.251.0/24',
    '15.152.208.131/32',
    '15.152.233.79/32',
    '15.152.247.163/32',
    '15.152.248.252/32',
    '15.188.200.20/32',
    '15.236.2.94/32',
    '16.16.49.21/32',
    '16.170.20.215/32',
    '18.135.110.64/32',
    '18.176.6.67/32',
    '18.181.24.204/32',
    '18.185.255.82/32',
    '18.196.131.210/32',
    '18.217.221.118/32',
    '18.229.198.5/32',
    '18.230.146.242/32',
    '20.80.228.137/32',
    '20.80.229.224/32',
    '20.85.73.229/32',
    '20.96.161.3/32',
    '34.196.24.89/32',
    '34.204.38.51/32',
    '34.209.182.191/32',
    '34.218.82.174/32',
    '34.226.48.135/32',
    '34.233.15.68/32',
    '34.242.32.159/32',
    '34.247.76.83/32',
    '34.249.32.59/32',
    '35.165.29.242/32',
    '35.178.6.185/32',
    '36.67.255.152/29',
    '41.63.64.0/18',
    '43.205.65.123/32',
    '44.207.182.11/32',
    '45.113.116.0/22',
    '45.227.88.0/22',
    '46.22.64.0/20',
    '46.183.88.0/21',
    '46.228.144.0/20',
    '49.231.126.0/24',
    '50.59.174.85/32',
    '50.59.174.180/32',
    '50.112.14.41/32',
    '52.18.75.108/32',
    '52.21.59.214/32',
    '52.25.205.193/32',
    '52.32.231.197/32',
    '52.47.191.80/32',
    '52.49.143.224/32',
    '52.52.60.84/32',
    '52.74.86.155/32',
    '52.205.28.174/32',
    '52.210.226.89/32',
    '54.0.0.0/8',
    '54.67.63.146/32',
    '54.153.96.228/32',
    '54.176.53.171/32',
    '54.176.233.47/32',
    '54.200.187.149/32',
    '54.206.123.161/32',
    '54.206.153.42/32',
    '54.207.0.245/32',
    '54.207.224.91/32',
    '54.215.63.167/32',
    '54.218.1.106/32',
    '61.221.181.64/26',
    '63.35.98.118/32',
    '64.12.0.0/16',
    '65.198.79.64/26',
    '65.199.146.192/26',
    '65.200.46.128/26',
    '65.200.151.160/27',
    '65.200.157.192/27',
    '65.222.137.0/26',
    '65.222.145.128/26',
    '66.54.215.50/32',
    '66.192.35.226/32',
    '68.130.0.0/17',
    '68.130.128.0/24',
    '68.130.136.0/21',
    '68.140.206.0/23',
    '68.142.64.0/18',
    '68.232.32.0/20',
    '69.28.128.0/18',
    '69.28.138.242/32',
    '69.164.0.0/18',
    '69.164.58.92/32',
    '70.124.170.7/32',
    '71.233.70.36/32',
    '72.21.80.0/20',
    '73.167.154.92/32',
    '73.218.224.113/32',
    '75.76.220.62/32',
    '75.130.250.183/32',
    '76.152.199.191/32',
    '87.248.192.0/19',
    '88.194.45.128/26',
    '88.194.47.224/27',
    '93.184.208.0/20',
    '95.140.224.0/20',
    '98.25.80.88/32',
    '98.168.229.247/32',
    '98.217.195.65/32',
    '98.224.226.194/32',
    '99.43.94.192/32',
    '99.79.155.151/32',
    '99.110.10.57/32',
    '100.20.238.81/32',
    '100.21.203.247/32',
    '101.226.203.0/24',
    '103.53.12.0/22',
    '104.11.167.177/32',
    '108.161.240.0/20',
    '110.164.36.0/24',
    '110.232.176.0/22',
    '111.119.0.0/19',
    '111.221.32.0/21',
    '117.18.232.0/21',
    '117.103.183.0/24',
    '117.121.248.0/21',
    '119.46.85.0/24',
    '120.132.137.0/25',
    '121.156.59.224/27',
    '121.189.46.0/23',
    '122.248.176.17/32',
    '136.228.144.0/24',
    '139.131.0.0/16',
    '139.131.109.10/32',
    '139.131.144.0/24',
    '139.131.148.0/24',
    '139.131.208.0/24',
    '139.131.241.0/24',
    '142.215.23.28/32',
    '142.215.23.29/32',
    '142.215.23.30/32',
    '142.215.34.172/32',
    '142.215.34.173/32',
    '142.215.34.174/32',
    '149.28.56.243/32',
    '152.190.247.0/24',
    '152.195.0.0/16',
    '152.199.0.0/16',
    '161.69.22.122/32',
    '165.227.140.17/32',
    '170.225.27.132/32',
    '172.56.64.59/32',
    '173.209.240.197/32',
    '173.209.242.0/24',
    '173.209.242.80/29',
    '173.252.130.61/32',
    '173.252.134.0/24',
    '173.252.134.80/29',
    '178.79.192.0/18',
    '178.249.104.0/21',
    '180.240.184.0/24',
    '184.169.172.3/32',
    '185.116.100.0/22',
    '192.16.0.0/18',
    '192.30.0.0/19',
    '192.229.128.0/17',
    '194.255.210.64/26',
    '194.255.242.160/27',
    '195.67.219.64/27',
    '198.7.16.0/20',
    '200.110.232.0/21',
    '202.59.216.0/21',
    '203.9.176.0/21',
    '203.66.205.0/24',
    '203.74.4.64/26',
    '203.77.184.0/21',
    '206.15.76.98/32',
    '206.165.200.0/22',
    '206.201.24.0/24',
    '208.42.251.112/28',
    '208.69.176.0/21',
    '208.111.128.0/18',
    '209.136.227.218/32',
    '209.213.214.242/32',
    '209.234.175.238/32',
    '213.64.234.0/26',
    '213.65.58.0/24',
    '213.175.80.0/24',
    '216.247.120.0/21',
    '216.253.231.0/29',
    '139.131.80.85/32',
    '3.6.4.80/32',
    '3.8.11.29/32',
    '3.9.1.18/32',
    '3.13.215.99/32',
    '3.14.46.193/32',
    '3.37.49.54/32',
    '3.39.44.47/32',
    '3.64.74.39/32',
    '3.73.87.246/32',
    '3.98.63.76/32',
    '3.98.135.215/32',
    '3.98.177.54/32',
    '3.111.249.154/32',
    '3.115.97.102/32',
    '3.115.103.179/32',
    '3.133.187.250/32',
    '3.134.8.27/32',
    '3.136.165.140/32',
    '3.140.226.194/32',
    '5.104.64.0/21',
    '8.4.36.0/24',
    '8.4.36.16/29',
    '13.39.33.165/32',
    '13.50.50.151/32',
    '13.53.185.231/32',
    '13.124.169.20/32',
    '13.209.121.230/32',
    '13.211.13.77/32',
    '13.215.4.206/32',
    '13.229.18.166/32',
    '13.232.105.59/32',
    '13.239.109.149/32',
    '13.251.163.211/32',
    '15.152.208.131/32',
    '15.152.233.79/32',
    '15.152.247.163/32',
    '15.152.248.252/32',
    '15.188.200.20/32',
    '15.236.2.94/32',
    '16.16.49.21/32',
    '16.170.20.215/32',
    '18.135.110.64/32',
    '18.176.6.67/32',
    '18.181.24.204/32',
    '18.185.255.82/32',
    '18.196.131.210/32',
    '18.217.221.118/32',
    '18.229.198.5/32',
    '18.230.146.242/32',
    '20.59.174.180/32',
    '23.11.229.128/25',
    '23.35.71.0/24',
    '23.45.183.0/24',
    '23.48.94.0/24',
    '23.48.209.0/24',
    '23.53.126.0/24',
    '23.56.175.0/24',
    '23.62.239.0/24',
    '23.67.42.0/24',
    '23.79.240.0/24',
    '23.213.54.0/24',
    '23.213.55.0/24',
    '23.223.149.0/24',
    '23.223.202.0/24',
    '34.196.24.89/32',
    '34.204.38.51/32',
    '34.209.182.191/32',
    '34.218.82.174/32',
    '34.226.48.135/32',
    '34.233.15.68/32',
    '34.242.32.159/32',
    '34.247.76.83/32',
    '34.249.32.59/32',
    '35.162.16.19/32',
    '35.165.25.90/32',
    '35.165.29.242/32',
    '35.178.6.185/32',
    '36.67.255.152/29',
    '41.63.64.0/18',
    '43.205.65.123/32',
    '44.207.182.11/32',
    '45.113.116.0/22',
    '45.227.88.0/22',
    '46.22.64.0/20',
    '46.183.88.0/21',
    '46.228.144.0/20',
    '49.231.126.0/24',
    '50.59.174.84/32',
    '50.59.174.85/32',
    '50.59.174.179/32',
    '50.59.174.180/32',
    '50.59.174.181/32',
    '50.59.174.182/32',
    '50.112.14.41/32',
    '52.11.254.203/32',
    '52.18.75.108/32',
    '52.21.59.214/32',
    '52.25.205.193/32',
    '52.32.231.197/32',
    '52.47.191.80/32',
    '52.49.143.224/32',
    '52.52.60.84/32',
    '52.53.75.159/32',
    '52.74.86.155/32',
    '52.205.28.174/32',
    '52.210.226.89/32',
    '54.0.0.0/8',
    '54.67.63.146/32',
    '54.153.96.228/32',
    '54.176.53.171/32',
    '54.176.233.47/32',
    '54.177.162.173/32',
    '54.186.179.123/32',
    '54.200.187.149/32',
    '54.206.123.161/32',
    '54.206.153.42/32',
    '54.207.0.245/32',
    '54.207.224.91/32',
    '54.215.63.167/32',
    '54.218.1.106/32',
    '61.221.181.64/26',
    '63.35.98.118/32',
    '64.12.0.0/16',
    '65.198.79.64/26',
    '65.199.146.192/26',
    '65.200.46.128/26',
    '65.200.151.160/27',
    '65.200.157.192/27',
    '65.222.137.0/26',
    '65.222.145.128/26',
    '66.54.215.50/32',
    '66.192.35.226/32',
    '68.130.0.0/17',
    '68.130.128.0/24',
    '68.130.136.0/21',
    '68.140.206.0/23',
    '68.142.64.0/18',
    '68.232.32.0/20',
    '69.28.128.0/18',
    '69.28.138.242/32',
    '69.164.0.0/18',
    '69.164.58.92/32',
    '70.124.170.7/32',
    '71.233.70.36/32',
    '72.21.80.0/20',
    '73.167.154.92/32',
    '73.218.224.113/32',
    '75.76.220.62/32',
    '75.130.250.183/32',
    '76.152.199.191/32',
    '87.248.192.0/19',
    '88.194.45.128/26',
    '88.194.47.224/27',
    '93.184.208.0/20',
    '95.140.224.0/20',
    '98.25.80.88/32',
    '98.168.229.247/32',
    '98.217.195.65/32',
    '98.224.226.194/32',
    '99.43.94.192/32',
    '99.79.155.151/32',
    '99.110.10.57/32',
    '100.20.238.81/32',
    '100.21.203.247/32',
    '101.226.203.0/24',
    '103.53.12.0/22',
    '104.11.167.177/32',
    '104.102.248.0/24',
    '104.119.189.0/24',
    '104.124.57.0/24',
    '104.124.60.0/24',
    '108.161.240.0/20',
    '110.164.36.0/24',
    '110.232.176.0/22',
    '111.119.0.0/19',
    '111.221.32.0/21',
    '117.18.232.0/21',
    '117.103.183.0/24',
    '117.121.248.0/21',
    '119.46.85.0/24',
    '120.132.137.0/25',
    '121.156.59.224/27',
    '121.189.46.0/23',
    '136.228.144.0/24',
    '139.131.0.0/16',
    '149.28.56.243/32',
    '152.190.247.0/24',
    '152.195.0.0/16',
    '152.199.0.0/16',
    '165.227.140.17/32',
    '172.56.64.59/32',
    '172.232.1.0/24',
    '172.232.5.0/24',
    '172.232.13.0/24',
    '173.209.240.197/32',
    '173.209.242.80/29',
    '173.252.130.61/32',
    '173.252.134.80/29',
    '178.79.192.0/18',
    '178.249.104.0/21',
    '180.240.184.0/24',
    '184.26.90.0/24',
    '184.28.156.0/24',
    '184.28.199.0/24',
    '184.51.151.0/24',
    '184.169.172.3/32',
    '185.116.100.0/22',
    '192.16.0.0/18',
    '192.30.0.0/19',
    '192.229.128.0/17',
    '194.255.210.64/26',
    '194.255.242.160/27',
    '195.67.219.64/27',
    '198.7.16.0/20',
    '200.110.232.0/21',
    '202.59.216.0/21',
    '203.9.176.0/21',
    '203.66.205.0/24',
    '203.74.4.64/26',
    '203.77.184.0/21',
    '204.237.142.0/24',
    '206.15.76.98/32',
    '206.165.200.0/22',
    '208.69.176.0/21',
    '208.111.128.0/18',
    '209.136.227.218/32',
    '209.213.214.242/32',
    '209.234.175.238/32',
    '213.64.234.0/26',
    '213.65.58.0/24',
    '213.175.80.0/24',
    '216.64.186.160/28',
    '216.247.120.0/21',
    '216.253.231.0/29',
  ];

  static readonly S3BUCKETS = {
    INVENTORY_BUCKET: {
      NAME: 'df-inventory',
      REGION: 'us-east-1' as Constants.AWS_REGION_ALIASES,
    },
    CENTRALIZED_FLOW_LOGS_BUCKET: {
      NAME: 'df-centralized-flow-logs',
      REGION: 'us-east-1' as Constants.AWS_REGION_ALIASES,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Constants {
  export enum AMIS {
    SVN_MASTER_IMAGE = 'svn-master-image',
    UOB_APP_SERVER = 'uob-app-server',
    UOB_ANSIBLE_SERVER = 'uob-ansible-server',
    UOB_ANSIBLE_CONTROLLER = 'uob-ansible-controller',
    UOB_SERVER_FOUNDATION = 'uob-server-foundation',
    EB_DEV_IMAGE = 'eb-dev-image',
    CIS_BASE_IMAGE_LATEST = 'cis-base-image_v_8_9',
    CIS_BASE_IMAGE_RHEL_8_7 = 'cis-base-image_v_8_7',
    CIS_BASE_IMAGE_RHEL_7 = 'cis-base-image-rhel-7',
    LIQUIBASE = 'Liquibase',
    PERF_ANSIBLE_CONTROLLER = 'ansibleController',
    PERF_APP_AMI = 'uobAppTier',
    PERF_WEB_AMI = 'uobWebTier',
    PERF_MSI_AMI = 'uobMsiTier',
    PERF_RPT_AMI = 'uobRptTier',
    PERF_MQ_AMI = 'uobMqTier',
    PERF_UPF_AMI = 'uobUpf',
    WINDOWS_2019_DEFAULT = 'windows-2019-default',
    WINDOWS_2022_DEFAULT = 'windows-2022-default',
    WINDOWS_2022_DEFAULT_V2 = 'windows-2022-default-v2',
    WINDOWS_2022_DEFAULT_V3 = 'windows-2022-default-v3',
    WINDOWS_2022_DEFAULT_V4 = 'windows-2022-default-v4',
    JENKINS_WINDOWS_AGENT_SNAPSHOT = 'jenkins-windows-agent-snapshot',
    PALO_ALTO = 'palo-alto',
    PALO_ALTO_BYOL = 'palo-alto-byol',
    PALO_ALTO_PANORAMA = 'palo-alto-panorama',
    NETWORK_SENSOR = 'network-sensor',
    EB_WEB_GOLDEN_IMAGE = 'eb-web-golden-image',
    EB_WIND_GOLDEN_IMAGE = 'eb-wind-golden-image',
    EB_UTIL_GOLDEN_IMAGE = 'eb-util-golden-image',
    EB_APP_GOLDEN_IMAGE = 'eb-app-golden-image',
    FORTIGATE_FORTIMANAGER = 'fortigate-fortimanager',

    EB_APP_01_CIT_RESTORE = 'eb-app-01-cit-restore',
    EB_APP_02_CIT_RESTORE = 'eb-app-02-cit-restore',
    EB_WEB_01_CIT_RESTORE = 'eb-web-01-cit-restore',
    EB_WEB_02_CIT_RESTORE = 'eb-web-02-cit-restore',
    EB_UTIL_01_CIT_RESTORE = 'eb-util-01-cit-restore',
    EB_WIND_01_CIT_RESTORE = 'eb-wind-01-cit-restore',

    /**
     * AMIs created from EB CIT instances on 12/12/23
     */
    EB_APP_01_GOLDEN_IMAGE = 'eb-app-01-golden-image',
    EB_APP_02_GOLDEN_IMAGE = 'eb-app-02-golden-image',
    EB_APP_03_GOLDEN_IMAGE = 'eb-app-03-golden-image',
    EB_MQ_01_GOLDEN_IMAGE = 'eb-mq-01-golden-image',
    EB_MQ_02_GOLDEN_IMAGE = 'eb-mq-02-golden-image',
    EB_UTIL_01_GOLDEN_IMAGE = 'eb-util-01-golden-image',
    EB_UTIL_02_GOLDEN_IMAGE = 'eb-util-02-golden-image',
    EB_WEB_01_GOLDEN_IMAGE = 'eb-web-01-golden-image',
    EB_WEB_02_GOLDEN_IMAGE = 'eb-web-02-golden-image',
    EB_WIND_01_GOLDEN_IMAGE = 'eb-wind-01-golden-image',
  }

  export enum AWS_REGION_ALIASES {
    LEGACY = 'LEGACY',
    DF_PRIMARY = 'DFPRIMARY',
    DF_RECOVERY = 'DFRECOVERY',
    DF_SYDNEY = 'DFSYDNEY',
  }

  export const MANAGED_AMI_IDS: {
    [key in Constants.AWS_REGION_ALIASES]: {
      [key in Constants.AMIS]?: string;
    };
  } = {
    [Constants.AWS_REGION_ALIASES.LEGACY]: {
      [Constants.AMIS.CIS_BASE_IMAGE_LATEST]: 'ami-00c86b7c4413a60e1',
      [Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7]: 'ami-0929211114b6da5a8',
      [Constants.AMIS.CIS_BASE_IMAGE_RHEL_7]: 'ami-030be77f29f4c09db',
      [Constants.AMIS.WINDOWS_2022_DEFAULT]: 'ami-0e38fa17744b2f6a5',
      [Constants.AMIS.WINDOWS_2022_DEFAULT_V2]: 'ami-0fc682b2a42e57ca2',
      [Constants.AMIS.WINDOWS_2022_DEFAULT_V3]: 'ami-00d990e7e5ece7974',
      [Constants.AMIS.WINDOWS_2022_DEFAULT_V4]: 'ami-0f9c44e98edf38a2b',
      [Constants.AMIS.JENKINS_WINDOWS_AGENT_SNAPSHOT]: 'ami-014a4aba6e4f1c65e',
      [Constants.AMIS.SVN_MASTER_IMAGE]: 'ami-0731c63967eb253dc',
      [Constants.AMIS.PALO_ALTO]: 'ami-0e8f3a453b7c788f4', // This is the On-Demand ami
      [Constants.AMIS.PALO_ALTO_BYOL]: 'ami-0fa1cb9e4c6a5257e', // This is the bring your own license ami
    },
    [Constants.AWS_REGION_ALIASES.DF_PRIMARY]: {
      [Constants.AMIS.CIS_BASE_IMAGE_LATEST]: 'ami-06717ddf056235802',
      [Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7]: 'ami-065d46206b289389a',
      [Constants.AMIS.WINDOWS_2019_DEFAULT]: 'ami-0316af9949fb52ebf',
      [Constants.AMIS.WINDOWS_2022_DEFAULT]: 'ami-05d8140b845a8aa7b',
      [Constants.AMIS.WINDOWS_2022_DEFAULT_V2]: 'ami-060b1c20c93e475fd',
      [Constants.AMIS.WINDOWS_2022_DEFAULT_V4]: 'ami-0e6aa5f69f06ffa91',
      [Constants.AMIS.JENKINS_WINDOWS_AGENT_SNAPSHOT]: 'ami-05bb086122bcbee93',
      [Constants.AMIS.PALO_ALTO]: 'ami-0bd9eae1cb45aa9c0', // This is the On-Demand ami
      [Constants.AMIS.PALO_ALTO_BYOL]: 'ami-090ca54cbbe76a832', // This is the bring your own license ami
      [Constants.AMIS.PALO_ALTO_PANORAMA]: 'ami-0158cc8e6f1636865',
      [Constants.AMIS.NETWORK_SENSOR]: 'ami-02982c184d20daa4a',
      [Constants.AMIS.EB_WEB_GOLDEN_IMAGE]: 'ami-0fe2568764b9189f2',
      [Constants.AMIS.EB_WIND_GOLDEN_IMAGE]: 'ami-05efd13c96fca3530',
      [Constants.AMIS.EB_UTIL_GOLDEN_IMAGE]: 'ami-07c5911c97c1462ea',
      [Constants.AMIS.EB_APP_GOLDEN_IMAGE]: 'ami-0bbed3a8479e58bdc',
      [Constants.AMIS.FORTIGATE_FORTIMANAGER]: 'ami-025729b063c7d3f02',

      [Constants.AMIS.EB_APP_01_CIT_RESTORE]: 'ami-0c01329c867902690',
      [Constants.AMIS.EB_APP_02_CIT_RESTORE]: 'ami-0d118f64052cc6ebb',
      [Constants.AMIS.EB_UTIL_01_CIT_RESTORE]: 'ami-0fcfae0db47cc1c92',
      [Constants.AMIS.EB_WEB_01_CIT_RESTORE]: 'ami-0c79c07c005c80bfe',
      [Constants.AMIS.EB_WEB_02_CIT_RESTORE]: 'ami-0d3fc909576664479',
      [Constants.AMIS.EB_WIND_01_CIT_RESTORE]: 'ami-02178535e3303a6e2',

      /**
       * AMIs created from EB CIT instances on 12/12/23
       */
      [Constants.AMIS.EB_APP_01_GOLDEN_IMAGE]: 'ami-0daa3e5a09c04d321',
      [Constants.AMIS.EB_APP_02_GOLDEN_IMAGE]: 'ami-04c2ea9c7d118ce59',
      [Constants.AMIS.EB_APP_03_GOLDEN_IMAGE]: 'ami-0ff0f6e20441cae90',
      [Constants.AMIS.EB_MQ_01_GOLDEN_IMAGE]: 'ami-066f1f886941d8f93',
      [Constants.AMIS.EB_MQ_02_GOLDEN_IMAGE]: 'ami-0011183fb7be18962',
      [Constants.AMIS.EB_UTIL_01_GOLDEN_IMAGE]: 'ami-0a88b84653265e112',
      [Constants.AMIS.EB_UTIL_02_GOLDEN_IMAGE]: 'ami-07bf44a0e7ec7a2b7',
      [Constants.AMIS.EB_WEB_01_GOLDEN_IMAGE]: 'ami-0c1e3a5628ee8be95',
      [Constants.AMIS.EB_WEB_02_GOLDEN_IMAGE]: 'ami-013de77cec0065da7',
      [Constants.AMIS.EB_WIND_01_GOLDEN_IMAGE]: 'ami-019d1055dc1f12e62',
    },
    [Constants.AWS_REGION_ALIASES.DF_RECOVERY]: {
      [Constants.AMIS.CIS_BASE_IMAGE_LATEST]: 'ami-028e26ef0023f0ecc',
      [Constants.AMIS.CIS_BASE_IMAGE_RHEL_8_7]: 'ami-04371c1561c0b95a1',
      [Constants.AMIS.WINDOWS_2022_DEFAULT]: 'ami-0a63ab585cc2143b2',
      [Constants.AMIS.WINDOWS_2022_DEFAULT_V4]: 'ami-0258aac7f0f62500f',
      [Constants.AMIS.PALO_ALTO]: 'ami-0962b0528f9ae2d13',
      [Constants.AMIS.PALO_ALTO_BYOL]: 'ami-0a1b9ca832941f4d8', // This is the bring your own license ami
      [Constants.AMIS.NETWORK_SENSOR]: 'ami-01d2fea6614abe737',
      [Constants.AMIS.PALO_ALTO_PANORAMA]: 'ami-073b188091136420d',
      [Constants.AMIS.FORTIGATE_FORTIMANAGER]: 'ami-0fd4b8cbee99b33d1',
    },
    [Constants.AWS_REGION_ALIASES.DF_SYDNEY]: {},
  };

  export const OS_FAMILY_MAP: {
    [key: string]: 'linux' | 'windows';
  } = {
    'ami-030be77f29f4c09db': 'linux', // * cis-base-image RHEL 7 us-east-1
    'ami-0929211114b6da5a8': 'linux', // * cis-base-image_v_8_7 us-east-1
    'ami-0928cc4c76d523f42': 'linux', // * cis-base-image_v_8_7 us-east-1 (outdated)
    'ami-065d46206b289389a': 'linux', // * cis-base-image_v_8_7 us-east-2
    'ami-04371c1561c0b95a1': 'linux', // * cis-base-image_v_8_7 us-west-2
    'ami-0731c63967eb253dc': 'linux', // * svn-image us-east-1
    'ami-0d6f3cf46ddf357c4': 'linux', // * eb-dev-image us-east-1
    'ami-09d3b3274b6c5d4aa': 'linux', // * amazon-linux-2 us-east-1 (outdated)
    'ami-0c86412148d87d4c8': 'linux', // * linux-vm-for-rds us-east-1
    'ami-0aa547e8d99fcca89': 'linux', // * ansibe-controller us-east-1 (old image created with ami builder)
    'ami-04fa32d10612fc3a7': 'linux', // * uob-app-tier us-east-1 (old image created with ami builder)
    'ami-0b0c1ca62e7aa2d55': 'linux', // * uob-liquibase us-east-1 (old image created with ami builder)
    'ami-0e64accd47ebae70d': 'linux', // * uob-mq-tier us-east-1 (old image created with ami builder)
    'ami-0f4c62dee8260462e': 'linux', // * uob-msi-tier us-east-1 (old image created with ami builder)
    'ami-031753703b6aa5e24': 'linux', // * uob-rpt-tier us-east-1 (old image created with ami builder)
    'ami-0a1bae75ac7a56c18': 'linux', // * uob-upf(rt) us-east-1 (old image created with ami builder)
    'ami-05dee0639bda28ca9': 'linux', // * uob-web-tier us-east-1 (old image created with ami builder)
    'ami-0316af9949fb52ebf': 'windows', // * windows-server-2019 us-east-2
    'ami-0e38fa17744b2f6a5': 'windows', // * windows-server-2022 us-east-1 (outdated)
    'ami-0fc682b2a42e57ca2': 'windows', // * windows-server-2022 us-east-1
    'ami-00d990e7e5ece7974': 'windows', //  * windows-server-2022 us-east-1 (latest)
    'ami-05d8140b845a8aa7b': 'windows', // * windows-server-2022 us-east-2
    'ami-0a63ab585cc2143b2': 'windows', // * windows-server-2022 us-west-2
    'ami-014a4aba6e4f1c65e': 'windows', // * jenkins-build-server us-east-1
    'ami-0bb749394afc99142': 'windows', // * dev-windows-image us-east-1
    'ami-0d2f97c8735a48a15': 'windows', // * windows 2022 us-east-2
    'ami-0e6aa5f69f06ffa91': 'windows', // *windows 2022 us-east-2 v4 2024_02_14
    'ami-0f9c44e98edf38a2b': 'windows', // * Latest windows us-east-1
    'ami-0258aac7f0f62500f': 'windows', // * Latest windows us-west-2 03/17/24
    'ami-0e8f3a453b7c788f4': 'linux', // palo-alto us-east-1
    'ami-0bd9eae1cb45aa9c0': 'linux', // palo-alto us-east-2
    'ami-0962b0528f9ae2d13': 'linux', // palo-alto us-west-2
    'ami-0fa1cb9e4c6a5257e': 'linux', // palo-alto byol us-east-1
    'ami-090ca54cbbe76a832': 'linux', // palo-alto byol us-east-2
    'ami-0a1b9ca832941f4d8': 'linux', // palo-alto byol us-west-2
    'ami-05bb086122bcbee93': 'windows', // jenkins windows us-east-2
    'ami-0fe2568764b9189f2': 'linux', // eb-web-golden-image us-east-2
    'ami-05efd13c96fca3530': 'windows', // eb-wind-golden-image us-east-2
    'ami-07c5911c97c1462ea': 'linux', // eb-util-golden-image us-east-2
    'ami-0bbed3a8479e58bdc': 'linux', // eb-app-golden-image us-east-2
    'ami-060b1c20c93e475fd': 'windows', // us-east-2 windows server 2022 (09/27/2023)
    'ami-0c01329c867902690': 'linux', // eb app 01 restore
    'ami-0d118f64052cc6ebb': 'linux', // eb app 02 restore
    'ami-0fcfae0db47cc1c92': 'linux', // eb util 01 restore
    'ami-0c79c07c005c80bfe': 'linux', // eb web 01 restore
    'ami-0d3fc909576664479': 'linux', // eb web 02 restore
    'ami-02178535e3303a6e2': 'windows', // eb windows 01 restore
    'ami-02982c184d20daa4a': 'linux', // network-sensor us-east-2
    'ami-01d2fea6614abe737': 'linux', // network-sensor us-west-2
    'ami-00c86b7c4413a60e1': 'linux', // cis-base-image RHEL 8.9 us-east-1
    'ami-06717ddf056235802': 'linux', // cis-base-image RHEL 8.9 us-east-2
    'ami-028e26ef0023f0ecc': 'linux', // cis-base-image RHEL 8.9 us-west-2
    'ami-0158cc8e6f1636865': 'linux', // palo-alto-panorama us-east-2
    'ami-073b188091136420d': 'linux', // palo-alto-panorama us-west-2
    'ami-025729b063c7d3f02': 'linux', // fortimanager us-east-2
    'ami-0fd4b8cbee99b33d1': 'linux', // fortimanager us-west-2

    /**
     * AMIs created from EB CIT instances on 12/12/23
     */
    'ami-0daa3e5a09c04d321': 'linux', // eb app 01 golden image
    'ami-04c2ea9c7d118ce59': 'linux', // eb app 02 golden image
    'ami-0ff0f6e20441cae90': 'linux', // eb app 03 golden image
    'ami-066f1f886941d8f93': 'linux', // eb mq 01 golden image
    'ami-0011183fb7be18962': 'linux', // eb mq 02 golden image
    'ami-0a88b84653265e112': 'linux', // eb util 01 golden image
    'ami-07bf44a0e7ec7a2b7': 'linux', // eb util 02 golden image
    'ami-0c1e3a5628ee8be95': 'linux', // eb web 01 golden image
    'ami-013de77cec0065da7': 'linux', // eb web 02 golden image
    'ami-019d1055dc1f12e62': 'windows', // eb wind 01 golden image

    /**
     * UQ01 4/28 Recovered
     */
    'ami-0f2b7946a3f3f9b8f': 'linux',
    'ami-04687fe9e0d5fbcb3': 'linux',
    'ami-05fd00f74649c498c': 'linux',
    'ami-0c2b85a5b12b60add': 'linux',
    'ami-0d92989f259ffbd41': 'linux',
    'ami-0a61c5fc17b018081': 'linux',
    'ami-06a6aa369e2ff8707': 'linux',
    'ami-0850ddb852fe0d4fe': 'linux',
    'ami-00a69b4dea1dc683d': 'linux',
    'ami-06f07d9a2abb4caf4': 'linux',

    /**
     * MuobP2 RPT 02 Recovery
     */
    'ami-0715e4654da7bd0e7': 'linux',
    'ami-0e4db53c6fc81d3a5': 'linux',
  };
}
