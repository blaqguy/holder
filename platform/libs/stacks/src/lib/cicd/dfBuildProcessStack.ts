import {
  CodepipelineArtifactStore,
  CodepipelineStage,
} from '@cdktf/provider-aws/lib/codepipeline';
import { CodestarconnectionsConnection } from '@cdktf/provider-aws/lib/codestarconnections-connection';
import { DataAwsIamPolicyDocumentStatement } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { SecretsmanagerSecret } from '@cdktf/provider-aws/lib/secretsmanager-secret';
import { SecretsmanagerSecretVersion } from '@cdktf/provider-aws/lib/secretsmanager-secret-version';
import {
  CodebuildProps,
  CodepipelineProps,
  DfCodepipelineConstruct,
  DfPrivateBucketConstruct,
} from '@dragonfly/constructs';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { DfBuildArtifactStack } from './dfBuildArtifactsStack';
import { DfBuildAutomationRoleStack } from './dfBuildAutomationRoleStack';

export interface DfBuildProcessConfig {
  branch?: string;
  platformSandboxDeploy: boolean;
}

/**
 * Build Process Stack
 */
export class DfBuildProcessStack extends RemoteStack {
  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   */
  constructor(
    protected readonly stackName: string,
    protected readonly stackConfig: StackConfig,
    protected readonly buildProcessConfig: DfBuildProcessConfig
  ) {
    super(stackName, stackConfig);

    // Retrieve sops data that contains secret keys for creating prisma api key secret in secrets manager
    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    const codeartifact = new DfBuildArtifactStack(
      'build-artifact-resources',
      this.stackConfig,
      {
        repositoryName: 'build-artifacts',
        domainName: 'dragonfly-pst',
      }
    );

    // Build Codepipeline bucket for artifact storage
    const artifactBucket = new DfPrivateBucketConstruct(
      this,
      `${this.environment}-${Constants.BUCKET_CODEPIPELINE_ARTIFACT}`,
      {
        bucketName: `${this.environment}-${Constants.BUCKET_CODEPIPELINE_ARTIFACT}`,
        keyProps: {
          name: `${this.environment}-${Constants.BUCKET_CODEPIPELINE_ARTIFACT}`,
          description: 'Codepipeline Artifacts Bucket',
        },
      }
    );

    const prismaSecret = new SecretsmanagerSecret(
      this,
      'prisma-api-key-secret',
      {
        description:
          'The Secret to store the Dragonflyft Organization Prisma API Key',
        name: 'API-key/Prisma-cloud-key',
        recoveryWindowInDays: 0,
        tags: { Name: 'prisma-cloud-key' },
      }
    );

    // Add the prisma API key secret retrieved from SOPS
    new SecretsmanagerSecretVersion(this, 'prisma-api-key-secret-version', {
      secretId: prismaSecret.arn,
      secretString: JSON.stringify(sopsData.PRISMA_API_KEY),
    });

    const artifactStore: CodepipelineArtifactStore = {
      location: artifactBucket.bucket.id,
      type: 'S3',
    };

    const codestarConnection = new CodestarconnectionsConnection(
      this,
      Utils.createStackResourceId(
        this.stackUuid,
        'codepipeline-github-connection'
      ),
      {
        name: 'codepipeline-github-connection',
        providerType: 'GitHub',
        tags: { Name: 'codepipeline-github-connection' },
      }
    );

    /**
     * Build Pipeline
     */
    const buildPipelineName = 'build-pipeline';
    const buildPipelineExtraPermissions: DataAwsIamPolicyDocumentStatement[] = [
      // Allows build pipeline to connect to codestar
      {
        actions: ['codestar-connections:UseConnection'],
        effect: 'Allow',
        resources: [codestarConnection.arn],
      },
    ];

    // Create stages for codepipeline
    const buildStage1: CodepipelineStage = {
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
            ConnectionArn: codestarConnection.arn,
            FullRepositoryId: 'dragonflyft/platform',
            BranchName: buildProcessConfig.branch
              ? buildProcessConfig.branch
              : 'master',
            OutputArtifactFormat: 'CODE_ZIP',
          },
          runOrder: 1,
        },
      ],
    };

    const buildStage2: CodepipelineStage = {
      name: 'Build',
      action: [
        {
          name: 'Build',
          category: 'Build',
          owner: 'AWS',
          provider: 'CodeBuild',
          version: '1',
          inputArtifacts: ['SourceOutput'],
          outputArtifacts: ['BuildOutput'],
          configuration: {
            ProjectName: `${buildPipelineName}-build-codebuild`,
            EnvironmentVariables: `[{"name":"CURRENT_ENVIRONMENT","value":"${this.environment}"}]`,
          },
          runOrder: 1,
        },
        {
          name: 'Plan',
          category: 'Test',
          owner: 'AWS',
          provider: 'CodeBuild',
          version: '1',
          inputArtifacts: ['BuildOutput'],
          outputArtifacts: ['TfPlan'],
          configuration: {
            ProjectName: `${buildPipelineName}-plan-codebuild`,
          },
          runOrder: 2,
        },
      ],
    };

    const buildPipelineCodebuildConfig: CodebuildProps = {
      stages: [
        {
          stageName: 'build',
          buildspecPath: 'buildAssets/buildspec/buildspec-build.yaml',
        },
        {
          stageName: 'plan',
          buildspecPath: 'buildAssets/buildspec/buildspec-plan.yaml',
        },
      ],
      codeartifactConstruct: codeartifact.codeartifactConstruct,
    };

    const buildPipelineConfig: CodepipelineProps = {
      cpAdditionalPermissionStatements: buildPipelineExtraPermissions,
      codepipelineStages: [buildStage1, buildStage2],
      pipelineName: buildPipelineName,
      dfPipelineArtifactStore: artifactStore,
      artifactBucket: artifactBucket,
      platformSandboxDeploy: buildProcessConfig.platformSandboxDeploy,
    };

    new DfCodepipelineConstruct(
      this,
      buildPipelineName,
      buildPipelineCodebuildConfig,
      buildPipelineConfig
    );

    /**
     * Pre-Prod Pipeline
     */
    const preProdPipelineName = 'pre-prod-pipeline';
    const preProdPipelineExtraPermissions: DataAwsIamPolicyDocumentStatement[] =
      [
        // Need to provide kms key access for source stage to retrieve from S3 bucket
        {
          actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
          effect: 'Allow',
          resources: [
            `arn:aws:kms:us-east-1:${Constants.ACCOUNT_NUMBER_TOOLS}:key/*`,
          ],
        },
      ];

    // Create stages for codepipeline
    const preProdStage1: CodepipelineStage = {
      name: 'Source',
      action: [
        {
          name: 'Source',
          category: 'Source',
          owner: 'AWS',
          provider: 'S3',
          version: '1',
          outputArtifacts: ['SourceOutput'],
          configuration: {
            S3Bucket: `${this.environment}-${Constants.BUCKET_CODEPIPELINE_ARTIFACT}`,
            S3ObjectKey: Constants.BUCKET_OBJECT_ENVIRONMENTS_VERSIONS_FILE,
          },
          runOrder: 1,
        },
      ],
    };

    const preProdStage2: CodepipelineStage = {
      name: 'Pre-Prod',
      action: [
        {
          name: 'Plan',
          category: 'Test',
          owner: 'AWS',
          provider: 'CodeBuild',
          version: '1',
          inputArtifacts: ['SourceOutput'],
          outputArtifacts: ['TfPlan'],
          configuration: {
            ProjectName: `${preProdPipelineName}-plan-codebuild`,
          },
          runOrder: 1,
        },
        {
          name: 'Scan',
          category: 'Test',
          owner: 'AWS',
          provider: 'CodeBuild',
          version: '1',
          inputArtifacts: ['TfPlan'],
          outputArtifacts: ['ScanAnalysis'],
          configuration: {
            ProjectName: `${preProdPipelineName}-scan-codebuild`,
            // To export Prisma api url for use in checkov scan command
            EnvironmentVariables: `[{"name":"PRISMA_API_URL","value":"https://api4.prismacloud.io"}]`,
          },
          runOrder: 2,
        },
        {
          name: 'Approval',
          category: 'Approval',
          owner: 'AWS',
          provider: 'Manual',
          version: '1',
          inputArtifacts: [],
          outputArtifacts: [],
          runOrder: 3,
        },
        {
          name: 'Deploy',
          category: 'Build',
          owner: 'AWS',
          provider: 'CodeBuild',
          version: '1',
          inputArtifacts: ['TfPlan'],
          configuration: {
            ProjectName: `${preProdPipelineName}-deploy-codebuild`,
          },
          runOrder: 4,
        },
      ],
    };

    const preProdCodebuildConfig: CodebuildProps = {
      stages: [
        {
          stageName: 'plan',
          buildspecPath:
            'finalPackages/buildAssets/buildspec/buildspec-plan.yaml',
        },
        {
          stageName: 'scan',
          buildspecPath:
            'finalPackages/buildAssets/buildspec/buildspec-scan.yaml',
        },
        {
          stageName: 'approval',
          buildspecPath:
            'finalPackages/buildAssets/buildspec/buildspec-approval.yaml',
        },
        {
          stageName: 'deploy',
          buildspecPath:
            'finalPackages/buildAssets/buildspec/buildspec-deploy.yaml',
        },
      ],
      codeartifactConstruct: codeartifact.codeartifactConstruct,
    };

    const codepipelineConfig: CodepipelineProps = {
      cpAdditionalPermissionStatements: preProdPipelineExtraPermissions,
      codepipelineStages: [preProdStage1, preProdStage2],
      pipelineName: preProdPipelineName,
      dfPipelineArtifactStore: artifactStore,
      artifactBucket: artifactBucket,
      platformSandboxDeploy: buildProcessConfig.platformSandboxDeploy,
    };

    new DfCodepipelineConstruct(
      this,
      preProdPipelineName,
      preProdCodebuildConfig,
      codepipelineConfig
    );
  }
}
