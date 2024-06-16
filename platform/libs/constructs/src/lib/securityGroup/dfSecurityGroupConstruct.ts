import {
  SecurityGroup,
  SecurityGroupIngress,
} from '@cdktf/provider-aws/lib/security-group';
import { AccountDefinition, DfAccounts, Utils } from '@dragonfly/utils';
import { Construct } from 'constructs';
import {
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
  ReDfInspectionVpcConstruct,
} from '../vpc';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Fn } from 'cdktf';

export interface SecurityGroupConfig {
  name: string;
  vpcConstruct:
    | DfSpokeVpcConstruct
    | ReDfInspectionVpcConstruct
    | DfToolsVpcConstruct;
  extraPorts: {
    tcp: Array<number | [number, number]>;
    udp: Array<number | [number, number]>;
  };
  accountDefinition: AccountDefinition;
  additionalIngress?: SecurityGroupIngress[];
  provider?: AwsProvider;
  ingressConfig?: {
    useSingleIngress: boolean;
    ingressCidrBlock?: string;
  };
}

/**
 * Security Group
 */
export class DfSecurityGroupConstruct {
  private securityGroup: SecurityGroup;
  config: SecurityGroupConfig;

  /**
   *
   * @param {Construct} scope - Requesting scope
   * @param {string} constructName - Terraform name to use
   * @param {SecurityGroupConfig} config - Config for security group
   */
  constructor(
    scope: Construct,
    constructName: string,
    config: SecurityGroupConfig
  ) {
    this.config = config;
    const additionalIngressPorts: SecurityGroupIngress[] = ['udp', 'tcp']
      .map((portType: 'udp' | 'tcp') => {
        return this.config.extraPorts[portType].map(
          (port): SecurityGroupIngress => {
            let fromPort;
            let toPort;
            if (typeof port === 'object') {
              fromPort = port[0];
              toPort = port[1];
            } else {
              fromPort = port;
              toPort = port;
            }

            return this.createSg(portType, fromPort, toPort);
          }
        );
      })
      .flat();

    const cidrBlocksDupsRemoved = config.ingressConfig?.useSingleIngress
      ? [config.ingressConfig.ingressCidrBlock]
      : Fn.distinct([
          ...Utils.getIngressCidrBlocksByNetworkType(
            this.config.accountDefinition
          ),
          this.config.vpcConstruct.vpcCidrBlock,
        ]);

    const defaultPorts: SecurityGroupIngress[] = [
      {
        description: 'Allow RDP',
        fromPort: 3389,
        toPort: 3389,
        protocol: 'tcp',
        // TODO: Unhardcode this
        cidrBlocks: cidrBlocksDupsRemoved,
      },
      {
        description: 'Allow HTTP',
        fromPort: 80,
        toPort: 80,
        protocol: 'tcp',
        // TODO: Unhardcode this
        cidrBlocks: cidrBlocksDupsRemoved,
      },
      {
        description: 'Allow HTTPS',
        fromPort: 443,
        toPort: 443,
        protocol: 'tcp',
        // TODO: Unhardcode this
        cidrBlocks: cidrBlocksDupsRemoved,
      },
      {
        description: 'Allow SSH',
        fromPort: 22,
        toPort: 22,
        protocol: 'tcp',
        // TODO: Unhardcode this
        cidrBlocks: cidrBlocksDupsRemoved,
      },
      // ! Clean up these rules for multiple security group deployments (see uobtier)
      {
        description: 'Allow EFS from within the VPC',
        fromPort: 2049,
        toPort: 2049,
        protocol: 'tcp',
        cidrBlocks: [config.vpcConstruct.vpcCidrBlock],
      },
      {
        description: 'Allow Ping',
        fromPort: -1,
        toPort: -1,
        protocol: 'ICMP',
        // Using CIDR block to create 1 inbound rule
        cidrBlocks: [
          '10.0.0.0/8',
          DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
            .primary.gatewayVpcCidr,
          DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
            .recovery.gatewayVpcCidr,
        ],
      },
      {
        description: "Allow KDC - Kerberos Domain Controller - MS AD",
        fromPort: 88,
        toPort: 88,
        protocol: 'tcp',
        cidrBlocks:[
          DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
          DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery
        ]
      },
      {
        description: "Allow Netbios - MS AD",
        fromPort: 135,
        toPort: 139,
        protocol: 'tcp',
        cidrBlocks:[
          DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
          DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery
        ]
      },
      {
        description: "Allow Netbios - MS AD",
        fromPort: 135,
        toPort: 139,
        protocol: 'udp',
        cidrBlocks:[
          DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
          DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery
        ]
      },
      {
        description: "Allow SMB - MS AD",
        fromPort: 445,
        toPort: 445,
        protocol: 'tcp',
        cidrBlocks:[
          DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
          DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery
        ]
      },
      {
        description: "Allow Ssh discovery - MS AD",
        fromPort: 4431,
        toPort: 4431,
        protocol: 'tcp',
        cidrBlocks:[
          DfAccounts.getToolsAccountDef().vpcCidrs.main.primary,
          DfAccounts.getToolsAccountDef().vpcCidrs.main.recovery
        ]
      },
      ...(additionalIngressPorts ? additionalIngressPorts : []),
      ...(this.config.additionalIngress ? this.config.additionalIngress : []),
    ];

    this.securityGroup = new SecurityGroup(scope, constructName, {
      name: `${this.config.name}-VMSG`,
      lifecycle: {
        createBeforeDestroy: true,
      },
      description: 'Allow VPNd RDP conns',
      vpcId: this.config.vpcConstruct.vpcId,
      provider: this.config.provider,
      ingress: [...defaultPorts, ...additionalIngressPorts],

      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      tags: { Name: this.config.name },
    });
  }

  /**
   *
   * @return {SecurityGroup}
   */
  public get securityGroupResource(): SecurityGroup {
    return this.securityGroup;
  }

  /**
   *
   * @param {'udp' | 'tcp'} type - port type to create
   * @param {number} fromPort - from port
   * @param {number} toPort - to port
   * @return {SecurityGroupIngress}
   */
  private createSg(type: 'udp' | 'tcp', fromPort: number, toPort: number) {
    const cidrBlocks = this.config.ingressConfig?.useSingleIngress
      ? [this.config.ingressConfig.ingressCidrBlock]
      : [
          ...Utils.getIngressCidrBlocksByNetworkType(
            this.config.accountDefinition
          ),
          this.config.vpcConstruct.vpcCidrBlock,
        ];

    return {
      description: 'UOB App port',
      fromPort: fromPort,
      toPort: toPort,
      protocol: type,
      cidrBlocks: cidrBlocks,
    };
  }
}
