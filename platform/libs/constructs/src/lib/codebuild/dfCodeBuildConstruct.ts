import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { Construct } from 'constructs';
import { CodebuildProject } from '@cdktf/provider-aws/lib/codebuild-project';
import { CodebuildWebhook } from '@cdktf/provider-aws/lib/codebuild-webhook';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DfSpokeVpcConstruct, DfToolsVpcConstruct } from '../vpc';
import { DfPrivateBucketConstruct } from '../privateS3Bucket/dfPrivateBucket';
import { Utils } from '@dragonfly/utils';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';

export interface CodebuildConfig {
  readonly projectName: string;
  readonly description?: string;
  readonly computeType: string;
  readonly type: string;
  readonly privilegedMode: boolean;
  readonly image: string;
  readonly imageBuildCredentialsType: string;
  readonly repoUrl: string;
  readonly vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
}

/**
 * The DfCodeBuildConstruct class represents an AWS CodeBuild project,
 * including its associated resources such as IAM roles, security groups,
 * and webhooks. This class helps you create a CodeBuild project in a
 * modular and organized way.
 */
export class DfCodeBuildConstruct extends Construct {
  protected codeBuildRole: IamRole;
  protected readonly codeBuildProject: CodebuildProject;
  private readonly codebuildSecurityGroup: SecurityGroup;
  private readonly artifactsBucket: DfPrivateBucketConstruct;

  /**
   * Constructs a new instance of the DfCodeBuildConstruct class.
   *
   * @param {Construct} scope - The scope the resource is created in.
   * @param {string} id - The ID for the Terraform resource.
   * @param {CodebuildConfig} codeBuildConfig - The properties needed for a CodeBuild project.
   */
  constructor(scope: Construct, id: string, codeBuildConfig: CodebuildConfig) {
    super(scope, id);

    const codeBuildTrustPolicy = this.createCodebuildTrustPolicy();
    this.codeBuildRole = this.createCodeBuildRole(
      codeBuildConfig,
      codeBuildTrustPolicy
    );
    const codeBuildRolePolicy = this.createCodeBuildProjectPolicy();
    this.createIamRolePolicy(codeBuildConfig, codeBuildRolePolicy);
    this.codebuildSecurityGroup = this.createSecurityGroup(codeBuildConfig);
    this.artifactsBucket = this.createS3Bucket(codeBuildConfig);
    this.codeBuildProject = this.createCodeBuildProject(codeBuildConfig);
    this.createCodebuildWebhook(codeBuildConfig);
  }

  /**
   * Create Codebuild Trust Policy
   * @return {DataAwsIamPolicyDocument} The created trust policy.
   */
  private createCodebuildTrustPolicy(): DataAwsIamPolicyDocument {
    return Utils.createTrustPolicyDocument(
      this,
      Utils.createConstructResourceId('codeBuildTrustPolicyDoc'),
      ['codebuild.amazonaws.com']
    );
  }

  /**
   * Creates an IAM role for the CodeBuild project.
   * @param {CodebuildConfig} codeBuildConfig - Configuration for the CodeBuild project.
   * @param {DataAwsIamPolicyDocument} codeBuildTrustPolicy - Trust policy for the CodeBuild project.
   * @return {IamRole} The created IAM role.
   */
  private createCodeBuildRole(
    codeBuildConfig: CodebuildConfig,
    codeBuildTrustPolicy: DataAwsIamPolicyDocument
  ): IamRole {
    return new IamRole(this, `${codeBuildConfig.projectName}-Role`, {
      name: codeBuildConfig.projectName,
      assumeRolePolicy: codeBuildTrustPolicy.json,
      tags: { Name: codeBuildConfig.projectName },
    });
  }

  /**
   * Creates an IAM role policy for the CodeBuild project.
   * @return {DataAwsIamPolicyDocument} The created IAM role policy.
   */
  private createCodeBuildProjectPolicy(): DataAwsIamPolicyDocument {
    return Utils.createPolicyDocument(
      this,
      Utils.createConstructResourceId('codeBuildProjectPolicyDoc'),
      [
        'codebuild:CreateReportGroup',
        'codebuild:CreateReport',
        'codebuild:UpdateReport',
        'codebuild:BatchPutTestCases',
        'codebuild:BatchPutCodeCoverages',
        'ec2:CreateNetworkInterface',
        'ec2:DescribeDhcpOptions',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DeleteNetworkInterface',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeVpcs',
        'ec2:CreateNetworkInterfacePermission',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        's3:PutObject',
        's3:GetObject',
        's3:GetObjectVersion',
        's3:GetBucketAcl',
        's3:GetBucketLocation',
      ],
      ['*']
    );
  }
  /**
   * Creates an IAM role policy for the CodeBuild project.
   * @param {CodebuildConfig} codeBuildConfig - Configuration for the CodeBuild project.
   * @param {DataAwsIamPolicyDocument} codeBuildRolePolicy - IAM role policy for the CodeBuild project.
   */
  private createIamRolePolicy(
    codeBuildConfig: CodebuildConfig,
    codeBuildRolePolicy: DataAwsIamPolicyDocument
  ): void {
    new IamRolePolicy(this, `${codeBuildConfig.projectName}-Policy`, {
      name: codeBuildConfig.projectName,
      role: this.codeBuildRole.id,
      policy: codeBuildRolePolicy.json,
    });
  }

  /**
   * Creates a security group for the CodeBuild project.
   * @param {CodebuildConfig} codeBuildConfig - Configuration for the CodeBuild project.
   * @return {SecurityGroup} The created security group.
   */
  private createSecurityGroup(codeBuildConfig: CodebuildConfig): SecurityGroup {
    return new SecurityGroup(
      this,
      `${codeBuildConfig.projectName}-SecurityGroup`,
      {
        name: codeBuildConfig.projectName,
        description: 'Security Group for CodeBuild',
        vpcId: codeBuildConfig.vpc.vpcId,
        ingress: [
          {
            description: 'Allow all internal traffic to CodeBuild',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: [codeBuildConfig.vpc.vpcCidrBlock],
          },
        ],
        egress: [
          {
            description: 'Allow all outbound traffic from CodeBuild',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
          },
        ],
        tags: { Name: codeBuildConfig.projectName },
      }
    );
  }

  /**
   * Creates an S3 bucket for storing the artifacts of the CodeBuild project.
   * @param {CodebuildConfig} codeBuildConfig - Configuration for the CodeBuild project.
   * @return {DfPrivateBucketConstruct} The created S3 bucket.
   */
  private createS3Bucket(
    codeBuildConfig: CodebuildConfig
  ): DfPrivateBucketConstruct {
    return new DfPrivateBucketConstruct(
      this,
      `${codeBuildConfig.projectName}-artifactBucket`,
      {
        bucketName:
          `df-${codeBuildConfig.projectName}-artifact-store`.toLowerCase(),
        keyProps: {
          name: `${codeBuildConfig.projectName}-artifactBucket`,
          description: 'KMS Key for CodeBuild artifact bucket',
        },
      }
    );
  }

  /**
   * Creates a CodeBuild project using the provided configuration.
   * @param {CodebuildConfig} codeBuildConfig - Configuration for the CodeBuild project.
   * @return {CodebuildProject} The created CodeBuild project.
   */
  private createCodeBuildProject(
    codeBuildConfig: CodebuildConfig
  ): CodebuildProject {
    return new CodebuildProject(
      this,
      `${codeBuildConfig.projectName}-Project`,
      {
        name: codeBuildConfig.projectName,
        description: codeBuildConfig.description,
        serviceRole: this.codeBuildRole.arn,
        buildTimeout: 180,
        artifacts: {
          type: 'S3',
          location: this.artifactsBucket.bucket.id,
          packaging: 'ZIP',
          overrideArtifactName: true,
        },
        environment: {
          computeType: codeBuildConfig.computeType,
          image: codeBuildConfig.image,
          type: codeBuildConfig.type,
          privilegedMode: codeBuildConfig.privilegedMode,
          imagePullCredentialsType: codeBuildConfig.imageBuildCredentialsType,
        },
        vpcConfig: {
          vpcId: codeBuildConfig.vpc.vpcId,
          subnets: codeBuildConfig.vpc.appSubnetIds,
          securityGroupIds: [this.codebuildSecurityGroup.id],
        },
        source: {
          type: 'GITHUB',
          location: codeBuildConfig.repoUrl,
          reportBuildStatus: true,
        },
        tags: { Name: codeBuildConfig.projectName },
      }
    );
  }

  /**
   * Creates a CodeBuild webhook for the CodeBuild project.
   * @param {CodebuildConfig} codeBuildConfig - Configuration for the CodeBuild project.
   */
  private createCodebuildWebhook(codeBuildConfig: CodebuildConfig): void {
    new CodebuildWebhook(this, `${codeBuildConfig.projectName}-Webhook`, {
      projectName: this.codeBuildProject.name,
      buildType: 'BUILD',
      filterGroup: [
        {
          filter: [
            {
              type: 'EVENT',
              pattern: 'PULL_REQUEST_CREATED, PULL_REQUEST_UPDATED',
            },
          ],
        },
      ],
    });
  }

  /**
   * Getter for the CodeBuild role ID.
   * @return {string} The ID of the CodeBuild role.
   */
  public get codeBuildRoleId(): string {
    return this.codeBuildRole.id;
  }
}
