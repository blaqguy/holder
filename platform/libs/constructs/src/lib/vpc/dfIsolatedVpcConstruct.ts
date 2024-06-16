import { DataAwsAvailabilityZones } from '@cdktf/provider-aws/lib/data-aws-availability-zones';
import { NetworkAcl } from '@cdktf/provider-aws/lib/network-acl';
import { NetworkAclAssociation } from '@cdktf/provider-aws/lib/network-acl-association';
import { NetworkAclRule } from '@cdktf/provider-aws/lib/network-acl-rule';
import { RouteTable } from '@cdktf/provider-aws/lib/route-table';
import { RouteTableAssociation } from '@cdktf/provider-aws/lib/route-table-association';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import { Construct } from 'constructs';
import { DfBaseVpcConstruct } from './helpers/dfBaseVpcConstruct';
import { appNaclRules, dataNaclRules, publicNaclRules } from './helpers/nacls';
import { Fn } from 'cdktf';
import { InternetGateway } from '@cdktf/provider-aws/lib/internet-gateway';
import { Route } from '@cdktf/provider-aws/lib/route';
import { Eip } from '@cdktf/provider-aws/lib/eip';
import { NatGateway } from '@cdktf/provider-aws/lib/nat-gateway';
import { Utils } from '@dragonfly/utils';
import { DfBaseVpcConstructConfig } from './helpers/interfaces';

/**
 * Spoke VPC
 */
export class DfIsolatedVpcConstruct extends DfBaseVpcConstruct {
  public readonly appSubnets: Subnet[] = [];
  private dataSubnets: Subnet[] = [];
  private publicSubnets: Subnet[] = [];
  private privateSubnets: Subnet[] = [];
  private privateRouteTable: RouteTable;
  public readonly publicRouteTable: RouteTable;
  private appNacl: NetworkAcl;
  private dataNacl: NetworkAcl;

  /**
   * @param {Construct} scope - The parent stack
   * @param {string} id - Logical id for the construct
   * @param {DfBaseVpcConstructConfig} config - Configuration properties for the VPC
   */
  constructor(
    private scope: Construct,
    private id: string,
    config: DfBaseVpcConstructConfig
  ) {
    // Last parameter is isolatedNetwork which is set to true
    // for the isolatedVpcConstruct to avoid deploying the transitSubnets in the DfBaseVpcConstruct
    super(scope, id, config);

    const availabilityZones = new DataAwsAvailabilityZones(
      this,
      `${this.id}-zones`,
      {
        state: 'available',
      }
    );

    for (let i = 0; i < 3; i++) {
      this.appSubnets.push(
        new Subnet(this, `${this.id}appSubnet${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 3),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `${this.id}-appSubnet-${i + 1}`,
          },
        })
      );
    }

    for (let i = 0; i < 3; i++) {
      this.dataSubnets.push(
        new Subnet(this, `${this.id}dataSubnet${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 6),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `${id}-dataSubnet-${i + 1}`,
          },
        })
      );
    }

    this.privateSubnets = this.appSubnets.concat(this.dataSubnets);

    this.privateRouteTable = new RouteTable(
      this,
      `${this.id}-privateRouteTable`,
      {
        vpcId: this.vpc.id,
        tags: {
          Name: `${this.id}-privateRouteTable`,
        },
      }
    );

    this.privateSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `${this.id}-privateSubnetRouteTableAssociation${index}`,
        {
          subnetId: subnet.id,
          routeTableId: this.privateRouteTable.id,
        }
      );
    });

    this.appNacl = new NetworkAcl(this, 'appNacl', {
      vpcId: this.vpc.id,
      tags: {
        Name: 'appNacl',
      },
    });

    this.appSubnets.forEach((subnet, index) => {
      new NetworkAclAssociation(
        this,
        `${this.id}-appSubnet${index}NaclAssociation`,
        {
          networkAclId: this.appNacl.id,
          subnetId: subnet.id,
        }
      );
    });

    new NetworkAclRule(this, `${this.id}-allowAppTraffic`, {
      networkAclId: this.appNacl.id,
      ruleNumber: 99,
      egress: false,
      protocol: 'tcp',
      ruleAction: 'allow',
      cidrBlock: this.vpcCidrBlock,
      fromPort: 1521,
      toPort: 1521,
      dependsOn: [this.appNacl],
    });

    for (const [key, value] of Object.entries(appNaclRules)) {
      new NetworkAclRule(this, `${this.id}-${key}-appNaclRule`, {
        networkAclId: this.appNacl.id,
        ruleNumber: value.ruleNumber,
        egress: value.egress,
        protocol: value.protocol,
        ruleAction: value.ruleAction,
        cidrBlock: value.cidrBlock,
        fromPort: value.fromPort,
        toPort: value.toPort,
        dependsOn: [this.appNacl],
      });
    }

    this.dataNacl = new NetworkAcl(this, 'dataNacl', {
      vpcId: this.vpc.id,
      tags: {
        Name: 'dataNacl',
      },
    });

    this.dataSubnets.forEach((subnet, index) => {
      new NetworkAclAssociation(
        this,
        `${id}-dataSubnet${index}NaclAssociation`,
        {
          networkAclId: this.dataNacl.id,
          subnetId: subnet.id,
        }
      );
    });

    for (const [key, value] of Object.entries(dataNaclRules)) {
      new NetworkAclRule(this, `${this.id}-${key}-dataNaclRule`, {
        networkAclId: this.dataNacl.id,
        ruleNumber: value.ruleNumber,
        egress: value.egress,
        protocol: value.protocol,
        ruleAction: value.ruleAction,
        cidrBlock: value.cidrBlock,
        fromPort: value.fromPort,
        toPort: value.toPort,
        dependsOn: [this.dataNacl],
      });
    }

    for (let i = 0; i < 3; i++) {
      const publicSubnet = new Subnet(this, `${this.id}publicSubnet${i}`, {
        provider: config.provider,
        vpcId: this.vpc.id,
        cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 9),
        availabilityZone: Fn.element(availabilityZones.names, i),
        mapPublicIpOnLaunch: true,
        tags: {
          Name: `${this.id}-publicSubnet-${i + 1}`,
        },
      });
      Utils.addPublicTag(publicSubnet);
      this.publicSubnets.push(publicSubnet);
    }

    const publicNacl = new NetworkAcl(this, 'publicNacl', {
      provider: config.provider,
      vpcId: this.vpc.id,
      tags: {
        Name: 'publicNacl',
      },
    });
    Utils.addPublicTag(publicNacl);

    this.publicSubnets.forEach((subnet, index) => {
      new NetworkAclAssociation(
        this,
        `${this.id}-publicSubnet${index}NaclAssociation`,
        {
          provider: config.provider,
          networkAclId: publicNacl.id,
          subnetId: subnet.id,
        }
      );
    });

    for (const [key, value] of Object.entries(publicNaclRules)) {
      new NetworkAclRule(this, `${this.id}-${key}-publicNaclRule`, {
        provider: config.provider,
        networkAclId: publicNacl.id,
        ruleNumber: value.ruleNumber,
        egress: value.egress,
        protocol: value.protocol,
        ruleAction: value.ruleAction,
        cidrBlock: value.cidrBlock,
        fromPort: value.fromPort,
        toPort: value.toPort,
        dependsOn: [publicNacl],
      });
    }

    const publicRouteTable = new RouteTable(
      this,
      `${this.id}-publicRouteTable`,
      {
        provider: config.provider,
        vpcId: this.vpc.id,
        tags: {
          Name: `${this.id}-publicRouteTable`,
        },
      }
    );
    Utils.addPublicTag(publicRouteTable);

    this.publicSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `${this.id}-publicSubnetRouteTableAssociation${index}`,
        {
          provider: config.provider,
          subnetId: subnet.id,
          routeTableId: publicRouteTable.id,
        }
      );
    });

    const igw = new InternetGateway(this, `${this.id}-internet-gateway`, {
      provider: config.provider,
      vpcId: this.vpc.id,
      tags: { Name: `${this.id}-internetGateway` },
    });

    new Route(this, `${this.id}-public-route`, {
      provider: config.provider,
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id,
    });

    const ngwEip = new Eip(this, 'natGatewayEip', {
      provider: config.provider,
      vpc: true,
      tags: { Name: `${this.id}-natGatewayEip` },
      dependsOn: [igw],
    });

    const ngw = new NatGateway(this, 'natGateway', {
      provider: config.provider,
      allocationId: ngwEip.id,
      subnetId: this.publicSubnets[0].id,
      tags: { Name: `${this.id}natGateway` },
    });

    new Route(this, 'ngwRoute', {
      provider: config.provider,
      routeTableId: this.privateRouteTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: ngw.id,
    });
  }

  /**
   * @return {string}
   */
  public get appSubnetIds(): string[] {
    return this.appSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string}
   */
  public get dataSubnetIds(): string[] {
    return this.dataSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string[]} - The Public Subnet Ids
   */
  public get publicSubnetIds(): string[] {
    return this.publicSubnets.map((s: Subnet) => {
      return s.id;
    });
  }
}
