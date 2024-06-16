import { Ecs } from '@dragonfly/generated';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants, Utils } from '@dragonfly/utils';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import {
  DfAliasedKeyConstruct,
  DfPrivateBucketConstruct,
} from '@dragonfly/constructs';
import { AssetType, Fn, TerraformAsset } from 'cdktf';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import path from 'path';
import { DataAwsIamRole } from '@cdktf/provider-aws/lib/data-aws-iam-role';

export interface GitHubRunnerStackProps {
  region: Constants.AWS_REGION_ALIASES;
  targetGroupArn: string;
  albSgId: string;
  subnetIds: string[];
  assets: {
    assetsPath: string;
    imageName: string;
    dockerPushRoleAssumption: string;
  };
}
/**
 *
 */
export class GitHubRunnerStack extends RemoteStack {
  private static readonly STACK_NAME = 'GitHubRunnerStack';

  /**
   *
   * @param {StackConfig} stackConfig
   * @param {GitHubRunnerStackProps} stackProps
   */
  constructor(
    public readonly stackConfig: StackConfig,
    private stackProps: GitHubRunnerStackProps
  ) {
    super(GitHubRunnerStack.STACK_NAME, stackConfig);

    new DfPrivateBucketConstruct(
      this,
      Utils.createStackResourceId(this.stackUuid, 'self-service-bucket'),
      {
        bucketName: `dft-${this.stackConfig.envName}-self-service`,
        bucketConfigOverride: {
          bucket: `dft-${this.stackConfig.envName}-self-service`,
          serverSideEncryptionConfiguration: {
            rule: {
              applyServerSideEncryptionByDefault: {
                sseAlgorithm: 'aws:kms',
              },
              bucketKeyEnabled: true,
            },
          },
          tags: {
            Name: `dft-${this.stackConfig.envName}-self-service`,
          },
        },
      }
    );

    const dockerAssets = new TerraformAsset(
      this,
      Utils.createStackResourceId(this.stackUuid, 'Dockerfile'),
      {
        path: path.resolve(__dirname, this.stackProps.assets.assetsPath),
        type: AssetType.DIRECTORY,
      }
    );

    const currRegion = new DataAwsRegion(
      this,
      Utils.createStackResourceId(this.stackUuid, 'currRegion')
    );

    new NullProvider(
      this,
      Utils.createStackResourceId(this.stackUuid, 'NullProvider')
    );

    const ecrRepoUrl = `${Constants.ACCOUNT_NUMBER_TOOLS}.dkr.ecr.${
      Constants.AWS_REGION_MAP[
        this.stackProps.region ?? Constants.AWS_REGION_ALIASES.LEGACY
      ]
    }.amazonaws.com/${this.stackProps.assets.imageName}`;

    new Resource(
      this,
      Utils.createStackResourceId(this.stackUuid, 'buildAndPushRPImage'),
      {
        triggers: {
          docker_src_hash: Fn.file(`${dockerAssets.path}/Dockerfile`),
          entry_src_hash: Fn.file(`${dockerAssets.path}/entrypoint.sh`),
        },

        provisioners: [
          {
            type: 'local-exec',
            workingDir: dockerAssets.path,
            command: `
             ${this.stackProps.assets.dockerPushRoleAssumption}
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

    const cloudWatchKmsKey = new DfAliasedKeyConstruct(
      this,
      Utils.createStackResourceId(this.stackUuid, 'cloudWatchKmsKey'),
      {
        name: GitHubRunnerStack.STACK_NAME,
        description: 'GH Runner CloudWatch Kms Key',
      }
    );
    cloudWatchKmsKey.key.addOverride(
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
              Service: [
                `logs.${
                  Constants.AWS_REGION_MAP[this.stackProps.region]
                }.amazonaws.com`,
              ],
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

    const logGroup = new CloudwatchLogGroup(
      this,
      Utils.createStackResourceId(this.stackUuid, 'logGroup'),
      {
        name: 'gh-runner-log-group',
        retentionInDays: 30,
        kmsKeyId: cloudWatchKmsKey.arn,
        tags: {
          Name: GitHubRunnerStack.STACK_NAME,
        },
      }
    );
    const provisionRoleLookup = new DataAwsIamRole(
      this,
      'deployProvisionRoleLookup',
      {
        name: Constants.ROLE_PROVISION_ROLE_NAME,
      }
    ).arn;

    new Ecs(this, 'dfly-gh-runners', {
      clusterName: `${this.stackConfig.envName}-dfly-gh-runners`,

      services: {
        'gh-runner-plan-service': {
          cpu: 8192,
          memory: 16384,
          create_tasks_iam_role: false,
          tasks_iam_role_arn: provisionRoleLookup,
          desired_count: 7,
          enable_autoscaling: false,
          ephemeral_storage: {
            size_in_gib: 75,
          },
          container_definitions: {
            'gh-plan-pool': {
              cpu: 8192,
              memory: 16384,
              image: `${ecrRepoUrl}:latest`,
              readonly_root_filesystem: false,
              enable_cloudwatch_logging: true,
              log_configuration: {
                log_driver: 'awslogs',
                options: {
                  'awslogs-group': logGroup.name,
                  'awslogs-region':
                    Constants.AWS_REGION_MAP[this.stackProps.region],
                  'awslogs-stream-prefix': 'gh-runners',
                },
              },
              environment: [
                {
                  name: 'GITHUB_ACCESS_TOKEN',
                  value: Utils.getSecretsForNode(this.node)
                    .GITHUB_ACTIONS_RUNNER_TOKEN,
                },
                {
                  name: 'GITHUB_ACTIONS_RUNNER_CONTEXT',
                  value: 'https://github.com/dragonflyft/platform',
                },
                {
                  name: 'RUNNER_LABELS',
                  value: 'self-hosted,plan-pool',
                },
              ],
            },
          },

          subnet_ids: this.stackProps.subnetIds,
          security_group_rules: {
            egress_all: {
              type: 'egress',
              from_port: 0,
              to_port: 0,
              protocol: '-1',
              cidr_blocks: ['0.0.0.0/0'],
            },
          },
        },
        'gh-runner-deploy-service': {
          cpu: 16384,
          memory: 32768,
          create_tasks_iam_role: false,
          desired_count: 7,
          tasks_iam_role_arn: provisionRoleLookup,
          enable_autoscaling: false,
          ephemeral_storage: {
            size_in_gib: 75,
          },
          container_definitions: {
            'gh-deployment-pool': {
              cpu: 16384,
              memory: 32768,
              image: `${ecrRepoUrl}:latest`,
              readonly_root_filesystem: false,
              enable_cloudwatch_logging: true,
              log_configuration: {
                log_driver: 'awslogs',
                options: {
                  'awslogs-group': logGroup.name,
                  'awslogs-region':
                    Constants.AWS_REGION_MAP[this.stackProps.region],
                  'awslogs-stream-prefix': 'gh-runners',
                },
              },

              environment: [
                {
                  name: 'GITHUB_ACCESS_TOKEN',
                  value: Utils.getSecretsForNode(this.node)
                    .GITHUB_ACTIONS_RUNNER_TOKEN,
                },
                {
                  name: 'GITHUB_ACTIONS_RUNNER_CONTEXT',
                  value: 'https://github.com/dragonflyft/platform',
                },
                {
                  name: 'RUNNER_LABELS',
                  value: 'self-hosted,deployment-pool',
                },
              ],
            },
          },

          subnet_ids: this.stackProps.subnetIds,
          security_group_rules: {
            egress_all: {
              type: 'egress',
              from_port: 0,
              to_port: 0,
              protocol: '-1',
              cidr_blocks: ['0.0.0.0/0'],
            },
          },
        },
        'ansible-self-service': {
          cpu: 1024,
          memory: 2048,
          create_tasks_iam_role: false,
          desired_count: 1,
          tasks_iam_role_arn: provisionRoleLookup,
          enable_autoscaling: false,
          ephemeral_storage: {
            size_in_gib: 50,
          },
          container_definitions: {
            'ansible-templates-pool': {
              cpu: 1024,
              memory: 2048,
              image: `${ecrRepoUrl}:latest`,
              readonly_root_filesystem: false,
              enable_cloudwatch_logging: true,
              log_configuration: {
                log_driver: 'awslogs',
                options: {
                  'awslogs-group': logGroup.name,
                  'awslogs-region':
                    Constants.AWS_REGION_MAP[this.stackProps.region],
                  'awslogs-stream-prefix': 'gh-runners',
                },
              },

              environment: [
                {
                  name: 'GITHUB_ACCESS_TOKEN',
                  value: Utils.getSecretsForNode(this.node)
                    .GITHUB_ACTIONS_RUNNER_TOKEN,
                },
                {
                  name: 'GITHUB_ACTIONS_RUNNER_CONTEXT',
                  value: 'https://github.com/dragonflyft/platform-self-service',
                },
                {
                  name: 'RUNNER_LABELS',
                  value: 'self-hosted,ansible-templates-pool',
                },
              ],
            },
          },

          subnet_ids: this.stackProps.subnetIds,
          security_group_rules: {
            egress_all: {
              type: 'egress',
              from_port: 0,
              to_port: 0,
              protocol: '-1',
              cidr_blocks: ['0.0.0.0/0'],
            },
          },
        },
        'cold-storage-archive-lambda-process': {
          cpu: 1024,
          memory: 2048,
          create_tasks_iam_role: false,
          desired_count: 1,
          tasks_iam_role_arn: provisionRoleLookup,
          enable_autoscaling: false,
          ephemeral_storage: {
            size_in_gib: 50,
          },
          container_definitions: {
            'cold-storage-lambda-pool': {
              cpu: 1024,
              memory: 2048,
              image: `${ecrRepoUrl}:latest`,
              readonly_root_filesystem: false,
              enable_cloudwatch_logging: true,
              log_configuration: {
                log_driver: 'awslogs',
                options: {
                  'awslogs-group': logGroup.name,
                  'awslogs-region':
                    Constants.AWS_REGION_MAP[this.stackProps.region],
                  'awslogs-stream-prefix': 'gh-runners',
                },
              },

              environment: [
                {
                  name: 'GITHUB_ACCESS_TOKEN',
                  value: Utils.getSecretsForNode(this.node)
                    .GITHUB_ACTIONS_RUNNER_TOKEN,
                },
                {
                  name: 'GITHUB_ACTIONS_RUNNER_CONTEXT',
                  value:
                    'https://github.com/dragonflyft/cold-storage-archive-process',
                },
                {
                  name: 'RUNNER_LABELS',
                  value: 'self-hosted,cold-storage-lambda-pool',
                },
              ],
            },
          },

          subnet_ids: this.stackProps.subnetIds,
          security_group_rules: {
            egress_all: {
              type: 'egress',
              from_port: 0,
              to_port: 0,
              protocol: '-1',
              cidr_blocks: ['0.0.0.0/0'],
            },
          },
        },
      },
    });
  }
}
