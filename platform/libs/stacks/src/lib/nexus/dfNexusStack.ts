import { Alb } from '@cdktf/provider-aws/lib/alb';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DfSpokeVpcConstruct, DfEcsConstruct, DfToolsVpcConstruct } from '@dragonfly/constructs';
import { Constants, Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { DfEfsConstruct } from '@dragonfly/constructs';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';

export interface DfNexusStackConfig {
  spokeVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  targetGroupArn: string;
  albSgId: string;
}

/**
 *
 */
export class DfNexusStack extends RemoteStack {
  private _nexusEcsConstruct: DfEcsConstruct;
  private _nexusALB: Alb;
  private _nexusTaskSG: SecurityGroup;
  private _nexusEfsSG: SecurityGroup;
  private nexusEfs: DfEfsConstruct;

  /**
   *
   * @param {string} stackName
   * @param {StackConfig} stackConfig
   * @param {DfNexusStackConfig} nexusConfig
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private nexusConfig: DfNexusStackConfig
  ) {
    super(stackName, stackConfig);

    this._nexusTaskSG = new SecurityGroup(
      this,
      Utils.createStackResourceId(this.stackUuid, 'nexusSg'),
      {
        name: 'nexusSg',
        vpcId: this.nexusConfig.spokeVpc.vpcId,
        ingress: [
          {
            fromPort: 8081,
            toPort: 8081,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow inbound Nexus traffic',
          },
        ],
        egress: [
          {
            description: 'Allow ephemeral',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
          },
        ],
        tags: {
          Name: 'nexusSg',
        },
      }
    );

    const currRegion = new DataAwsRegion(
      this,
      Utils.createStackResourceId(this.stackUuid, 'currRegion')
    );

    this.nexusEfs = new DfEfsConstruct(this, 'Nexus', {
      securityGroups: [this._nexusTaskSG.id],
      cidrBlocks: [this.nexusConfig.spokeVpc.vpcCidrBlock],
      vpc: this.nexusConfig.spokeVpc,
      forContainer: true,
      accessPoints: [
        {
          posixUser: {
            gid: 200,
            uid: 200,
          },
          rootDirectory: {
            path: '/nexus-data',
            creationInfo: {
              ownerGid: 200,
              ownerUid: 200,
              permissions: '755',
            },
          },
        },
      ],
    });

    const nexusLogGroup = new CloudwatchLogGroup(this, 'nexusLogGroup', {
      name: 'nexusLogGroup',
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        this.stackConfig.federatedAccountId
      )
        ? 365
        : 30,
      tags: { Name: 'nexus' },
    });

    const nexusEcsTaskRolePolicy = new IamPolicy(this, 'NexusTaskPolicy', {
      name: 'NexusTaskPolicy',
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['kms:Decrypt'],
            Resource: ['*'],
          },
          {
            Effect: 'Allow',
            Action: [
              'elasticfilesystem:ClientWrite',
              'elasticfilesystem:ClientRootAccess',
            ],
            Resource: [`${this.nexusEfs.efsArn}`],
          },
        ],
      }),
      tags: { Name: 'nexus-ecs-task' },
    });

    const nexusEcsTaskRole = new IamRole(this, `nexusEcsTaskRole`, {
      name: `NexusTaskRole`,
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
            Effect: 'Allow',
          },
        ],
      }),
      tags: { Name: 'nexus-ecs-task' },
    });

    new IamRolePolicyAttachment(this, 'NexusTaskRoleAttachment', {
      policyArn: nexusEcsTaskRolePolicy.arn,
      role: nexusEcsTaskRole.name,
    });

    this._nexusEcsConstruct = new DfEcsConstruct(this, 'nexusFargate', {
      clusterConfig: {
        clusterName: `${this.stackConfig.envName}-nexusCluster`,
        clusterConfiguration: {
          execute_command_configuration: {
            logging: 'OVERRIDE',
            log_configuration: {
              cloud_watch_log_group_name: nexusLogGroup.name,
            },
          },
        },
        clusterSettings: {
          name: 'containerInsights',
          value: 'enabled',
        },
      },
      volumeConfig: [
        {
          name: 'nexus-data',
          efsVolumeConfiguration: {
            fileSystemId: this.nexusEfs.efsId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: this.nexusEfs.accessPointIds[0],
              iam: 'ENABLED',
            },
          },
        },
      ],
      taskConfig: {
        taskName: 'nexus',
        taskRoleArn: nexusEcsTaskRole.arn,
        containerDef: JSON.stringify([
          {
            name: 'nexus',
            image: 'sonatype/nexus3:latest',
            cpu: 4096,
            memory: 8192,
            memoryReservation: 8192,
            essential: true,
            ulimits: [
              {
                name: 'nofile',
                softLimit: 65536,
                hardLimit: 65536,
              },
            ],
            environment: [
              {
                name: 'NEXUS_SECURITY_RANDOMPASSWORD',
                value: 'false',
              },
            ],
            mountPoints: [
              {
                sourceVolume: 'nexus-data',
                containerPath: '/nexus-data',
              },
            ],
            portMappings: [
              {
                containerPort: 8081,
                hostPort: 8081,
                protocol: 'tcp',
              },
            ],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': nexusLogGroup.name,
                'awslogs-region': currRegion.name,
                'awslogs-stream-prefix': 'nexus',
              },
            },
          },
        ]),
        subnets: this.nexusConfig.spokeVpc.appSubnetIds,
        securityGroups: [this._nexusTaskSG],
        cpu: '4096',
        memory: '8192',
        launchType: 'FARGATE',
      },
      loadBalancerConfig: {
        targetGroupMap: [
          {
            port: 8081,
            targetGroupArn: nexusConfig.targetGroupArn,
          },
        ],
      },
    });
  }

  /**
   * @return {Alb} Nexus ALB DNS name
   */
  public get nexusALBResource(): Alb {
    return this._nexusALB;
  }

  /**
   * @return {DfEcsConstruct} Nexus Ecs Construct
   */
  public get nexusEfsConstruct(): DfEfsConstruct {
    return this.nexusEfs;
  }
}
