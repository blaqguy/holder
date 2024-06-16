import { DataAwsAvailabilityZones } from '@cdktf/provider-aws/lib/data-aws-availability-zones';
import { NetworkAcl } from '@cdktf/provider-aws/lib/network-acl';
import { NetworkAclAssociation } from '@cdktf/provider-aws/lib/network-acl-association';
import { NetworkAclRule } from '@cdktf/provider-aws/lib/network-acl-rule';
import { RouteTable } from '@cdktf/provider-aws/lib/route-table';
import { RouteTableAssociation } from '@cdktf/provider-aws/lib/route-table-association';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import { Construct } from 'constructs';
import { DfBaseVpcConstruct } from '../helpers/dfBaseVpcConstruct';
import { appNaclRules, dataNaclRules } from '../helpers/nacls';
import { Fn } from 'cdktf';
import { DbSubnetGroup } from '@cdktf/provider-aws/lib/db-subnet-group';
import { DfBaseVpcConstructConfig } from '../helpers/interfaces';

/**
 * Spoke VPC
 */
export class DfToolsVpcConstruct extends DfBaseVpcConstruct {
  public readonly transitSubnets: Subnet[] = [];
  public readonly appSubnets: Subnet[] = [];
  public readonly dataSubnets: Subnet[] = [];
  private nonProdTransitSubnets: Subnet[] = [];
  public readonly prodTransitSubnets: Subnet[] = [];
  private privateSubnets: Subnet[] = [];

  private privateRouteTable: RouteTable;
  private prodTransitRouteTable: RouteTable;
  private nonProdTransitRouteTable: RouteTable;

  public readonly dbSubnetGroup: DbSubnetGroup;
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
    super(scope, id, config);

    const availabilityZones = new DataAwsAvailabilityZones(
      this,
      `${this.id}-zones`,
      {
        state: 'available',
      }
    );

    for (let i = 0; i < 3; i++) {
      this.transitSubnets.push(
        new Subnet(this, `${id}transitSubnet${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `${id}-transitSubnet-${i + 1}`,
          },
        })
      );

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

    // * Default DB Subnet Group
    this.dbSubnetGroup = new DbSubnetGroup(this, `${this.id}-db-subnet-group`, {
      name: 'default-subnet-group',
      subnetIds: this.dataSubnetIds,
      tags: {
        Name: 'default-subnet-group',
      },
    });

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

    this.privateSubnets = this.appSubnets.concat(
      this.transitSubnets,
      this.dataSubnets
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

    // * Update CIDR for Data NACLs ehpemeral ports
    dataNaclRules['allow-ephemeral-ports'].cidrBlock = this.vpcCidrBlock;

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

    /**
     * * Shared Tools TGW Resources - Shared Tools needs to communicate with both Prod, Non Prod and Old Shared Networks
     * * Create Transit Subnets for Prod and Non Prod Traffic. Don't want Prod and Non Prod traffic flowing through the same transit subnets
     * * Route Table routes are easier to distinguish between Prod and Non Prod
     */

    for (let i = 0; i < 3; i++) {
      // * Create Prod Transit Subnets
      this.prodTransitSubnets.push(
        new Subnet(this, `${this.id}prodTransitSubnet${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 9),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `${id}-prodTransitSubnet-${i + 1}`,
          },
        })
      );

      // * Create Non Prod Transit Subnets
      this.nonProdTransitSubnets.push(
        new Subnet(this, `${this.id}nonProdTransitSubnet${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 12),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `${id}-nonProdTransitSubnet-${i + 1}`,
          },
        })
      );
    }

    // * Dedicated Route Table for Prod Transit Subnets
    this.prodTransitRouteTable = new RouteTable(
      this,
      `${this.id}-prodTransitRouteTable`,
      {
        vpcId: this.vpc.id,
        tags: {
          Name: `${this.id}-prodTransitRouteTable`,
        },
      }
    );

    this.nonProdTransitRouteTable = new RouteTable(
      this,
      `${this.id}-nonProdTransitRouteTable`,
      {
        vpcId: this.vpc.id,
        tags: {
          Name: `${this.id}-nonProdTransitRouteTable`,
        },
      }
    );

    this.prodTransitSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `${this.id}-prodTransitSubnetRouteTableAssociation${index}`,
        {
          subnetId: subnet.id,
          routeTableId: this.prodTransitRouteTable.id,
        }
      );
    });

    this.nonProdTransitSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `${this.id}-nonProdTransitSubnetRouteTableAssociation${index}`,
        {
          subnetId: subnet.id,
          routeTableId: this.nonProdTransitRouteTable.id,
        }
      );
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
   * @return {[string]} - The Transit Subnet IDs
   */
  public get transitSubnetIds(): string[] {
    return this.transitSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string}
   */
  public get prodTransitSubnetIds(): string[] {
    return this.prodTransitSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string}
   */
  public get privateRouteTableId(): string {
    return this.privateRouteTable.id;
  }

  /**
   * @return {string}
   */
  public get prodTransitRouteTableId(): string {
    return this.prodTransitRouteTable.id;
  }

  /**
   * @return {string}
   */
  public get nonProdTransitSubnetIds(): string[] {
    return this.nonProdTransitSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string}
   */
  public get nonProdTransitRouteTableId(): string {
    return this.nonProdTransitRouteTable.id;
  }
}
