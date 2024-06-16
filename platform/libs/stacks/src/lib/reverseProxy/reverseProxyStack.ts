import {
  SecurityGroup,
  SecurityGroupConfig,
} from '@cdktf/provider-aws/lib/security-group';
import {
  DfAliasedKeyConstruct,
  DfIsolatedVpcConstruct,
  DfSpokeVpcConstruct,
} from '@dragonfly/constructs';
import { EcsClusterCapacityProviders } from '@cdktf/provider-aws/lib/ecs-cluster-capacity-providers';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { AssetType, Fn, TerraformAsset } from 'cdktf';
import path from 'path';
import { RemoteStack, StackConfig } from '../stacks';
import { provider as LocalProvider } from '@cdktf/provider-local';
import { file as FileResource } from '@cdktf/provider-local';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition';
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service';

type VpcConstruct =
  | DfSpokeVpcConstruct
  | DfIsolatedVpcConstruct;

export type ReverseProxyStackConfig = {
  clusterVpcConstruct: VpcConstruct;
  subnetIds?: string[];
  rpListeningPort: number;
  dockerPushRoleAssumption: string;
  targetGroupArn: string;
  imageName: string;
  securityGroupConfig?: SecurityGroupConfig;
  region?: Constants.AWS_REGION_ALIASES;
  assetsPath?: string;
  templateRelativePath?: string;
  renderedTemplatePath?: string;
  accountNumber?: string;
  subDomain: string;
  desiredCount?: number;
  sopsData?: PlatformSecrets;
  includeDatadogAgent?: boolean;
};

/**
 *
 */
export class DfReverseProxyStack extends RemoteStack {
  private assetsPath: string;
  private templatePath: string;
  private renderedPath: string;
  private _logGroup: CloudwatchLogGroup;
  /**
   *
   * @param {string}stackName
   * @param {StackConfig}stackConfig
   * @param {ReverseProxyStackConfig}config
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private config: ReverseProxyStackConfig
  ) {
    super(stackName, stackConfig);

    this.assetsPath = config.assetsPath ?? 'docker/ingressVpc';
    this.templatePath = config.templateRelativePath ?? 'files/nginx.conf.tftpl';
    this.renderedPath = config.renderedTemplatePath ?? 'files/nginx.conf';

    const rpTaskSG = new SecurityGroup(
      this,
      Utils.createStackResourceId(this.stackUuid, 'securityGroup'),
      config.securityGroupConfig ?? this.defaultSgConfig
    );

    const dockerAssets = new TerraformAsset(
      this,
      Utils.createStackResourceId(this.stackUuid, 'Dockerfile'),
      {
        path: path.resolve(__dirname, this.assetsPath),
        type: AssetType.DIRECTORY,
      }
    );

    const template = Fn.templatefile(
      `${dockerAssets.path}/${this.templatePath}`,
      {
        listeningPort: this.config.rpListeningPort,
        serverName: `${config.subDomain}.dragonflyft.com`,
        cidr: this.config.clusterVpcConstruct.vpcCidrBlock,
      }
    );

    new LocalProvider.LocalProvider(this, 'LocalProvider');

    const currRegion = new DataAwsRegion(
      this,
      Utils.createStackResourceId(this.stackUuid, 'currRegion')
    );

    new NullProvider(
      this,
      Utils.createStackResourceId(this.stackUuid, 'NullProvider')
    );

    // Use account number that is passed on or default to tools account
    const ecrAccountNumber = config.accountNumber
      ? config.accountNumber
      : Constants.ACCOUNT_NUMBER_TOOLS;

    const ecrRepoUrl = `${ecrAccountNumber}.dkr.ecr.${
      Constants.AWS_REGION_MAP[
        this.config.region ?? Constants.AWS_REGION_ALIASES.LEGACY
      ]
    }.amazonaws.com/${this.config.imageName}`;

    if (process.env.DOCKER_BUILDS_ENABLED === 'true') {
      const renderedTemplate = new FileResource.File(
        this,
        Utils.createStackResourceId(this.stackUuid, 'nginxConf'),
        {
          content: template,
          filename: `${dockerAssets.path}/${this.renderedPath}`,
        }
      );

      new Resource(
        this,
        Utils.createStackResourceId(this.stackUuid, 'buildAndPushRPImage'),
        {
          triggers: {
            nginx_src_hash: Fn.file(
              `${dockerAssets.path}/${this.templatePath}`
            ),
            docker_src_hash: Fn.file(`${dockerAssets.path}/Dockerfile`),
          },

          dependsOn: [renderedTemplate],

          provisioners: [
            {
              type: 'local-exec',
              workingDir: dockerAssets.path,
              command: `
             ${this.config.dockerPushRoleAssumption}
             aws sts get-caller-identity
             aws ecr get-login-password --region ${currRegion.name} |
             docker login --username AWS --password-stdin ${ecrRepoUrl} &&
             docker buildx build --platform=linux/amd64 -t ${ecrRepoUrl}:latest . &&
             docker push ${ecrRepoUrl}:latest
             `,
            },
          ],
        }
      );
    }

    const rpEcsCluster = new EcsCluster(
      this,
      Utils.createStackResourceId(this.stackUuid, 'ecsCluster'),
      {
        name: stackName,
        tags: {
          Name: stackName,
        },
        setting: [
          {
            name: 'containerInsights',
            value: 'enabled',
          },
        ],
      }
    );

    new EcsClusterCapacityProviders(
      this,
      Utils.createStackResourceId(this.stackUuid, 'nonSpotProvider'),
      {
        clusterName: rpEcsCluster.name,
        capacityProviders: ['FARGATE'],
      }
    );

    const rpCloudWatchKmsKey = new DfAliasedKeyConstruct(
      this,
      Utils.createStackResourceId(this.stackUuid, 'cloudWatchKmsKey'),
      {
        name: stackName,
        description: 'Reverse Proxy CloudWatch Kms Key',
      }
    );
    rpCloudWatchKmsKey.key.addOverride(
      'policy',
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'Enable IAM User Permissions',
            Effect: 'Allow',
            Principal: {
              AWS: `arn:aws:iam::${this.stackConfig.federatedAccountId}:root`,
            },
            Action: 'kms:*',
            Resource: '*',
          },
          {
            Sid: 'Allow CloudWatch',
            Effect: 'Allow',
            Principal: {
              Service: [`logs.${currRegion.name}.amazonaws.com`],
            },
            Action: [
              'kms:Encrypt*',
              'kms:Decrypt*',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:Describe*',
            ],
            Resource: '*',
          },
        ],
      })
    );

    this._logGroup = new CloudwatchLogGroup(
      this,
      Utils.createStackResourceId(this.stackUuid, 'logGroup'),
      {
        name: stackName,
        retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
          this.stackConfig.federatedAccountId
        )
          ? 365
          : 30,
        kmsKeyId: rpCloudWatchKmsKey.arn,
        tags: {
          Name: stackName,
        },
      }
    );

    const rpEcsExecutionIamRole = new IamRole(
      this,
      Utils.createStackResourceId(this.stackUuid, 'ecsExecutionIamRole'),
      {
        name: stackName,
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
        tags: { Name: stackName },
      }
    );

    const rpEcsExecutionIamPolicy = new IamPolicy(
      this,
      Utils.createStackResourceId(this.stackUuid, 'ecsExecutionIamPolicy'),
      {
        name: stackName,
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Action: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'logs:CreateLogStream',
                'logs:CreateLogGroup',
                'logs:PutLogEvents',
              ],
              Resource: '*',
              Effect: 'Allow',
            },
          ],
        }),
        lifecycle: {
          createBeforeDestroy: true,
        },
        tags: { Name: stackName },
      }
    );

    new IamRolePolicyAttachment(
      this,
      Utils.createStackResourceId(
        this.stackUuid,
        'ecsExecutionRolePolicyAttachment'
      ),
      {
        policyArn: rpEcsExecutionIamPolicy.arn,
        role: rpEcsExecutionIamRole.name,
      }
    );

    /**
     * ECS configuration
     */
    const containerDefinitions = [
      {
        name: stackName,
        image: `${ecrRepoUrl}:latest`,
        cpu: 2048,
        memory: 4096,
        memoryReservation: 4096,
        essential: true,
        portMappings: [
          {
            containerPort: 80,
          },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': this._logGroup.name,
            'awslogs-region': currRegion.name,
            'awslogs-stream-prefix': 'reverseProxy',
          },
        },
        ...(config.includeDatadogAgent
          ? {
              dockerLabels: {
                'com.datadoghq.ad.check_names': '["nginx"]',
                'com.datadoghq.ad.init_configs': '[{}]',
                'com.datadoghq.ad.instances':
                  '[{"nginx_status_url":"http://%%host%%:81/nginx_status/"}]',
                'com.datadoghq.ad.logs':
                  '[{"source":"nginx","service":"nginx"}]',
              },
            }
          : {}),
      },
      {
        ...(config.includeDatadogAgent
          ? {
              name: `${stackName}-datadog-agent`,
              image: 'public.ecr.aws/datadog/agent:latest',
              cpu: 256,
              memory: 512,
              logConfiguration: {
                logDriver: 'awslogs',
                options: {
                  'awslogs-group': new CloudwatchLogGroup(
                    this,
                    'datadog-agent-log-group',
                    {
                      name: `${stackName}-datadog-agent`,
                      retentionInDays:
                        Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
                          this.stackConfig.federatedAccountId
                        )
                          ? 365
                          : 30,
                      kmsKeyId: rpCloudWatchKmsKey.arn,
                      tags: {
                        Name: `${stackName}-datadog`,
                      },
                    }
                  ).name,
                  'awslogs-region': currRegion.name,
                  'awslogs-stream-prefix': 'datadog-agent',
                },
              },
              environment: [
                {
                  name: 'DD_API_KEY',
                  value: this.config.sopsData.DD_API_KEY,
                },
                {
                  name: 'ECS_FARGATE',
                  value: 'true',
                },
                {
                  name: 'DD_LOGS_ENABLED',
                  value: 'true',
                },
                {
                  name: 'DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL',
                  value: 'true',
                },
              ],
            }
          : {}),
      },
    ];

    const rpTaskDefinition = new EcsTaskDefinition(
      this,
      Utils.createStackResourceId(this.stackUuid, 'TaskDefinition'),
      {
        family: 'rpTaskDefinition',
        executionRoleArn: rpEcsExecutionIamRole.arn,
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: '4096',
        memory: '8192',
        containerDefinitions: JSON.stringify(containerDefinitions),
        tags: {
          Name: stackName,
        },
      }
    );

    new EcsService(
      this,
      Utils.createStackResourceId(this.stackUuid, 'Service'),
      {
        name: stackName,
        cluster: rpEcsCluster.id,
        desiredCount: config.desiredCount ?? 1,
        launchType: 'FARGATE',
        taskDefinition: rpTaskDefinition.arn,
        networkConfiguration: {
          subnets: config.subnetIds ?? config.clusterVpcConstruct.appSubnetIds,
          assignPublicIp: false,
          securityGroups: [rpTaskSG.id],
        },
        loadBalancer: [
          {
            containerPort: 80,
            containerName: stackName,
            targetGroupArn: config.targetGroupArn,
          },
        ],
        healthCheckGracePeriodSeconds: 300,
        tags: { Name: stackName },
      }
    );
  }

  /**
   * @return {SecurityGroupConfig}
   */
  private get defaultSgConfig(): SecurityGroupConfig {
    return {
      name: this.stackName,
      vpcId: this.config.clusterVpcConstruct.vpcId,
      ingress: [
        {
          description: 'Allow Cloudfront',
          fromPort: 443,
          toPort: 443,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
        {
          description: 'Allow Cloudfront',
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      egress: [
        {
          description: 'Allow all egress traffic',
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      tags: { Name: this.stackName },
    };
  }

  /**
   * @return {CloudwatchLogGroup}
   */
  public get logGroup(): CloudwatchLogGroup {
    return this._logGroup;
  }
}
