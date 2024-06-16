/* eslint-disable no-useless-escape */
import {
  DfSharedTransitGatewayConstruct,
  ReDfInspectionVpcConstruct,
  DfGatewayVpcConstruct,
} from '@dragonfly/constructs';
import { TerraformOutput } from 'cdktf';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import {
  AccountDefinition,
  Constants,
  CustomerDefinition,
  DfAccounts,
  DfMultiRegionDeployment,
  GatewayVpcCidrs,
  Utils,
} from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { createPaloAltoNetworkingResources } from './helpers/paloAltoNetworkResources';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';

interface SkipPaloAltoDeployment {
  deploy: false;
}

interface DeployPaloAlto {
  deploy: true;
  paInstanceType?: string;
  paR53Records: string[];
}

export interface ReDfSharedNetworkStackConfig {
  /**
   * * CIDR Blocks for SharedNetwork VPCs
   */
  cidrBlocks: {
    /**
     * * Inspection VPC CIDR Block
     */
    inspection: string;
    /**
     * * Gateway VPC CIDR Blocks
     */
    gatewayVpcCidrs?: GatewayVpcCidrs;
  };
  /**
   * * AWS Region to deploy Shared Network in
   */
  region: Constants.AWS_REGION_ALIASES;
  /**
   * * OPTIONAL: Transit Gateway ASN
   */
  tgwAsn?: number;
  /**
   * * OPTIONAL: Number of Palo Alto Instances
   */
  nonProd?: boolean;
  /**
   * Inspection Role Assumption
   */
  inspectionRoleAssumption: string;
  /**
   * The account metadata for the Shared Network Account(s)
   */
  account: AccountDefinition;
  /**
   * * Whether or not to bypass inspection phase in the Inspection VPC
   */
  bypassInspection: boolean;
  /**
   *
   */
  externalCustomers: CustomerDefinition[];
  /**
   * * The Network suffix string to append to the Shared Network Stack. Must be either PRIMARY or RECOVERY
   */
  networkSuffix?: 'LEGACY' | 'PRIMARY' | 'RECOVERY';
  /**
   * * Whether or not to skip Palo Alto Deployment
   */
  paloAlto: SkipPaloAltoDeployment | DeployPaloAlto;
  /**
   * * Whether or not to deploy Hybrid Networking
   */
  deployHybridNetworking: boolean;
}
/**
 *
 */
export class DfSharedNetworkStack
  extends RemoteStack
  implements DfMultiRegionDeployment
{
  public readonly tgwConstruct: DfSharedTransitGatewayConstruct;
  private phzId: string;
  public readonly inspectionVpcConstruct: ReDfInspectionVpcConstruct;
  public readonly gatewayVpcConstruct: DfGatewayVpcConstruct;
  public readonly providerToChoose: AwsProvider;

  /**
   *
   * @param {StackConfig} stackConfig
   * @param {string} stackId
   * @param {DfSharedNetworkStackConfig} sharedNetworkStackConfig
   */
  constructor(
    protected stackConfig: StackConfig,
    public readonly stackId: string,
    public readonly sharedNetworkStackConfig: ReDfSharedNetworkStackConfig
  ) {
    super(stackId, stackConfig);

    let prodSuffix: string;
    if (!sharedNetworkStackConfig.nonProd) {
      prodSuffix = stackId;
    }

    this.providerToChoose = this.getProviderForRegion(
      sharedNetworkStackConfig.region
    );

    // * Create Inspection VPC
    this.inspectionVpcConstruct = new ReDfInspectionVpcConstruct(
      this,
      [this.stackUuid, 'Inspection'].join('-'),
      {
        vpcCidr: this.sharedNetworkStackConfig.cidrBlocks.inspection,
        provider: this.providerToChoose,
        federatedAccountId: this.stackConfig.federatedAccountId,
        region: this.sharedNetworkStackConfig.region,
        inspectionRoleAssumption:
          this.sharedNetworkStackConfig.inspectionRoleAssumption,
      }
    );

    // * Create Gateway VPC
    this.gatewayVpcConstruct = new DfGatewayVpcConstruct(
      this,
      [this.stackUuid, 'Gateway'].join('-'),
      {
        vpcCidr:
          this.sharedNetworkStackConfig.cidrBlocks.gatewayVpcCidrs
            .gatewayVpcCidr,
        provider: this.providerToChoose,
        federatedAccountId: this.stackConfig.federatedAccountId,
        transitSubnetCidrs:
          this.sharedNetworkStackConfig.cidrBlocks.gatewayVpcCidrs.subnets
            .transit,
        gatewayVpcCidrs:
          this.sharedNetworkStackConfig.cidrBlocks.gatewayVpcCidrs,
        region: this.sharedNetworkStackConfig.region,
        account: this.sharedNetworkStackConfig.account,
        externalCustomers: this.sharedNetworkStackConfig.externalCustomers,
        deployHybridNetworking:
          this.sharedNetworkStackConfig.deployHybridNetworking,
      }
    );

    this.gatewayVpcConstruct.getCustomerSubnets().forEach((customerSubnet) => {
      new TerraformOutput(
        this,
        Utils.getCustomerSubnetTerraformOutputName(
          customerSubnet.customerName,
          customerSubnet.azName
        ),
        {
          value: customerSubnet.subnet.id,
        }
      );
    });

    /**
     * * Create the Shared Transit Gateway Construct
     */

    this.tgwConstruct = new DfSharedTransitGatewayConstruct(
      this,
      [this.stackUuid, 'Tgw'].join('-'),
      {
        gatewayVpc: this.gatewayVpcConstruct,
        inspectionVpc: this.inspectionVpcConstruct,
        provider: this.providerToChoose,
        tgwAsn: this.sharedNetworkStackConfig.tgwAsn,
        tgwSuffix: prodSuffix,
        account: this.sharedNetworkStackConfig.account,
        bypassInspection: this.sharedNetworkStackConfig.bypassInspection,
        deployHybridNetworking:
          this.sharedNetworkStackConfig.deployHybridNetworking,
      },
      this.stackConfig.federatedAccountId
    );

    /**
     * * Create Palo Alto Networking Resources
     */

    if (sharedNetworkStackConfig.paloAlto.deploy === true) {
      const paConfig = sharedNetworkStackConfig.paloAlto as DeployPaloAlto;
      createPaloAltoNetworkingResources(this, this.stackConfig, {
        bypassInspection: this.sharedNetworkStackConfig.bypassInspection,
        r53Records: paConfig.paR53Records,
      });
    }

    if (
      this.stackConfig.federatedAccountId ===
      DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      this.phzId = new DataAwsRoute53Zone(this, 'privateHostedZoneLookup', {
        name: 'dragonflyft.com',
        privateZone: true,
      }).id;
    } else {
      const providerForRoute53 = this.createAwsProvider({
        supportedRegion: Constants.AWS_REGION_ALIASES.LEGACY,
        forAccount: Utils.getSharedNetworkAccountProviderConfig(),
      });
      this.phzId = new DataAwsRoute53Zone(this, 'privateHostedZoneLookup', {
        name: 'dragonflyft.com',
        privateZone: true,
        provider: providerForRoute53,
      }).id;
    }

    /** Terraform Outputs */
    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_PRIVATE_HOSTED_ZONE_ID,
      {
        value: this.phzId,
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_POST_INSPECTION_TRAFFIC_ROUTE_TABLE_ID,
      {
        value:
          this.tgwConstruct.postInspectionTrafficTransitGatewayRouteTable.id,
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_TGW_ID,
      {
        value: this.tgwConstruct.transitGateway.id,
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_SHARED_NETWORK_SPOKE_TRAFFIC_TGW_ROUTE_TABLE_ID,
      {
        value: this.tgwConstruct.spokeTrafficTransitGatewayRouteTable.id,
      }
    );

    new TerraformOutput(this, Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID, {
      value: this.gatewayVpcConstruct.vpcId,
    });

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_IDS,
      {
        value: this.gatewayVpcConstruct.internetBlockSubnetIds,
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_A,
      {
        value: this.gatewayVpcConstruct.internetBlockSubnetIds[0],
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_B,
      {
        value: this.gatewayVpcConstruct.internetBlockSubnetIds[1],
      }
    );

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_SUBNET_ID_AZ_C,
      {
        value: this.gatewayVpcConstruct.internetBlockSubnetIds[2],
      }
    );

    if (
      this.stackConfig.federatedAccountId ===
      DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      new TerraformOutput(
        this,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_IDS,
        {
          value: this.gatewayVpcConstruct.internetXLBlockSubnetIds,
        }
      );

      new TerraformOutput(
        this,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_A,
        {
          value: this.gatewayVpcConstruct.internetXLBlockSubnetIds[0],
        }
      );

      new TerraformOutput(
        this,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_B,
        {
          value: this.gatewayVpcConstruct.internetXLBlockSubnetIds[1],
        }
      );

      new TerraformOutput(
        this,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_INTERNET_XL_SUBNET_ID_AZ_C,
        {
          value: this.gatewayVpcConstruct.internetXLBlockSubnetIds[2],
        }
      );
    }

    new TerraformOutput(
      this,
      Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_PUPI_EDGE_SUBNET_IDS,
      {
        value: this.gatewayVpcConstruct.pupiCustomerEdgeSubnetIds,
      }
    );
    // Only create a terraform output for the prod primary transit subnets for DMS in tools
    if (
      sharedNetworkStackConfig.region ===
        Constants.AWS_REGION_ALIASES.DF_PRIMARY &&
      this.stackConfig.federatedAccountId ===
        DfAccounts.getProdSharedNetworkAccountDef().accountNumber
    ) {
      // Create a terraform output for customer edge subnet ids so tools can use them
      new TerraformOutput(
        this,
        Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_CUSTOMER_EDGE_SUBNET_IDS,
        {
          value: this.gatewayVpcConstruct.customerEdgeSubnetIds,
        }
      );
    }
  }

  /**
   *
   * @return {string} phzId
   */
  public getPhzId(): string {
    return this.phzId;
  }
}
