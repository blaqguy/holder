import { NetworkInterface } from '@cdktf/provider-aws/lib/network-interface';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import {
  DfKeyPairConstruct,
  DfPrivateInstanceConstruct,
} from '@dragonfly/constructs';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { StackConfig } from '../../stacks';
import { DfSharedNetworkStack } from '../dfSharedNetworkStack';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { VpcEndpointService } from '@cdktf/provider-aws/lib/vpc-endpoint-service';
import { VpcEndpoint } from '@cdktf/provider-aws/lib/vpc-endpoint';
import { Route } from '@cdktf/provider-aws/lib/route';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { AlbTargetGroupAttachment } from '@cdktf/provider-aws/lib/alb-target-group-attachment';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';

interface PaConfig {
  instanceType?: string;
  bypassInspection: boolean;
  r53Records: string[];
}

export function createPaloAltoNetworkingResources(
  stack: DfSharedNetworkStack,
  stackConfig: StackConfig,
  paConfig: PaConfig
) {
  const paKeyPair = new DfKeyPairConstruct(
    stack,
    `palo-alto-inspection-${stack.sharedNetworkStackConfig.networkSuffix}-key`.toLowerCase(),
    {
      keyName:
        `palo-alto-inspection-${stack.sharedNetworkStackConfig.networkSuffix}-key`.toLowerCase(),
      provider: stack.providerToChoose,
    }
  );

  const mgmtInterfaceSg = new SecurityGroup(
    stack,
    'palo-alto-inspection-mgmt-sg',
    {
      provider: stack.providerToChoose,
      name: 'palo-alto-inspection-mgmt-sg',
      vpcId: stack.inspectionVpcConstruct.vpcId,
      description: 'Security group for the mgmt interface',
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
    }
  );

  const inspectionInterfaceSg = new SecurityGroup(
    stack,
    'palo-alto-inspection-interface-sg',
    {
      provider: stack.providerToChoose,
      name: 'palo-alto-inspection-interface-sg',
      vpcId: stack.inspectionVpcConstruct.vpcId,
      description: 'Security group for the inspection interface',
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
    }
  );

  let sharedNetworkProvider = stack.providerToChoose;

  if (
    stack.sharedNetworkStackConfig.account.accountNumber ===
    DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber
  ) {
    sharedNetworkProvider = stack.createAwsProvider({
      supportedRegion: Utils.getRegionAliasFromRegion(
        Constants.AWS_REGION_MAP[stack.sharedNetworkStackConfig.region]
      ),
      forAccount: Utils.getSharedNetworkAccountProviderConfig(),
    });
  }

  const privateHostedZoneId = new DataAwsRoute53Zone(
    stack,
    'dragonfly-private-zone',
    {
      provider: sharedNetworkProvider,
      name: 'dragonflyft.com',
      privateZone: true,
    }
  ).id;

  const paInstanceIds = [];

  for (let i = 0; i < paConfig.r53Records.length; i++) {
    const instanceName =
      i === 0
        ? `palo-alto-${stack.sharedNetworkStackConfig.networkSuffix}-inspection`.toLowerCase()
        : `palo-alto-${
            stack.sharedNetworkStackConfig.networkSuffix
          }-inspection-0${i + 1}`.toLowerCase();

    // * Private inspection network interface will be in the inspection subnet
    const paInstance = DfPrivateInstanceConstruct.linuxInstanceFactory({
      scope: stack,
      name: instanceName,
      constructProps: {
        vpc: stack.inspectionVpcConstruct,
        accountDefinition: stackConfig.accountDefinition,
        instanceResourceConfig: {
          sourceDestCheck: false,
          ami: Constants.MANAGED_AMI_IDS[stack.sharedNetworkStackConfig.region][
            Constants.AMIS.PALO_ALTO_BYOL
          ],
          instanceType: paConfig.instanceType || 'c5n.xlarge',
          keyName: paKeyPair.keyName,
          rootBlockDevice: {
            volumeSize: 100,
          },
          tags: {
            hostname: instanceName,
            'ansible-managed': 'false',
            application: 'palo-alto',
          },
        },
        options: {
          provider: stack.providerToChoose,
          securityGroup: {
            resource: inspectionInterfaceSg,
          },
          subnet: {
            resource: stack.inspectionVpcConstruct.inspectionSubnets[i],
            azIndex: i,
          },
        },
      },
    });

    paInstanceIds.push(paInstance.instanceResource.id);

    new Route53Record(stack, `pa-r53-record-${i}`, {
      provider: sharedNetworkProvider,
      name: `${paConfig.r53Records[i]}.dragonflyft.com.`,
      type: 'A',
      records: [paInstance.instanceResource.privateIp],
      zoneId: privateHostedZoneId,
      ttl: 300,
    });

    const networkInterfaceName =
      i === 0
        ? `palo-alto-inspection-mgmt-interface`
        : `palo-alto-inspection-inspection-interface-0${i + 1}`;
    // Creates the mgmt network interface in the mgmt subnet
    new NetworkInterface(stack, networkInterfaceName, {
      subnetId: stack.inspectionVpcConstruct.mgmtSubnetIds[i],
      securityGroups: [mgmtInterfaceSg.id],
      provider: stack.providerToChoose,
      tags: {
        Name: networkInterfaceName,
      },
      attachment: [
        {
          instance: paInstance.instanceResource.id,
          deviceIndex: 1,
        },
      ],
    });
  }

  // Creates gateway load balancer resources for in the inspection subnet
  const gwLbResource = new Alb(stack, `palo-alto-inspection-gwlb`, {
    provider: stack.providerToChoose,
    name: 'palo-alto-inspection-gwlb',
    internal: false,
    loadBalancerType: 'gateway',
    subnets: stack.inspectionVpcConstruct.inspectionSubnetIds,
    enableCrossZoneLoadBalancing: true,
    enableHttp2: true,
    tags: {
      Name: 'palo-alto-inspection-gwlb',
    },
  });

  const gwLbTargetGroup = new AlbTargetGroup(
    stack,
    'palo-alto-inspection-gwlb-tg',
    {
      provider: stack.providerToChoose,
      name: 'palo-alto-inspection-gwlb',
      port: 6081,
      protocol: 'GENEVE',
      targetType: 'instance',
      vpcId: stack.inspectionVpcConstruct.vpcId,
      tags: {
        Name: 'palo-alto-inspection-gwlb',
      },
      healthCheck: {
        timeout: 5,
        interval: 30,
        port: '80',
        protocol: 'TCP',
      },
      lifecycle: {
        createBeforeDestroy: true,
      },
    }
  );

  new AlbListener(stack, 'palo-alto-inspection-gwlb-listener', {
    provider: stack.providerToChoose,
    loadBalancerArn: gwLbResource.arn,
    defaultAction: [
      {
        type: 'forward',
        targetGroupArn: gwLbTargetGroup.arn,
      },
    ],
    tags: {
      Name: 'palo-alto-inspection-gwlb',
    },
  });

  new AlbTargetGroupAttachment(
    stack,
    'palo-alto-inspection-gwlb-tg-attachment',
    {
      provider: stack.providerToChoose,
      targetGroupArn: gwLbTargetGroup.arn,
      targetId: paInstanceIds[0],
    }
  );

  if (paConfig.r53Records.length > 1) {
    new AlbTargetGroupAttachment(
      stack,
      'palo-alto-inspection-gwlb-tg-attachment-2',
      {
        provider: stack.providerToChoose,
        targetGroupArn: gwLbTargetGroup.arn,
        targetId: paInstanceIds[1],
      }
    );
  }

  // Creates the gateway load balancer vpc endpoint service in the inspection vpc
  const gwLbEndpointService = new VpcEndpointService(
    stack,
    'palo-alto-inspection-gw-lb-vpce-service',
    {
      dependsOn: [gwLbResource, gwLbTargetGroup],
      provider: stack.providerToChoose,
      acceptanceRequired: false,
      gatewayLoadBalancerArns: [gwLbResource.arn],
      tags: {
        Name: 'palo-alto-inspection-gwlb',
      },
    }
  );

  // Creates a gwlb vpc endpoint for each gwlb vpc endpoint subnet
  const gwlbVpcEndpoints = stack.inspectionVpcConstruct.gwlbVpceSubnetIds.map(
    (subnetId, index) => {
      return new VpcEndpoint(stack, `palo-alto-inspection-gwlb-vpce-${index}`, {
        dependsOn: [gwLbEndpointService],
        provider: stack.providerToChoose,
        serviceName: gwLbEndpointService.serviceName,
        subnetIds: [subnetId],
        vpcId: stack.inspectionVpcConstruct.vpcId,
        vpcEndpointType: 'GatewayLoadBalancer',
        tags: {
          Name: `palo-alto-inspection-gwlb-vpce-${index + 1}`,
        },
      });
    }
  );

  // If bypassInspection is false create a default route that points to the gwlb vpc endpoint in the inspection vpc
  if (!paConfig.bypassInspection) {
    stack.inspectionVpcConstruct.inspectionTransitSubnetRouteTables.forEach(
      (transitRtb, index) => {
        new Route(stack, `transitSubnetToGwlbVpcEndpoint-${index}`, {
          provider: stack.providerToChoose,
          routeTableId: transitRtb.id,
          destinationCidrBlock: '0.0.0.0/0',
          vpcEndpointId: gwlbVpcEndpoints[index].id,
        });
      }
    );
  }
}
