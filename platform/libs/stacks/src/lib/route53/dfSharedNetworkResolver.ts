import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { RemoteStack, StackConfig } from '../stacks';
import { DfGatewayVpcConstruct } from '@dragonfly/constructs';
import { Route53ResolverEndpoint } from '@cdktf/provider-aws/lib/route53-resolver-endpoint';
import { Route53ResolverRule } from '@cdktf/provider-aws/lib/route53-resolver-rule';
import { Fn } from 'cdktf';
import { Route53ResolverRuleAssociation } from '@cdktf/provider-aws/lib/route53-resolver-rule-association';

interface DfSharedNetworkResolverConfig {
  vpcs: {
    legacy: DfGatewayVpcConstruct;
    primary: DfGatewayVpcConstruct;
    recovery: DfGatewayVpcConstruct;
  };
}

/**
 * @description This Stack is used to create R53 Resolvers for the Shared Network DHCP Options Set Domain Names
 */
export class DfSharedNetworkResolver extends RemoteStack {
  /**
   *
   * @param {string} stackId - The Stack ID
   * @param {StackConfig} stackConfig - The Stack Config
   * @param {DfSharedNetworkResolverConfig} config - The config for DfSharedNetworkResolver
   */
  constructor(
    stackId: string,
    stackConfig: StackConfig,
    config: DfSharedNetworkResolverConfig
  ) {
    super(stackId, stackConfig);

    const configMap = [
      {
        provider: null,
        vpc: config.vpcs.legacy,
        dhcpDomainName: 'ec2.internal',
      },
      {
        provider: this.primaryProvider,
        vpc: config.vpcs.primary,
        dhcpDomainName: 'us-east-2.compute.internal',
      },
      {
        provider: this.recoveryProvider,
        vpc: config.vpcs.recovery,
        dhcpDomainName: 'us-west-2.compute.internal',
      },
    ];

    configMap.forEach((outterObj, index) => {
      const sg = new SecurityGroup(this, `outbound-resolver-sg-${index}`, {
        provider: outterObj.provider,
        name: 'cvpn-resolver',
        vpcId: outterObj.vpc.vpcId,
        ingress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow DNS queries to the outbound resolver',
          },
        ],
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow all outbound traffic',
          },
        ],
        tags: {
          Name: 'cvpn-resolver',
        },
      });

      const resolver = new Route53ResolverEndpoint(
        this,
        `outbound-resolver-${index}`,
        {
          provider: outterObj.provider,
          name: 'cvpn-resolver',
          direction: 'OUTBOUND',
          securityGroupIds: [sg.id],
          ipAddress: [
            {
              subnetId: outterObj.vpc.archReservedSubnetIds[0],
            },
            {
              subnetId: outterObj.vpc.archReservedSubnetIds[1],
            },
            {
              subnetId: outterObj.vpc.archReservedSubnetIds[2],
            },
          ],
          tags: { Name: 'cvpn-resolver' },
        }
      );

      configMap.forEach((innerObj, i) => {
        if (outterObj.provider != innerObj.provider) {
          const resolverRule = new Route53ResolverRule(
            this,
            `outbound-resolver-rule-${index}-${i}`,
            {
              provider: outterObj.provider,
              domainName: innerObj.dhcpDomainName,
              name: `${innerObj.dhcpDomainName.replace(/\./g, '-')}-resolver`,
              ruleType: 'FORWARD',
              resolverEndpointId: resolver.id,
              targetIp: [
                {
                  ip: Fn.cidrhost(innerObj.vpc.vpcCidrBlock, 2),
                  port: 53,
                },
              ],
              tags: {
                Name: `${innerObj.dhcpDomainName.replace(/\./g, '-')}-resolver`,
              },
            }
          );

          new Route53ResolverRuleAssociation(
            this,
            `outbound-resolver-rule-association-${index}-${i}`,
            {
              provider: outterObj.provider,
              resolverRuleId: resolverRule.id,
              vpcId: outterObj.vpc.vpcId,
            }
          );
        }
      });
    });
  }
}
