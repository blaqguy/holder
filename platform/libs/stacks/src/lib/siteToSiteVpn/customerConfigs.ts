interface BaseCustomerConfig {
  fiName: string;
  description: string;
  clientIp: string;
  bgpAsn?: string;
  startupAction?: string;
  tunnel1Phase1DhGroupNumbersOverride?: number[];
  tunnel1Phase2DhGroupNumbersOverride?: number[];
  tunnel1Phase1EncryptionAlgorithmsOverride?: string[];
  tunnel1Phase2EncryptionAlgorithmsOverride?: string[];
  tunnel1Phase1IntegrityAlgorithmsOverride?: string[];
  tunnel1Phase2IntegrityAlgorithmsOverride?: string[];
  disableS2SVpnAttachmentPropagation?: boolean; // Primarily added for EWB transition from ACI hosted to DFT hosted Fortinet appliance
  oldIndex?: number;
}

interface StaticCustomerConfig extends BaseCustomerConfig {
  staticConnection: true;
  customerNatBlock?: string[];
  primaryVpnConnection: boolean; // Required when staticConnection is true
}

interface DynamicCustomerConfig extends BaseCustomerConfig {
  staticConnection: false;
  primaryVpnConnection?: boolean; // Optional when staticConnection is false
}

interface PrivatelyUsedPublicIp {
  enabled: boolean;
  /** Pass this in if the customer is initiating connection to PUPI block from ips outside 10.252/14 range */
  ingressOnlyEndpoints?: string[];
}

export interface OutboundEndpointNatMapping {
  outboundEndpoint: string;
  assignedNat: string;
}
export interface CustomerConfigs {
  [key: string]: {
    privatelyUsedPublicIp: PrivatelyUsedPublicIp;
    outboundEndpointNatMapping: OutboundEndpointNatMapping[];
    vpnConfigs: Array<DynamicCustomerConfig | StaticCustomerConfig>;
  };
}

/**
 * Class defining the upf db configurations
 */
export abstract class DfCustomerConfigs {
  public static primaryProdConfiguration: CustomerConfigs = {
    cts: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'mulesoft-primary.cts.prod.dragonflyft.com',
          assignedNat: '10.255.15.2',
        },
        {
          outboundEndpoint: 'mulesoft-secondary.cts.prod.dragonflyft.com',
          assignedNat: '10.254.15.2',
        },
        {
          outboundEndpoint: 'mulesoft-primary.cts.uat.dragonflyft.com',
          assignedNat: '10.255.15.34',
        },
        {
          outboundEndpoint: 'mulesoft-secondary.cts.uat.dragonflyft.com',
          assignedNat: '10.254.15.34',
        },
        {
          outboundEndpoint: 'mulesoft-primary.cts.ist.dragonflyft.com',
          assignedNat: '10.255.15.35',
        },
        {
          outboundEndpoint: 'edeposit-primary.cts.prod.dragonflyft.com',
          assignedNat: '10.255.15.3',
        },
        {
          outboundEndpoint: 'edeposit-secondary.cts.prod.dragonflyft.com',
          assignedNat: '10.254.15.3',
        },
        {
          outboundEndpoint: 'edeposit-primary.cts.uat.dragonflyft.com',
          assignedNat: '10.255.15.36',
        },
        {
          outboundEndpoint: 'edeposit-secondary.cts.uat.dragonflyft.com',
          assignedNat: '10.254.15.36',
        },
      ],
      /**
       * We can route traffic from our network to the customer's NAT block on both their vpn attachments. Since this customer is using bgp
       * They have to advertise a shorter BGP AS_PATH
       */
      vpnConfigs: [
        {
          fiName: 'CTS-JEFFERSON-CITY',
          description: 'CTS JEFFERSON CITY CONNECTION',
          staticConnection: false,
          clientIp: '199.255.161.10',
          bgpAsn: '55056',
        },
        {
          fiName: 'CTS-SPRINGFIELD',
          description: 'CTS SPRINGFIELD CONNECTION',
          staticConnection: false,
          clientIp: '199.255.163.10',
          bgpAsn: '55056',
        },
      ],
    },
    '1sb': {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'communicator-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.187',
        },
        {
          outboundEndpoint: 'communicator-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.187',
        },
        {
          outboundEndpoint: 'fiapi-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.190',
        },
        {
          outboundEndpoint: 'fiapi-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.190',
        },
        {
          outboundEndpoint: 'communicator-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.187',
        },
        {
          outboundEndpoint: 'communicator-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.187',
        },
        {
          outboundEndpoint: 'opencheck-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.188',
        },
        {
          outboundEndpoint: 'opencheck-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.188',
        },
        {
          outboundEndpoint: 'opencheck-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.188',
        },
        {
          outboundEndpoint: 'opencheck-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.188',
        },
        {
          outboundEndpoint: 'pospay-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.189',
        },
        {
          outboundEndpoint: 'pospay-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.189',
        },
        {
          outboundEndpoint: 'pospay-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.189',
        },
        {
          outboundEndpoint: 'pospay-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.189',
        },
        {
          outboundEndpoint: 'fiapi-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.190',
        },
        {
          outboundEndpoint: 'fiapi-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.190',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.1sb.prod.dragonflyft.com',
          assignedNat: '10.252.10.5',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.1sb.uat.dragonflyft.com',
          assignedNat: '10.252.10.39',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.1sb.dr.dragonflyft.com',
          assignedNat: '10.254.10.5',
        },
      ],
      vpnConfigs: [
        {
          fiName: '1ST-SOURCE-BANK-KALAMAZOO',
          description: '1ST SOURCE BANK KALAMAZOO CONNECTION',
          staticConnection: true,
          clientIp: '12.239.143.132',
          primaryVpnConnection: true,
          customerNatBlock: [
            '10.252.10.0/27', // Prod
            '10.252.12.32/27', // Uat
          ],
        },
        {
          fiName: '1ST-SOURCE-BANK-SOUTHBEND',
          description: '1ST SOURCE BANK SOUTHBEND CONNECTION',
          staticConnection: true,
          clientIp: '12.197.121.132',
          primaryVpnConnection: false,
          customerNatBlock: [
            '10.252.10.0/27', // Prod
            '10.252.12.32/27', // Uat
          ],
        },
      ],
    },
    fhlbatl: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'FHLBA-RICHMOND',
          description:
            'FEDERAL HOME LOAN BANK OF ATLANTA RICHMOND CONNECTION 1', // QTSA
          staticConnection: false,
          clientIp: '209.11.0.22',
          bgpAsn: '65053',
        },
        {
          fiName: 'FHLBA-ATLANTA',
          description: 'FEDERAL HOME LOAN BANK OF ATLANTA CONNECTION 2', // QTSR
          staticConnection: false,
          clientIp: '209.10.152.22',
          bgpAsn: '65153',
        },
      ],
    },
    ewb: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'hkinterface-primary.ewb.prod.dragonflyft.com',
          assignedNat: '10.252.20.8',
        },
        {
          outboundEndpoint: 'hkinterface-secondary.ewb.prod.dragonflyft.com',
          assignedNat: '10.254.20.8',
        },
        {
          outboundEndpoint: 'hkinterface-primary.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint: 'hkinterface-secondary.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint: 'visionarchive-primary.ewb.prod.dragonflyft.com',
          assignedNat: '10.252.20.6',
        },
        {
          outboundEndpoint: 'visionarchive-secondary.ewb.prod.dragonflyft.com',
          assignedNat: '10.254.20.6',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-uat1.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-uat1.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-uat2.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-uat2.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-uat3.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-uat3.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-ist1.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-ist1.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.prod.dragonflyft.com',
          assignedNat: '10.252.20.7',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.prod.dragonflyft.com',
          assignedNat: '10.254.20.7',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.uat1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.uat1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.uat2.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.uat2.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.uat3.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.uat3.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.ist1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.ist1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'EWB-LAS-VEGAS',
          description: 'EWB LAS VEGAS CONNECTION',
          staticConnection: false,
          clientIp: '136.179.39.21',
          bgpAsn: '65510',
          disableS2SVpnAttachmentPropagation: true,
        },
        {
          fiName: 'EWB-PHOENIX',
          description: 'EWB PHOENIX CONNECTION',
          staticConnection: false,
          clientIp: '63.157.54.194',
          bgpAsn: '65510',
          disableS2SVpnAttachmentPropagation: true,
        },
        {
          fiName: 'EWB-VEGAS-1',
          description: 'East West Bank Vegas 1',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '136.179.39.76',
        },
        {
          fiName: 'EWB-VEGAS-2',
          description: 'East West Bank Vegas 2',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '136.179.39.77',
          disableS2SVpnAttachmentPropagation: true,
        },
        {
          fiName: 'EWB-PHOENIX-1',
          description: 'East West Bank Phoenix 1',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '63.157.54.76',
        },
        {
          fiName: 'EWB-PHOENIX-2',
          description: 'East West Bank Phoenix 2',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '63.157.54.77',
          disableS2SVpnAttachmentPropagation: true,
        },
      ],
    },
    mizuho: {
      privatelyUsedPublicIp: {
        enabled: true,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'moveit-sftp.dest.mizuho.prod.dragonflyft.com',
          assignedNat: '192.129.91.9',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.mizuho.uat.dragonflyft.com',
          assignedNat: '192.129.91.135',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.mizuho.dr.dragonflyft.com',
          assignedNat: '192.129.91.134',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'MIZUHO-CLIFTON',
          description: 'MIZUHO CLIFTON CONNECTION',
          staticConnection: false,
          startupAction: 'start',
          clientIp: '208.85.105.76',
          bgpAsn: '20129',
        },
        {
          fiName: 'MIZUHO-Trumbull-MPLS',
          description: 'MIZUHO Trumbull MPLS CONNECTION',
          staticConnection: false,
          clientIp: '167.94.36.26',
          bgpAsn: '65045',
        },
      ],
    },
    dollar: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'ddamq-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.2',
        },
        {
          outboundEndpoint: 'ddamq-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.2',
        },
        {
          outboundEndpoint: 'ddamq-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.34',
        },
        {
          outboundEndpoint: 'ddamq-secondary.dollar.uat.dragonflyft.com',
          assignedNat: '10.254.16.34',
        },
        {
          outboundEndpoint: 'ddamq-primary.dollar.ist.dragonflyft.com',
          assignedNat: '10.252.16.35',
        },
        {
          outboundEndpoint: 'ddamq-secondary.dollar.ist.dragonflyft.com',
          assignedNat: '10.254.16.35',
        },
        {
          outboundEndpoint: 'sso-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.3',
        },
        {
          outboundEndpoint: 'sso-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.36',
        },
        {
          outboundEndpoint: 'sso-primary.dollar.ist.dragonflyft.com',
          assignedNat: '10.252.16.37',
        },
        {
          outboundEndpoint: 'sso-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.3',
        },
        {
          outboundEndpoint: 'mrdc-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.4',
        },
        {
          outboundEndpoint: 'mrdc-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.38',
        },
        {
          outboundEndpoint: 'mrdc-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.4',
        },
        {
          outboundEndpoint: 'token-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.3',
        },
        {
          outboundEndpoint: 'token-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.36',
        },
        {
          outboundEndpoint: 'token-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.5',
        },
        {
          outboundEndpoint: 'image-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.6',
        },
        {
          outboundEndpoint: 'image-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.40',
        },
        {
          outboundEndpoint: 'image-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.6',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'DOLLAR-PITTSBURGH-PRIMARY',
          description: 'DOLLAR BANK PITTSBURGH PRIMARY CONNECTION',
          staticConnection: false,
          clientIp: '64.241.120.80',
          bgpAsn: '65095',
        },
        {
          fiName: 'DOLLAR-PITTSBURGH-SECONDARY',
          description: 'DOLLAR BANK PITTSBURGH SECONDARY CONNECTION',
          staticConnection: false,
          clientIp: '64.241.121.80',
          bgpAsn: '65096',
        },
      ],
    },
    cbky: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'comm-primary.cbky.prod.dragonflyft.com',
          assignedNat: '10.254.14.2',
        },
        {
          outboundEndpoint: 'comm-primary.cbky.uat.dragonflyft.com',
          assignedNat: '10.254.14.34',
        },
        {
          outboundEndpoint: 'comm-secondary.cbky.ist.dragonflyft.com',
          assignedNat: '10.254.14.35',
        },
        {
          outboundEndpoint: 'image-primary.cbky.prod.dragonflyft.com',
          assignedNat: '10.254.14.3',
        },
        {
          outboundEndpoint: 'image-primary.cbky.uat.dragonflyft.com',
          assignedNat: '10.254.14.36',
        },
        {
          outboundEndpoint: 'image-primary.cbky.ist.dragonflyft.com',
          assignedNat: '10.254.14.37',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'CBKY-LEXINGTON-PRIMARY',
          description: 'Primary site-to-site VPN',
          staticConnection: false,
          clientIp: '216.84.108.2',
          bgpAsn: '64516',
        },
        {
          fiName: 'CBKY-LEXINGTON-SECONDARY',
          description: 'Secondary site-to-site VPN for CBKY',
          staticConnection: false,
          clientIp: '97.65.168.195',
          bgpAsn: '64516',
        },
        {
          fiName: 'CBKY-Lexington-MPLS',
          description: 'MPLS site-to-site VPN for CBKY',
          staticConnection: false,
          clientIp: '167.94.36.34',
          bgpAsn: '65045',
        },
      ],
    },
    fis: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'cohesion1.dragonflyft.com',
          assignedNat: '156.55.118.117',
        },
        {
          outboundEndpoint: 'visionarchive3.dragonflyft.com',
          assignedNat: '156.55.116.13',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'FIS-ASHBURN',
          description: 'FIS EQUINIX DC6 – ASHBURN',
          staticConnection: false,
          clientIp: '156.55.171.2',
          bgpAsn: '32944',
        },
        {
          fiName: 'FIS-CHICAGO',
          description: 'FIS EQUINIX CHI – CHICAGO',
          staticConnection: false,
          clientIp: '156.55.218.1',
          bgpAsn: '32944',
        },
      ],
    },
    santander: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'SANTANDER-VIRGINIA-1',
          description: 'SANTANDER VIRGINIA-1 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.137.23',
          oldIndex: 2,
        },
        {
          fiName: 'SANTANDER-VIRGINIA-2',
          description: 'SANTANDER VIRGINIA-2 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.137.24',
          oldIndex: 3,
        },
        {
          fiName: 'SANTANDER-TEXAS-1',
          description: 'SANTANDER TEXAS-1 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.141.23',
          oldIndex: 4,
        },
        {
          fiName: 'SANTANDER-TEXAS-2',
          description: 'SANTANDER TEXAS-2 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.141.24',
          oldIndex: 5,
        },
      ],
    },
    finastra: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'FINASTRA-PRIMARY',
          description: 'FINASTRA PRIMARY SITE CONNECTION',
          staticConnection: true,
          clientIp: '13.82.58.64',
          customerNatBlock: [
            '10.252.11.0/27', // Prod
            '10.252.11.32/27', // Uat
          ],
          primaryVpnConnection: true,
        },
        {
          fiName: 'FINASTRA-SECONDARY',
          description: 'FINASTRA SECONDARY SITE CONNECTION',
          staticConnection: true,
          clientIp: '13.64.193.238',
          customerNatBlock: [
            '10.252.11.0/27', // Prod
            '10.252.11.32/27', // Uat
          ],
          primaryVpnConnection: false,
        },
      ],
    },
    nordea: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'NORDEA-NEW-YORK',
          description: 'NORDEA NEW YORK CONNECTION',
          staticConnection: true,
          clientIp: '208.204.107.212',
          customerNatBlock: [
            '10.253.16.0/27', // Prod
            '10.253.16.32/27', // Uat
          ],
          primaryVpnConnection: true,
        },
      ],
    },
    bbh: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'mq-primary.bbh.test.dragonflyft.com',
          assignedNat: '192.200.8.215',
        },
        {
          outboundEndpoint: 'mq-secondary.bbh.test.dragonflyft.com',
          assignedNat: '192.200.8.215',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'BBH-PISCATAWAY',
          description: 'BROWN BROTHERS HARRIMAN PISCATAWAY CONNECTION',
          staticConnection: true,
          clientIp: '192.200.6.35',
          customerNatBlock: [
            '10.253.12.0/27', // Prod
            '10.253.12.32/27', // Uat
          ],
          startupAction: 'start',
          primaryVpnConnection: true,
        },
        {
          fiName: 'BBH-SECAUCUS',
          description: 'BROWN BROTHERS HARRIMAN SECAUCUS CONNECTION',
          staticConnection: true,
          clientIp: '192.200.1.35',
          customerNatBlock: [
            '10.253.12.0/27', // Prod
            '10.253.12.32/27', // Uat
          ],
          startupAction: 'start',
          primaryVpnConnection: false,
        },
        {
          fiName: 'BBH-SECAUCUS-TEST-SITE',
          description: 'BROWN BROTHERS HARRIMAN SECAUCUS TEST SITE CONNECTION',
          staticConnection: true,
          clientIp: '192.200.1.30',
          customerNatBlock: [
            '10.253.12.0/27', // Prod
            '10.253.12.32/27', // Uat
          ],
          startupAction: 'start',
          primaryVpnConnection: false,
        },
      ],
    },
    svb: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'moveit-sftp.dest.svb.prod.dragonflyft.com',
          assignedNat: '10.253.10.2',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.svb.uat.dragonflyft.com',
          assignedNat: '10.253.10.34',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.svb.dr.dragonflyft.com',
          assignedNat: '10.255.10.2',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'SVB-Primary',
          description: 'SILICON VALLEY BANK US PRIMARY',
          staticConnection: false,
          clientIp: '198.212.183.6',
          bgpAsn: '64531',
        },
        {
          fiName: 'SVB-Secondary',
          description: 'SILICON VALLEY BANK US SECONDARY',
          staticConnection: false,
          clientIp: '198.245.241.6',
          bgpAsn: '64513',
        },
      ],
    },
    cadence: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'Cadence-Primary',
          description: 'Cadence Bank',
          staticConnection: true,
          clientIp: '74.120.89.251',
          customerNatBlock: [
            '10.252.13.0/24', // Prod
            '10.254.13.0/24', // Secondary
          ],
          primaryVpnConnection: true,
        },
      ],
    },
    socgen: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'Societ-General-Primary',
          description: 'SocGen',
          staticConnection: true,
          clientIp: '162.246.240.100',
          customerNatBlock: [
            '10.253.11.0/27', // Prod
            '10.253.11.32/27', // Secondary
          ],
          primaryVpnConnection: true,
        },
        {
          fiName: 'Societ-General-Primary-Secondary',
          description: 'SocGen',
          staticConnection: true,
          clientIp: '162.246.241.100',
          customerNatBlock: [
            '10.253.11.0/27', // Prod
            '10.253.11.32/27', // Secondary
          ],
          primaryVpnConnection: false,
        },
      ],
    },
    fnbo: {
      privatelyUsedPublicIp: {
        enabled: true,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'mtsmq-primary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-secondary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-primary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-secondary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-primary.fnbo.ist.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-primary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-secondary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-primary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-secondary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-primary.fnbo.ist.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-primary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-secondary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-primary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-secondary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-primary.fnbo.ist.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'FIRST-NATIONAL-BANK-OF-OMAHA',
          description: 'Primary connection for First National Bank of Omaha',
          staticConnection: true,
          clientIp: '216.205.194.5',
          primaryVpnConnection: true,
          tunnel1Phase1DhGroupNumbersOverride: [20],
          tunnel1Phase2DhGroupNumbersOverride: [20],
          tunnel1Phase1EncryptionAlgorithmsOverride: ['AES256'],
          tunnel1Phase2EncryptionAlgorithmsOverride: ['AES256'],
          tunnel1Phase1IntegrityAlgorithmsOverride: ['SHA2-512'],
          tunnel1Phase2IntegrityAlgorithmsOverride: ['SHA2-256'],
          startupAction: 'start',
        },
        {
          fiName: 'FIRST-NATIONAL-BANK-OF-OMAHA-Secondary',
          description: 'Seconary connection for First National Bank of Omaha',
          staticConnection: true,
          clientIp: '216.205.197.148',
          primaryVpnConnection: false,
        },
      ],
    },
    ewbfinastra: {
      privatelyUsedPublicIp: {
        enabled: true,
        ingressOnlyEndpoints: [
          '216.131.11.198',
          '216.131.3.213',
          '216.131.3.73',
        ],
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'EWB-FINASTRA',
          description: 'Primary connection for EWB-FINASTRA',
          staticConnection: true,
          clientIp: '216.131.4.38',
          customerNatBlock: [
            '10.253.18.0/27', // Prod
            '10.253.18.32/27', // UAT
          ],
          primaryVpnConnection: true,
        },
        {
          fiName: 'EWB-FINASTRA-SALTLAKE-CITY',
          description: 'Secondary connection for EWB-FINASTRA',
          staticConnection: true,
          clientIp: '216.131.12.38',
          customerNatBlock: [
            '10.253.18.0/27', // Prod
            '10.253.18.32/27', // UAT
          ],
          primaryVpnConnection: false,
        },
      ],
    },
  };

  public static recoveryProdConfiguration: CustomerConfigs = {
    cts: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'mulesoft-primary.cts.prod.dragonflyft.com',
          assignedNat: '10.255.15.2',
        },
        {
          outboundEndpoint: 'mulesoft-secondary.cts.prod.dragonflyft.com',
          assignedNat: '10.254.15.2',
        },
        {
          outboundEndpoint: 'mulesoft-primary.cts.uat.dragonflyft.com',
          assignedNat: '10.255.15.34',
        },
        {
          outboundEndpoint: 'mulesoft-secondary.cts.uat.dragonflyft.com',
          assignedNat: '10.254.15.34',
        },
        {
          outboundEndpoint: 'mulesoft-primary.cts.ist.dragonflyft.com',
          assignedNat: '10.255.15.35',
        },
        {
          outboundEndpoint: 'edeposit-primary.cts.prod.dragonflyft.com',
          assignedNat: '10.255.15.3',
        },
        {
          outboundEndpoint: 'edeposit-secondary.cts.prod.dragonflyft.com',
          assignedNat: '10.254.15.3',
        },
        {
          outboundEndpoint: 'edeposit-primary.cts.uat.dragonflyft.com',
          assignedNat: '10.255.15.36',
        },
        {
          outboundEndpoint: 'edeposit-secondary.cts.uat.dragonflyft.com',
          assignedNat: '10.254.15.36',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'CTS-JEFFERSON-CITY',
          description: 'CTS JEFFERSON CITY CONNECTION',
          staticConnection: false,
          clientIp: '199.255.161.10',
          bgpAsn: '55056',
        },
        {
          fiName: 'CTS-SPRINGFIELD',
          description: 'CTS SPRINGFIELD CONNECTION',
          staticConnection: false,
          clientIp: '199.255.163.10',
          bgpAsn: '55056',
        },
      ],
    },
    '1sb': {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'communicator-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.187',
        },
        {
          outboundEndpoint: 'communicator-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.187',
        },
        {
          outboundEndpoint: 'fiapi-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.190',
        },
        {
          outboundEndpoint: 'fiapi-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.190',
        },
        {
          outboundEndpoint: 'communicator-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.187',
        },
        {
          outboundEndpoint: 'communicator-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.187',
        },
        {
          outboundEndpoint: 'opencheck-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.188',
        },
        {
          outboundEndpoint: 'opencheck-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.188',
        },
        {
          outboundEndpoint: 'opencheck-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.188',
        },
        {
          outboundEndpoint: 'opencheck-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.188',
        },
        {
          outboundEndpoint: 'pospay-primary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.189',
        },
        {
          outboundEndpoint: 'pospay-secondary.1sb.prod.dragonflyft.com',
          assignedNat: '12.197.121.189',
        },
        {
          outboundEndpoint: 'pospay-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.189',
        },
        {
          outboundEndpoint: 'pospay-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.189',
        },
        {
          outboundEndpoint: 'fiapi-primary.1sb.uat.dragonflyft.com',
          assignedNat: '12.239.143.190',
        },
        {
          outboundEndpoint: 'fiapi-primary.1sb.ist.dragonflyft.com',
          assignedNat: '12.239.143.190',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.1sb.prod.dragonflyft.com',
          assignedNat: '10.252.10.5',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.1sb.uat.dragonflyft.com',
          assignedNat: '10.252.10.39',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.1sb.dr.dragonflyft.com',
          assignedNat: '10.254.10.5',
        },
      ],
      vpnConfigs: [
        {
          fiName: '1ST-SOURCE-BANK-KALAMAZOO',
          description: '1ST SOURCE BANK KALAMAZOO CONNECTION',
          staticConnection: true,
          clientIp: '12.239.143.132',
          primaryVpnConnection: true,
          customerNatBlock: [
            '10.254.10.0/27', // Prod
            '10.254.10.32/27', // Uat
          ],
        },
        {
          fiName: '1ST-SOURCE-BANK-SOUTHBEND',
          description: '1ST SOURCE BANK SOUTHBEND CONNECTION',
          staticConnection: true,
          clientIp: '12.197.121.132',
          primaryVpnConnection: false,
          customerNatBlock: [
            '10.252.10.0/27', // Prod
            '10.252.12.32/27', // Uat
          ],
        },
      ],
    },
    fhlbatl: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'FHLBA-RICHMOND',
          description:
            'FEDERAL HOME LOAN BANK OF ATLANTA RICHMOND CONNECTION 1', // QTSA
          staticConnection: false,

          clientIp: '209.11.0.22',
          bgpAsn: '65053',
        },
        {
          fiName: 'FHLBA-ATLANTA',
          description: 'FEDERAL HOME LOAN BANK OF ATLANTA CONNECTION 2', // QTSR
          staticConnection: false,
          clientIp: '209.10.152.22',
          bgpAsn: '65153',
        },
      ],
    },
    ewb: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'hkinterface-primary.ewb.prod.dragonflyft.com',
          assignedNat: '10.252.20.8',
        },
        {
          outboundEndpoint: 'hkinterface-secondary.ewb.prod.dragonflyft.com',
          assignedNat: '10.254.20.8',
        },
        {
          outboundEndpoint: 'hkinterface-primary.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint: 'hkinterface-secondary.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint: 'visionarchive-primary.ewb.prod.dragonflyft.com',
          assignedNat: '10.252.20.6',
        },
        {
          outboundEndpoint: 'visionarchive-secondary.ewb.prod.dragonflyft.com',
          assignedNat: '10.254.20.6',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-uat1.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-uat1.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-uat2.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-uat2.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-uat3.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-uat3.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-primary-ist1.ewb.uat.dragonflyft.com',
          assignedNat: '10.252.20.40',
        },
        {
          outboundEndpoint:
            'visionarchive-seconary-ist1.ewb.uat.dragonflyft.com',
          assignedNat: '10.254.20.40',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.prod.dragonflyft.com',
          assignedNat: '10.252.20.7',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.prod.dragonflyft.com',
          assignedNat: '10.254.20.7',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.uat1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.uat1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.uat2.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.uat2.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.uat3.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.uat3.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-primary.ewb.ist1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
        {
          outboundEndpoint: 'connectware-secondary.ewb.ist1.dragonflyft.com',
          assignedNat: '10.252.20.39',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'EWB-LAS-VEGAS',
          description: 'EWB LAS VEGAS CONNECTION',
          staticConnection: false,
          clientIp: '136.179.39.21',
          bgpAsn: '65510',
          disableS2SVpnAttachmentPropagation: true,
        },
        {
          fiName: 'EWB-PHOENIX',
          description: 'EWB PHOENIX CONNECTION',
          staticConnection: false,
          clientIp: '63.157.54.194',
          bgpAsn: '65510',
          disableS2SVpnAttachmentPropagation: true,
        },
        {
          fiName: 'EWB-VEGAS-1',
          description: 'East West Bank Vegas 1',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '136.179.39.76',
        },
        {
          fiName: 'EWB-VEGAS-2',
          description: 'East West Bank Vegas 2',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '136.179.39.77',
          disableS2SVpnAttachmentPropagation: true,
        },
        {
          fiName: 'EWB-PHOENIX-1',
          description: 'East West Bank Phoenix 1',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '63.157.54.76',
        },
        {
          fiName: 'EWB-PHOENIX-2',
          description: 'East West Bank Phoenix 2',
          staticConnection: false,
          bgpAsn: '65018',
          clientIp: '63.157.54.77',
          disableS2SVpnAttachmentPropagation: true,
        },
      ],
    },
    mizuho: {
      privatelyUsedPublicIp: {
        enabled: true,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'moveit-sftp.dest.mizuho.prod.dragonflyft.com',
          assignedNat: '192.129.91.9',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.mizuho.uat.dragonflyft.com',
          assignedNat: '192.129.91.135',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.mizuho.dr.dragonflyft.com',
          assignedNat: '192.129.91.134',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'MIZUHO-CLIFTON',
          description: 'MIZUHO CLIFTON CONNECTION',
          startupAction: 'start',
          staticConnection: false,
          clientIp: '208.85.105.76',
          bgpAsn: '20129',
        },
        {
          fiName: 'MIZUHO-Trumbull-MPLS',
          description: 'MIZUHO Trumbull MPLS CONNECTION',
          staticConnection: false,
          clientIp: '167.94.36.26',
          bgpAsn: '65045',
        },
      ],
    },
    dollar: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'ddamq-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.2',
        },
        {
          outboundEndpoint: 'ddamq-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.2',
        },
        {
          outboundEndpoint: 'ddamq-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.34',
        },
        {
          outboundEndpoint: 'ddamq-secondary.dollar.uat.dragonflyft.com',
          assignedNat: '10.254.16.34',
        },
        {
          outboundEndpoint: 'ddamq-primary.dollar.ist.dragonflyft.com',
          assignedNat: '10.252.16.35',
        },
        {
          outboundEndpoint: 'ddamq-secondary.dollar.ist.dragonflyft.com',
          assignedNat: '10.254.16.35',
        },
        {
          outboundEndpoint: 'sso-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.3',
        },
        {
          outboundEndpoint: 'sso-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.36',
        },
        {
          outboundEndpoint: 'sso-primary.dollar.ist.dragonflyft.com',
          assignedNat: '10.252.16.37',
        },
        {
          outboundEndpoint: 'sso-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.3',
        },
        {
          outboundEndpoint: 'mrdc-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.4',
        },
        {
          outboundEndpoint: 'mrdc-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.38',
        },
        {
          outboundEndpoint: 'mrdc-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.4',
        },
        {
          outboundEndpoint: 'token-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.3',
        },
        {
          outboundEndpoint: 'token-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.36',
        },
        {
          outboundEndpoint: 'token-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.5',
        },
        {
          outboundEndpoint: 'image-primary.dollar.prod.dragonflyft.com',
          assignedNat: '10.252.16.6',
        },
        {
          outboundEndpoint: 'image-primary.dollar.uat.dragonflyft.com',
          assignedNat: '10.252.16.40',
        },
        {
          outboundEndpoint: 'image-secondary.dollar.prod.dragonflyft.com',
          assignedNat: '10.254.16.6',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'DOLLAR-PITTSBURGH-PRIMARY',
          description: 'DOLLAR BANK PITTSBURGH PRIMARY CONNECTION',
          staticConnection: false,
          clientIp: '64.241.120.80',
          bgpAsn: '65095',
        },
        {
          fiName: 'DOLLAR-PITTSBURGH-SECONDARY',
          description: 'DOLLAR BANK PITTSBURGH SECONDARY CONNECTION',
          staticConnection: false,
          clientIp: '64.241.121.80',
          bgpAsn: '65096',
        },
      ],
    },
    cbky: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'comm-primary.cbky.prod.dragonflyft.com',
          assignedNat: '10.254.14.2',
        },
        {
          outboundEndpoint: 'comm-primary.cbky.uat.dragonflyft.com',
          assignedNat: '10.254.14.34',
        },
        {
          outboundEndpoint: 'comm-secondary.cbky.ist.dragonflyft.com',
          assignedNat: '10.254.14.35',
        },
        {
          outboundEndpoint: 'image-primary.cbky.prod.dragonflyft.com',
          assignedNat: '10.254.14.3',
        },
        {
          outboundEndpoint: 'image-primary.cbky.uat.dragonflyft.com',
          assignedNat: '10.254.14.36',
        },
        {
          outboundEndpoint: 'image-primary.cbky.ist.dragonflyft.com',
          assignedNat: '10.254.14.37',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'CBKY-Lexington-Primary',
          description: 'Primary site-to-site VPN',
          staticConnection: false,
          clientIp: '216.84.108.2',
          bgpAsn: '64516',
        },
        {
          fiName: 'CBKY-Lexington-Secondary',
          description: 'Secondary site-to-site VPN for CBKY',
          staticConnection: false,
          clientIp: '97.65.168.195',
          bgpAsn: '64516',
        },
        {
          fiName: 'CBKY-Lexington-MPLS',
          description: 'MPLS site-to-site VPN for CBKY',
          staticConnection: false,
          clientIp: '167.94.36.34',
          bgpAsn: '65045',
        },
      ],
    },
    fis: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'cohesion1.dragonflyft.com',
          assignedNat: '156.55.118.117',
        },
        {
          outboundEndpoint: 'visionarchive3.dragonflyft.com',
          assignedNat: '156.55.116.13',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'FIS-ASHBURN',
          description: 'FIS EQUINIX DC6 – ASHBURN',
          staticConnection: false,
          clientIp: '156.55.171.2',
          bgpAsn: '32944',
        },
        {
          fiName: 'FIS-CHICAGO',
          description: 'FIS EQUINIX CHI – CHICAGO',
          staticConnection: false,
          clientIp: '156.55.218.1',
          bgpAsn: '32944',
        },
      ],
    },
    santander: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'SANTANDER-VIRGINIA-1',
          description: 'SANTANDER Virginia-1 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.137.23',
          oldIndex: 2,
        },
        {
          fiName: 'SANTANDER-VIRGINIA-2',
          description: 'SANTANDER Virginia-2 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.137.24',
          oldIndex: 3,
        },
        {
          fiName: 'SANTANDER-TEXAS-1',
          description: 'SANTANDER TEXAS-1 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.141.23',
          oldIndex: 4,
        },
        {
          fiName: 'SANTANDER-TEXAS-2',
          description: 'SANTANDER TEXAS-2 CONNECTION',
          staticConnection: false,
          bgpAsn: '65028',
          clientIp: '193.127.134.204',
          oldIndex: 5,
        },
      ],
    },
    finastra: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'FINASTRA-PRIMARY',
          description: 'FINASTRA PRIMARY SITE CONNECTION',
          staticConnection: true,
          clientIp: '13.82.58.64',
          customerNatBlock: [
            '10.254.11.0/27', // Prod
            '10.254.11.32/27', // Uat
          ],
          primaryVpnConnection: true,
        },
        {
          fiName: 'FINASTRA-SECONDARY',
          description: 'FINASTRA SECONDARY SITE CONNECTION',
          staticConnection: true,
          clientIp: '13.64.193.238',
          customerNatBlock: [
            '10.254.11.0/27', // Prod
            '10.254.11.32/27', // Uat
          ],
          primaryVpnConnection: false,
        },
      ],
    },
    nordea: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'NORDEA-NEW-YORK',
          description: 'NORDEA NEW YORK CONNECTION',
          staticConnection: true,
          clientIp: '208.204.107.212',
          customerNatBlock: [
            '10.255.16.0/27', // Prod
            '10.255.16.32/27', // Uat
          ],
          primaryVpnConnection: true,
        },
      ],
    },
    bbh: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'mq-primary.bbh.test.dragonflyft.com',
          assignedNat: '192.200.8.215',
        },
        {
          outboundEndpoint: 'mq-secondary.bbh.test.dragonflyft.com',
          assignedNat: '192.200.8.215',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'BBH-PISCATAWAY',
          description: 'BROWN BROTHERS HARRIMAN PISCATAWAY CONNECTION',
          staticConnection: true,
          clientIp: '192.200.6.35',
          customerNatBlock: [
            '10.255.12.0/27', // Prod
            '10.255.12.32/27', // Uat
          ],
          startupAction: 'start',
          primaryVpnConnection: true,
        },
        {
          fiName: 'BBH-SECAUCUS',
          description: 'BROWN BROTHERS HARRIMAN SECAUCUS CONNECTION',
          staticConnection: true,
          clientIp: '192.200.1.35',
          customerNatBlock: [
            '10.255.12.0/27', // Prod
            '10.255.12.32/27', // Uat
          ],
          startupAction: 'start',
          primaryVpnConnection: false,
        },
      ],
    },
    svb: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'moveit-sftp.dest.svb.prod.dragonflyft.com',
          assignedNat: '10.253.10.2',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.svb.uat.dragonflyft.com',
          assignedNat: '10.253.10.34',
        },
        {
          outboundEndpoint: 'moveit-sftp.dest.svb.dr.dragonflyft.com',
          assignedNat: '10.255.10.2',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'SVB-Primary',
          description: 'SILICON VALLEY BANK US PRIMARY',
          staticConnection: false,
          clientIp: '198.212.183.6',
          bgpAsn: '64531',
        },
        {
          fiName: 'SVB-Secondary',
          description: 'SILICON VALLEY BANK US SECONDARY',
          staticConnection: false,
          clientIp: '198.245.241.6',
          bgpAsn: '64513',
        },
      ],
    },
    cadence: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'Cadence-Recovery',
          description: 'Cadence Bank',
          staticConnection: true,
          clientIp: '74.120.89.251',
          customerNatBlock: [
            '10.252.13.0/24', // Prod
            '10.254.13.0/24', // Secondary
          ],
          primaryVpnConnection: true,
        },
      ],
    },
    socgen: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'Societ-General-Recovery',
          description: 'SocGen',
          staticConnection: true,
          clientIp: '162.246.240.100',
          customerNatBlock: [
            '10.253.11.0/27', // Prod
            '10.253.11.32/27', // Secondary
          ],
          primaryVpnConnection: true,
        },
        {
          fiName: 'Societ-General-Recovery-Secondary',
          description: 'SocGen',
          staticConnection: true,
          clientIp: '162.246.241.100',
          customerNatBlock: [
            '10.253.11.0/27', // Prod
            '10.253.11.32/27', // Secondary
          ],
          primaryVpnConnection: false,
        },
      ],
    },
    fnbo: {
      privatelyUsedPublicIp: {
        enabled: true,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'FIRST-NATIONAL-BANK-OF-OMAHA',
          description: 'Primary connection for First National Bank of Omaha',
          staticConnection: true,
          clientIp: '216.205.194.5',
          primaryVpnConnection: true,
          startupAction: 'start',
        },
        {
          fiName: 'FIRST-NATIONAL-BANK-OF-OMAHA-Secondary',
          description: 'Seconary connection for First National Bank of Omaha',
          staticConnection: true,
          clientIp: '216.205.197.148',
          primaryVpnConnection: false,
        },
      ],
    },
    ewbfinastra: {
      privatelyUsedPublicIp: {
        enabled: true,
      },
      outboundEndpointNatMapping: [
        {
          outboundEndpoint: 'mtsmq-primary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-secondary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-primary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-secondary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'mtsmq-primary.fnbo.ist.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-primary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-secondary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-primary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-secondary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'image-primary.fnbo.ist.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-primary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-secondary.fnbo.prod.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-primary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-secondary.fnbo.uat.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
        {
          outboundEndpoint: 'esbpim-primary.fnbo.ist.dragonflyft.com',
          assignedNat: '204.58.232.2',
        },
      ],
      vpnConfigs: [
        {
          fiName: 'EWB-FINASTRA',
          description: 'Primary connection for EWB-FINASTRA',
          staticConnection: true,
          clientIp: '216.131.4.38',
          customerNatBlock: [
            '10.255.18.0/27', // Prod
            '10.255.18.32/27', // UAT
          ],
          primaryVpnConnection: true,
        },
        {
          fiName: 'EWB-FINASTRA-SALTLAKE-CITY',
          description: 'Secondary connection for EWB-FINASTRA',
          staticConnection: true,
          clientIp: '216.131.12.38',
          customerNatBlock: [
            '10.253.18.0/27', // Prod
            '10.253.18.32/27', // UAT
          ],
          primaryVpnConnection: false,
        },
      ],
    },
    alanis: {
      privatelyUsedPublicIp: {
        enabled: false,
      },
      outboundEndpointNatMapping: [],
      vpnConfigs: [
        {
          fiName: 'ALANIS-RECOVERY-TEST',
          description: 'DFT Recovery to Alanis Primary',
          staticConnection: false,
          clientIp: '84.203.115.47',
          primaryVpnConnection: false,
        },
      ],
    },
  };
}
