/* eslint-disable no-useless-escape */
import { DataAwsAvailabilityZones } from '@cdktf/provider-aws/lib/data-aws-availability-zones';
import { RouteTable } from '@cdktf/provider-aws/lib/route-table';
import { RouteTableAssociation } from '@cdktf/provider-aws/lib/route-table-association';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import { Fn } from 'cdktf';
import { Construct } from 'constructs';
import { DfBaseVpcConstruct } from '../helpers/dfBaseVpcConstruct';
import { Constants } from '@dragonfly/utils';
import { DfBaseVpcConstructConfig } from '../helpers/interfaces';

export interface ReDfInspectionVpcConstructConfig
  extends DfBaseVpcConstructConfig {
  inspectionRoleAssumption: string;
  region: Constants.AWS_REGION_ALIASES;
}

/**
 * Inspection VPC
 */
export class ReDfInspectionVpcConstruct extends DfBaseVpcConstruct {
  public readonly transitSubnets: Subnet[] = [];
  private firewallSubnets: Subnet[] = [];
  private firewallRouteTable: RouteTable;
  private transitRouteTables: RouteTable[] = [];

  public readonly mgmtSubnets: Subnet[] = [];
  public readonly inspectionSubnets: Subnet[] = [];
  public readonly gwlbVpceSubnets: Subnet[] = [];
  private mgmtRouteTable: RouteTable;
  private inspectionSubnetRouteTable: RouteTable;
  private gwlbVpceSubnetRouteTable: RouteTable;
  public readonly inspectionTransitSubnetRouteTables: RouteTable[] = [];

  /**
   * @param {Construct} scope - The parent stack
   * @param {string} id - Logical id for the construct
   * @param {ReDfInspectionVpcConstructConfig} config - Configuration for the construct
   */
  constructor(
    scope: Construct,
    id: string,
    config: ReDfInspectionVpcConstructConfig
  ) {
    super(scope, id, config);

    const availabilityZones = new DataAwsAvailabilityZones(
      this,
      `${id}-zones`,
      {
        provider: config.provider,
        state: 'available',
      }
    );

    for (let i = 0; i < 3; i++) {
      this.transitSubnets.push(
        new Subnet(this, `${id}transitSubnet${i}`, {
          provider: config.provider,
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `${id}-transitSubnet-${i + 1}`,
          },
        })
      );

      this.mgmtSubnets.push(
        new Subnet(this, `${id}-mgmt-subnet-${i}`, {
          provider: config.provider,
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 3),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `mgmt-subnet-${i + 1}`,
          },
        })
      );

      this.inspectionSubnets.push(
        new Subnet(this, `${id}-inspection-subnet-${i}`, {
          provider: config.provider,
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 6),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `inspection-subnet-${i + 1}`,
          },
        })
      );

      this.gwlbVpceSubnets.push(
        new Subnet(this, `${id}-gwlb-vpce-subnet-${i}`, {
          provider: config.provider,
          vpcId: this.vpc.id,
          cidrBlock: Fn.cidrsubnet(this.vpc.cidrBlock, 4, i + 9),
          availabilityZone: Fn.element(availabilityZones.names, i),
          mapPublicIpOnLaunch: false,
          tags: {
            Name: `gwlb-vpce-subnet-${i + 1}`,
          },
        })
      );
    }

    this.mgmtRouteTable = new RouteTable(this, 'mgmt-subnet-route-table', {
      provider: config.provider,
      vpcId: this.vpc.id,
      tags: {
        Name: 'mgmt-rtb',
      },
    });

    this.mgmtSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `mgmt-subnet-route-table-asociation-${index}`,
        {
          provider: config.provider,
          subnetId: subnet.id,
          routeTableId: this.mgmtRouteTable.id,
        }
      );
    });

    this.inspectionSubnetRouteTable = new RouteTable(
      this,
      'inspection-subnet-route-table',
      {
        provider: config.provider,
        vpcId: this.vpc.id,
        tags: {
          Name: 'inspection-rtb',
        },
      }
    );

    this.inspectionSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `inspection-subnet-route-table-association-${index}`,
        {
          provider: config.provider,
          subnetId: subnet.id,
          routeTableId: this.inspectionSubnetRouteTable.id,
        }
      );
    });

    this.gwlbVpceSubnetRouteTable = new RouteTable(
      this,
      'gwlb-vpce-subnet-route-table',
      {
        provider: config.provider,
        vpcId: this.vpc.id,
        tags: {
          Name: 'gwlb-vpce-rtb',
        },
      }
    );

    this.gwlbVpceSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(
        this,
        `gwlb-vpce-subnet-route-table-association-${index}`,
        {
          provider: config.provider,
          subnetId: subnet.id,
          routeTableId: this.gwlbVpceSubnetRouteTable.id,
        }
      );
    });

    this.transitSubnets.forEach((subnet, index) => {
      const inspectionTransitRouteTable = new RouteTable(
        this,
        `inspection-transit-subnet-route-table-${index}`,
        {
          provider: config.provider,
          vpcId: this.vpc.id,
          tags: {
            Name: `inspection-transit-rtb-${index + 1}`,
          },
        }
      );

      this.inspectionTransitSubnetRouteTables.push(inspectionTransitRouteTable);

      new RouteTableAssociation(
        this,
        `inspection-transit-subnet-route-table-association-${index}`,
        {
          provider: config.provider,
          subnetId: subnet.id,
          routeTableId: inspectionTransitRouteTable.id,
        }
      );
    });
  }

  /**
   * @return {string[]} - The firewall subnets
   */
  public get firewallSubnetIds(): string[] {
    return this.firewallSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string} - The inspection route table
   */
  public get firewallRouteTableId(): string {
    return this.firewallRouteTable.id;
  }

  /**
   * @return {string[]} - The transit route tables
   */
  public get transitRouteTableIds(): string[] {
    return this.transitRouteTables.map((t: RouteTable) => {
      return t.id;
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
   * @return {string[]} - MGMT Subnet Ids
   */
  public get mgmtSubnetIds(): string[] {
    return this.mgmtSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string | undefined} - MGMT RTB ID
   */
  public get mgmtRouteTableId(): string | undefined {
    return this.mgmtRouteTable ? this.mgmtRouteTable.id : undefined;
  }

  /**
   * @return {string[]} - PA Inspection Subnet Ids
   */
  public get inspectionSubnetIds(): string[] {
    return this.inspectionSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string | undefined} - PA Inspection Subnet Route Table ID
   */
  public get inspectionRouteTableId(): string | undefined {
    return this.inspectionSubnetRouteTable
      ? this.inspectionSubnetRouteTable.id
      : undefined;
  }

  /**
   * @return {string[]} - Gateway Load Balancer VPC Endpoint Subnet Ids
   */
  public get gwlbVpceSubnetIds(): string[] {
    return this.gwlbVpceSubnets.map((s: Subnet) => {
      return s.id;
    });
  }

  /**
   * @return {string | undefined} - Gateway Load Balancer VPC Endpoint Subnet Route Table ID
   */
  public get gwlbVpceRouteTableId(): string | undefined {
    return this.gwlbVpceSubnetRouteTable
      ? this.gwlbVpceSubnetRouteTable.id
      : undefined;
  }
}
