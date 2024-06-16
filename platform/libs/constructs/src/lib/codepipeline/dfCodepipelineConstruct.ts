import { CodebuildProject } from '@cdktf/provider-aws/lib/codebuild-project';
import {
  Codepipeline,
  CodepipelineArtifactStore,
  CodepipelineStage,
} from '@cdktf/provider-aws/lib/codepipeline';
import {
  DataAwsIamPolicyDocument,
  DataAwsIamPolicyDocumentStatement,
} from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { Constants, Utils } from '@dragonfly/utils';
import { Construct } from 'constructs';
import {
  DfCodeartifactConstruct,
  DfIamRoleConstruct,
  DfPrivateBucketConstruct,
} from '../constructs';
export interface CodebuildProps {
  stages: StageSource[];
  cbAdditionalAssumptionStatements?: DataAwsIamPolicyDocumentStatement[];
  cbAdditionalPermissionStatements?: DataAwsIamPolicyDocumentStatement[];
  codeartifactConstruct: DfCodeartifactConstruct;
}

interface StageSource {
  stageName: string;
  buildspecPath: string;
}

export interface CodepipelineProps {
  pipelineName: string;
  codepipelineStages: CodepipelineStage[];
  cpAdditionalAssumptionStatements?: DataAwsIamPolicyDocumentStatement[];
  cpAdditionalPermissionStatements?: DataAwsIamPolicyDocumentStatement[];
  dfPipelineArtifactStore?: CodepipelineArtifactStore;
  artifactBucket: DfPrivateBucketConstruct;
  platformSandboxDeploy: boolean;
}

/**
 * Private Codepipeline construct
 */
export class DfCodepipelineConstruct extends Construct {
  public readonly codepipeline: Codepipeline;
  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {string} stackName - The name of the stack
   * @param {CodebuildProps} cbProps - The properties needed for a codebuild project
   * @param {CodepipelineProps} cpProps - The properties needed for a codepipeline
   */
  constructor(
    scope: Construct,
    stackName: string,
    cbProps: CodebuildProps,
    cpProps: CodepipelineProps
  ) {
    super(scope, stackName);
    const provisionRoleArns = Constants.ACCOUNT_NUMBERS.map((accountNumber) => {
      return `arn:aws:iam::${accountNumber}:role/${Constants.ROLE_PROVISION_ROLE_NAME}`;
    });

    const accountNumber = cpProps.platformSandboxDeploy
      ? Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX
      : Constants.ACCOUNT_NUMBER_TOOLS;

    const cbPermissionsDocument = new DataAwsIamPolicyDocument(
      this,
      Utils.createConstructResourceId('codebuild-policy-document'),
      {
        statement: [
          {
            effect: 'Allow',
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            resources: ['*'],
          },
          {
            effect: 'Allow',
            actions: [
              '*',
              'codeartifact:PublishPackageVersion',
              'codeartifact:ReadFromRepository',
              'codeartifact:GetAuthorizationToken',
              'codeartifact:GetRepositoryEndpoint',
              'sts:GetServiceBearerToken',
            ],
            resources: [
              cbProps.codeartifactConstruct.codeartifactRepositoryResource.arn,
              cbProps.codeartifactConstruct.codeartifactDomainResource.arn,
              `arn:aws:codeartifact:us-east-1:${accountNumber}:package/${cbProps.codeartifactConstruct.codeartifactDomainResource.domain}/${cbProps.codeartifactConstruct.codeartifactRepositoryResource.repository}/*`,
            ],
          },
          {
            effect: 'Allow',
            actions: ['sts:AssumeRole'],
            resources: [
              `arn:aws:iam::${Constants.ACCOUNT_NUMBER_MASTER}:role/dragonflyft-state-admin`,
              ...provisionRoleArns,
            ],
          },
          {
            effect: 'Allow',
            actions: ['sts:GetServiceBearerToken'],
            resources: ['*'],
            condition: [
              {
                test: 'StringEquals',
                values: ['codeartifact.amazonaws.com'],
                variable: 'sts:AWSServiceName',
              },
            ],
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
              cpProps.artifactBucket.bucket.arn,
              `${cpProps.artifactBucket.bucket.arn}/*`,
            ],
          },
          {
            effect: 'Allow',
            actions: ['kms:GenerateDataKey'],
            resources: [`arn:aws:kms:us-east-1:${accountNumber}:key/*`],
          },
          {
            effect: 'Allow',
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
              `arn:aws:secretsmanager:us-east-1:${Constants.ACCOUNT_NUMBER_TOOLS}:secret:API-key/Prisma-cloud-key-*`,
            ],
          },
          ...(cbProps.cbAdditionalPermissionStatements
            ? cbProps.cbAdditionalPermissionStatements
            : []),
        ],
      }
    );

    const cbAssumptionDocument = new DataAwsIamPolicyDocument(
      this,
      Utils.createConstructResourceId('codebuild-assume-role-policy'),
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            principals: [
              {
                type: 'Service',
                identifiers: ['codebuild.amazonaws.com'],
              },
              {
                type: 'AWS',
                identifiers: [
                  `arn:aws:iam::${accountNumber}:role/${Constants.ROLE_PROVISION_ROLE_NAME}`,
                ],
              },
            ],
          },
          ...(cbProps.cbAdditionalAssumptionStatements
            ? cbProps.cbAdditionalAssumptionStatements
            : []),
        ],
      }
    );

    const buildRole = new DfIamRoleConstruct(this, {
      roleName: Utils.createConstructResourceId(`${stackName}-codebuild-role`),
      permissionsDocuments: [cbPermissionsDocument],
      assumptionDocument: cbAssumptionDocument,
    });

    cbProps.stages.forEach((stage) => {
      new CodebuildProject(
        this,
        Utils.createConstructResourceId(`${stage.stageName}-codebuild`),
        {
          name: `${stackName}-${stage.stageName}-codebuild`,
          serviceRole: buildRole.role.arn,
          artifacts: {
            type: 'CODEPIPELINE',
            packaging: 'ZIP',
            overrideArtifactName: true,
          },
          environment: {
            computeType: 'BUILD_GENERAL1_SMALL',
            image: `${accountNumber}.dkr.ecr.us-east-1.amazonaws.com/codebuild-image:latest`,
            type: 'LINUX_CONTAINER',
          },
          source: {
            buildspec: stage.buildspecPath,
            type: 'CODEPIPELINE',
          },
          tags: { Name: `${stackName}-${stage.stageName}-codebuild` },
        }
      );
    });

    const cpPermissionsDocument = new DataAwsIamPolicyDocument(
      this,
      Utils.createConstructResourceId('codepipeline-policy-document'),
      {
        statement: [
          {
            actions: ['cloudwatch:*', 'codebuild:*'],
            effect: 'Allow',
            resources: ['*'],
          },
          {
            actions: [
              's3:GetObject',
              's3:GetObjectVersion',
              's3:GetBucketVersioning',
              's3:ListBucket',
              's3:ListBucketVersions',
              's3:PutObject',
              's3:PutObjectAcl',
            ],
            effect: 'Allow',
            resources: [
              cpProps.artifactBucket.bucket.arn,
              `${cpProps.artifactBucket.bucket.arn}/*`,
            ],
          },
          ...(cpProps.cpAdditionalPermissionStatements
            ? cpProps.cpAdditionalPermissionStatements
            : []),
        ],
      }
    );

    const cpAssumptionDocument = new DataAwsIamPolicyDocument(
      this,
      Utils.createConstructResourceId('codepipeline-assume-role-policy'),
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            principals: [
              {
                type: 'Service',
                identifiers: ['codepipeline.amazonaws.com'],
              },
            ],
          },
          ...(cpProps.cpAdditionalAssumptionStatements
            ? cpProps.cpAdditionalAssumptionStatements
            : []),
        ],
      }
    );

    const pipelineRole = new DfIamRoleConstruct(this, {
      roleName: Utils.createConstructResourceId(
        `${stackName}-codepipeline-role`
      ),
      permissionsDocuments: [cpPermissionsDocument],
      assumptionDocument: cpAssumptionDocument,
    });
    new Codepipeline(this, Utils.createConstructResourceId('codepipeline'), {
      name: cpProps.pipelineName,
      roleArn: pipelineRole.role.arn,
      artifactStore: [cpProps.dfPipelineArtifactStore],
      stage: cpProps.codepipelineStages,
      tags: { Name: cpProps.pipelineName },
    });
  }
}
