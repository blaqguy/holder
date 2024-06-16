import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service';
import {
  EcsTaskDefinition,
  EcsTaskDefinitionVolume,
} from '@cdktf/provider-aws/lib/ecs-task-definition';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Ecs, EcsConfig } from '@dragonfly/generated';
import { Construct } from 'constructs';
import { DfIamRoleConstruct } from '../constructs';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DfEcsConstructConfig {
  clusterConfig: EcsConfig;
  taskConfig: {
    taskName: string;
    containerDef: string;
    subnets: string[];
    securityGroups: SecurityGroup[];
    cpu: string;
    memory: string;
    launchType: string;
    taskRoleArn?: string;
  };
  loadBalancerConfig: {
    targetGroupMap: {
      port: number;
      targetGroupArn: string;
    }[];
  };
  volumeConfig?: EcsTaskDefinitionVolume[];
  provider?: AwsProvider;
}

/**
 *
 */
export class DfEcsConstruct extends Construct {
  /**
   *
   * @param {Construct} scope "The parent stack"
   * @param {string} constructName "Construct name"
   * @param {DfEcsConstructConfig} dfEcsConstructConfig "Construct config"
   */
  constructor(
    private scope: Construct,
    private constructName: string,
    protected dfEcsConstructConfig: DfEcsConstructConfig
  ) {
    super(scope, constructName);

    // EcsCluster
    const taskCluster = new Ecs(
      this,
      `${this.dfEcsConstructConfig.taskConfig.taskName}Cluster`,
      this.dfEcsConstructConfig.clusterConfig
    );

    // IamRole - ECS Assume Role
    const executionRoleConstruct = new DfIamRoleConstruct(this, {
      provider: this.dfEcsConstructConfig.provider,
      roleName: `${this.dfEcsConstructConfig.taskConfig.taskName}ExecutionRole`,
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(
          this,
          `${this.dfEcsConstructConfig.taskConfig.taskName}ExecutionPermsDoc`,
          {
            provider: this.dfEcsConstructConfig.provider,
            statement: [
              {
                actions: [
                  'ecr:GetAuthorizationToken',
                  'ecr:BatchCheckLayerAvailability',
                  'ecr:GetDownloadUrlForLayer',
                  'ecr:BatchGetImage',
                  'logs:CreateLogStream',
                  'logs:CreateLogGroup',
                  'logs:PutLogEvents',
                  'kms:Decrypt',
                  'secretsmanager:GetSecretValue',
                ],
                resources: ['*'],
                effect: 'Allow',
              },
            ],
          }
        ),
      ],
      assumptionDocument: new DataAwsIamPolicyDocument(
        this,
        `${this.dfEcsConstructConfig.taskConfig.taskName}ExecutionAssumptionDoc`,
        {
          provider: this.dfEcsConstructConfig.provider,
          statement: [
            {
              actions: ['sts:AssumeRole'],
              principals: [
                {
                  type: 'Service',
                  identifiers: ['ecs-tasks.amazonaws.com'],
                },
              ],
              effect: 'Allow',
            },
          ],
        }
      ),
    });
    // EcsTaskDefinition
    const taskDefinition = new EcsTaskDefinition(
      this,
      `${this.dfEcsConstructConfig.taskConfig.taskName}TaskDef`,
      {
        provider: this.dfEcsConstructConfig.provider,
        family: `${this.dfEcsConstructConfig.taskConfig.taskName}TaskDef`,
        taskRoleArn:
          this.dfEcsConstructConfig.taskConfig.taskRoleArn ||
          executionRoleConstruct.role.arn,
        executionRoleArn: executionRoleConstruct.role.arn,
        networkMode: 'awsvpc',
        requiresCompatibilities: [
          this.dfEcsConstructConfig.taskConfig.launchType,
        ],
        cpu: this.dfEcsConstructConfig.taskConfig.cpu,
        memory: this.dfEcsConstructConfig.taskConfig.memory,
        containerDefinitions: this.dfEcsConstructConfig.taskConfig.containerDef,
        volume: this.dfEcsConstructConfig.volumeConfig || null,
        tags: { Name: this.dfEcsConstructConfig.taskConfig.taskName },
      }
    );

    // EcsService
    new EcsService(
      this,
      `${this.dfEcsConstructConfig.taskConfig.taskName}Service`,
      {
        provider: this.dfEcsConstructConfig.provider,
        name: `${this.dfEcsConstructConfig.taskConfig.taskName}Service`,
        cluster: taskCluster.clusterIdOutput,
        desiredCount: 1,
        launchType: this.dfEcsConstructConfig.taskConfig.launchType,
        taskDefinition: taskDefinition.arn,
        networkConfiguration: {
          subnets: this.dfEcsConstructConfig.taskConfig.subnets,
          assignPublicIp: false,
          securityGroups:
            this.dfEcsConstructConfig.taskConfig.securityGroups.map((sg) => {
              return sg.id;
            }),
        },
        loadBalancer:
          this.dfEcsConstructConfig.loadBalancerConfig.targetGroupMap.map(
            (obj) => {
              return {
                containerPort: obj.port,
                containerName: this.dfEcsConstructConfig.taskConfig.taskName,
                targetGroupArn: obj.targetGroupArn,
              };
            }
          ),
        healthCheckGracePeriodSeconds: 300,
        tags: { Name: this.dfEcsConstructConfig.taskConfig.taskName },
      }
    );
  }
}
