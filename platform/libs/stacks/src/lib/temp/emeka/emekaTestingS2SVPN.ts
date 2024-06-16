/* eslint-disable no-useless-escape */
import { Vpc } from '@cdktf/provider-aws/lib/vpc';
import { RemoteStack, StackConfig } from '../../stacks';
import { Subnet } from '@cdktf/provider-aws/lib/subnet';
import { DataAwsAvailabilityZones } from '@cdktf/provider-aws/lib/data-aws-availability-zones';
import { RouteTable } from '@cdktf/provider-aws/lib/route-table';
import { RouteTableAssociation } from '@cdktf/provider-aws/lib/route-table-association';
import { InternetGateway } from '@cdktf/provider-aws/lib/internet-gateway';
import { Route } from '@cdktf/provider-aws/lib/route';
import { Instance } from '@cdktf/provider-aws/lib/instance';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamInstanceProfile } from '@cdktf/provider-aws/lib/iam-instance-profile';
import { Fn } from 'cdktf';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { FlowLog } from '@cdktf/provider-aws/lib/flow-log';

interface EmekaTestingS2SVPNConfig {
  stackName: string;
  stackConfig: StackConfig;
  sourceCidr: string;
}

/**
 * Please see readme file for more information on how to configure OpenSwan (LibreSwan) on AWS
 */
export class EmekaTestingS2SVPN extends RemoteStack {
  constructor(config: EmekaTestingS2SVPNConfig) {
    super(config.stackName, config.stackConfig);

    const vpc = new Vpc(this, 'emeka-testing-vpc', {
      cidrBlock: '10.200.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Name: 'emeka-testing-pc',
      },
    });

    const flowLogRole = new IamRole(this, 'flowLogRole', {
      name: 'emeka-test-flowlog-role',
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'vpc-flow-logs.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
      tags: { Name: 'emeka-test-flowlog-role' },
    });

    new IamRolePolicy(this, 'emeka-testing-flow-log-policy', {
      name: 'emeka-testing-flow-log-policy',
      role: flowLogRole.id,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'logs:DescribeLogGroups',
              'logs:DescribeLogStreams',
            ],
            Resource: '*',
          },
        ],
      }),
    });

    const flowLogGroup = new CloudwatchLogGroup(
      this,
      'emeka-testing-flow-log-group',
      {
        name: 'emeka-testing-flow-log-group',
        retentionInDays: 1,
        tags: { Name: 'emeka-testing-flow-log-group' },
      }
    );

    new FlowLog(this, 'emeka-testing-flow-log', {
      iamRoleArn: flowLogRole.arn,
      logDestination: flowLogGroup.arn,
      logDestinationType: 'cloud-watch-logs',
      trafficType: 'ALL',
      vpcId: vpc.id,
      tags: { Name: 'emeka-testing-flow-log' },
    });

    const availabilityZones = new DataAwsAvailabilityZones(this, 'azs', {
      state: 'available',
    });

    const publicSubnet = new Subnet(this, 'emeka-testing-public-subnet', {
      vpcId: vpc.id,
      cidrBlock: '10.200.0.0/20',
      availabilityZone: Fn.element(availabilityZones.names, 0),
      mapPublicIpOnLaunch: true,
      tags: {
        Name: 'emeka-testing-public-subnet',
      },
    });

    const publicRouteTable = new RouteTable(
      this,
      'emeka-testing-public-route-table',
      {
        vpcId: vpc.id,
        tags: {
          Name: 'emeka-testing-public-route-table',
        },
      }
    );

    new RouteTableAssociation(
      this,
      'emeka-testing-public-route-table-association',
      {
        routeTableId: publicRouteTable.id,
        subnetId: publicSubnet.id,
      }
    );

    const igw = new InternetGateway(this, 'emeka-testing-igw', {
      vpcId: vpc.id,
      tags: {
        Name: 'emeka-testing-igw',
      },
    });

    new Route(this, 'emeka-testing-igw-route', {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id,
    });

    const ec2Role = new IamRole(this, 'emeka-testing-ec2-role', {
      name: 'emeka-testing-ec2-role',
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
      ],
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
    });

    const ec2InstanceProfile = new IamInstanceProfile(
      this,
      'emeka-testing-ec2-instance-profile',
      {
        name: 'emeka-testing-ec2-instance-profile',
        role: ec2Role.name,
      }
    );

    const sg = new SecurityGroup(this, 'emeka-testing-backend-ec2-sg', {
      vpcId: vpc.id,
      name: 'emeka-testing-backend-ec2-sg',
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: [config.sourceCidr, vpc.cidrBlock],
        },
        {
          fromPort: -1,
          toPort: -1,
          protocol: 'ICMP',
          cidrBlocks: [config.sourceCidr, vpc.cidrBlock],
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
      tags: {
        Name: 'emeka-testing-backend-ec2-sg',
      },
    });

    /**
     * Watch this youtube video to learn how to configure OpenSwan (LibreSwan) on AWS
     * https://www.youtube.com/watch?v=8x0QCFuzQx4
     */
    const ec2 = new Instance(this, 'emeka-testing-open-swan-ec2', {
      associatePublicIpAddress: true,
      ami: 'ami-0c101f26f147fa7fd',
      instanceType: 't3.medium',
      iamInstanceProfile: ec2InstanceProfile.name,
      subnetId: publicSubnet.id,
      vpcSecurityGroupIds: [sg.id],
      rootBlockDevice: {
        volumeSize: 50,
        volumeType: 'gp3',
        tags: {
          Name: 'emeka-testing-open-swan-ec2',
        },
      },
      sourceDestCheck: false,
      userData: `#!/bin/bash
      sudo start amazon-ssm-agent
      sudo yum update -y

      sudo yum install libreswan -y
      
      sudo echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
      sudo echo "net.ipv4.conf.default.rp_filter = 0" >> /etc/sysctl.conf
      sudo echo "net.ipv4.conf.default.accept_source_route = 0" >> /etc/sysctl.conf
      sysctl -p      
        `,
      tags: {
        Name: 'emeka-testing-open-swan-ec2',
      },
    });

    new Route(this, 'emeka-testing-gateway-to-openswan', {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: config.sourceCidr,
      networkInterfaceId: ec2.primaryNetworkInterfaceId,
    });
  }
}
