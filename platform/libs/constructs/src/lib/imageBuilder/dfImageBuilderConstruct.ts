import { CodebuildProject } from '@cdktf/provider-aws/lib/codebuild-project';
import { Construct } from 'constructs';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { Constants } from '@dragonfly/utils';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { Codepipeline } from '@cdktf/provider-aws/lib/codepipeline';
import { DataAwsCodestarconnectionsConnection } from '@cdktf/provider-aws/lib/data-aws-codestarconnections-connection';
import {
  DfEcrConstruct,
  DfIamRoleConstruct,
  DfPrivateBucketConstruct,
} from '../constructs';

interface ImageBuilderConfig {
  imageName: string;
  dockerfileDir: string;
  branchOverride?: string;
  platformSandboxDeploy?: boolean;
  federatedAccountId: string;
}

/**
 * Image builder construct - creates pipeline for building docker images and publishing to ECR
 */
export class DfImageBuilderConstruct extends Construct {
  /**
   * @param {Construct} scope - Root CDK app
   * @param {string} id - id to pass to construct constructor
   * @param {ImageBuilderConfig} config - The image builder config
   */
  constructor(scope: Construct, id: string, config: ImageBuilderConfig) {
    super(scope, id);

    const resourceName = `${config.imageName}-image-builder`;
    const accountNumber = config.platformSandboxDeploy
      ? Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX
      : Constants.ACCOUNT_NUMBER_TOOLS;

    const ecr = new DfEcrConstruct(this, id, id);

    const artifactBucket = new DfPrivateBucketConstruct(
      this,
      `${resourceName}-pipeline-artifacts`.toLowerCase(),
      {
        bucketName: `${resourceName}-pipeline-artifacts`.toLowerCase(),
        keyProps: {
          name: `${resourceName}-key`,
          description: `${resourceName}-key`,
        },
      }
    );

    const codestar = new DataAwsCodestarconnectionsConnection(
      this,
      `${resourceName}-codestar-connection`,
      {
        name: 'codepipeline-github-connection',
        tags: { Name: 'codepipeline-github-connection' },
      }
    );

    const logGroup = new CloudwatchLogGroup(this, `${resourceName}-log-group`, {
      name: resourceName,
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        config.federatedAccountId
      )
        ? 365
        : 30,
      tags: { Name: resourceName },
    });

    const codepipelineRole = new DfIamRoleConstruct(this, {
      roleName: `codepipeline-${resourceName}`,
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(this, `${resourceName}-policy-document`, {
          statement: [
            {
              actions: ['codestar-connections:UseConnection'],
              effect: 'Allow',
              resources: [codestar.arn],
            },
            {
              effect: 'Allow',
              actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
              resources: [artifactBucket.bucketKeyConstruct.arn],
            },
            {
              effect: 'Allow',
              actions: [
                's3:PutObject',
                's3:GetObject',
                's3:GetObjectVersion',
                's3:GetBucketAcl',
                's3:GetBucketLocation',
                's3:List*',
              ],
              resources: [
                artifactBucket.bucket.arn,
                `${artifactBucket.bucket.arn}/*`,
              ],
            },
            {
              effect: 'Allow',
              actions: ['codebuild:StartBuild', 'codebuild:BatchGetBuilds'],
              resources: [
                `arn:aws:codebuild:${Constants.AWS_DEFAULT_REGION}:${accountNumber}:project/${resourceName}`,
              ],
            },
          ],
        }),
      ],
      assumptionDocument: new DataAwsIamPolicyDocument(
        this,
        `${resourceName}-service-role-policy-document`,
        {
          statement: [
            {
              effect: 'Allow',
              principals: [
                {
                  type: 'Service',
                  identifiers: ['codepipeline.amazonaws.com'],
                },
              ],
              actions: ['sts:AssumeRole'],
            },
          ],
        }
      ),
    });

    const codebuildRole = new DfIamRoleConstruct(this, {
      roleName: `codebuild-${resourceName}`,
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(
          this,
          `codebuild-${resourceName}-policy-document`,
          {
            statement: [
              {
                effect: 'Allow',
                actions: [
                  'ecr:BatchCheckLayerAvailability',
                  'ecr:InitiateLayerUpload',
                  'ecr:UploadLayerPart',
                  'ecr:CompleteLayerUpload',
                  'ecr:PutImage',
                ],
                resources: [ecr.repository.arn],
              },
              {
                effect: 'Allow',
                actions: ['ecr:GetAuthorizationToken'],
                resources: ['*'],
              },
              {
                effect: 'Allow',
                actions: [
                  'logs:CreateLogGroup',
                  'logs:PutLogEvents',
                  'logs:CreateLogStream',
                ],
                resources: ['*'],
              },
              {
                effect: 'Allow',
                actions: [
                  's3:GetObject',
                  's3:GetObjectVersion',
                  's3:GetBucketAcl',
                  's3:GetBucketLocation',
                  's3:List*',
                ],
                resources: [
                  artifactBucket.bucket.arn,
                  `${artifactBucket.bucket.arn}/*`,
                ],
              },
              {
                effect: 'Allow',
                actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
                resources: [artifactBucket.bucketKeyConstruct.arn],
              },
            ],
          }
        ),
      ],
      assumptionDocument: new DataAwsIamPolicyDocument(
        this,
        `codebuild-${resourceName}-service-role-policy-document`,
        {
          statement: [
            {
              effect: 'Allow',
              principals: [
                {
                  type: 'Service',
                  identifiers: ['codebuild.amazonaws.com'],
                },
              ],
              actions: ['sts:AssumeRole'],
            },
          ],
        }
      ),
    });

    const buildProject = new CodebuildProject(this, `${resourceName}-project`, {
      name: resourceName,
      serviceRole: codebuildRole.role.arn,
      artifacts: {
        type: 'CODEPIPELINE',
      },
      environment: {
        privilegedMode: true,
        computeType: 'BUILD_GENERAL1_MEDIUM',
        image: 'aws/codebuild/amazonlinux2-x86_64-standard:4.0',
        type: 'LINUX_CONTAINER',
        environmentVariable: [
          {
            name: 'ACCOUNT_NUMBER',
            value: accountNumber,
          },
          {
            name: 'REGION',
            value: Constants.AWS_DEFAULT_REGION,
          },
          {
            name: 'IMAGE_NAME',
            value: config.imageName,
          },
          {
            name: 'DOCKERFILE_DIR',
            value: config.dockerfileDir,
          },
        ],
      },
      source: {
        type: 'CODEPIPELINE',
        buildspec: 'libs/constructs/src/lib/imageBuilder/buildspec.yml',
      },
      logsConfig: {
        cloudwatchLogs: {
          groupName: logGroup.name,
        },
      },
      tags: { Name: resourceName },
    });

    new Codepipeline(this, `${resourceName}-pipeline`, {
      name: resourceName,
      roleArn: codepipelineRole.role.arn,
      artifactStore: [
        {
          location: artifactBucket.bucket.bucket,
          type: 'S3',
        },
      ],
      stage: [
        {
          name: 'Source',
          action: [
            {
              name: 'Source',
              category: 'Source',
              owner: 'AWS',
              provider: 'CodeStarSourceConnection',
              version: '1',
              outputArtifacts: ['SourceOutput'],
              configuration: {
                DetectChanges: 'false',
                ConnectionArn: codestar.arn,
                FullRepositoryId: 'dragonflyft/platform',
                BranchName: config.branchOverride
                  ? config.branchOverride
                  : 'master',
              },
              runOrder: 1,
            },
          ],
        },
        {
          name: `Build`,
          action: [
            {
              name: 'Build',
              category: 'Build',
              owner: 'AWS',
              provider: 'CodeBuild',
              inputArtifacts: ['SourceOutput'],
              version: '1',
              runOrder: 2,
              configuration: {
                ProjectName: buildProject.name,
              },
            },
          ],
        },
      ],
      tags: { Name: resourceName },
    });
  }
}
