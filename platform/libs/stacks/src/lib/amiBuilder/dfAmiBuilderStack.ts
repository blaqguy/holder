import {
  DfCodeBuildConstruct,
  DfIamRoleConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { DfSpokeVpcConstruct } from '@dragonfly/constructs';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamInstanceProfile } from '@cdktf/provider-aws/lib/iam-instance-profile';
import { DfCodeBuildCredentialStack } from '../stacks';

/**
 * AMI Builder Stack
 * @extends {RemoteStack}
 */
export class DfAmiBuilderStack extends RemoteStack {
  private codeBuildResource: DfCodeBuildConstruct;

  /**
   * Constructs an instance of DfUobBaseImagesStack
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   * @param {string} githubRepo - The github repo to use for the codebuild project
   * @param {DfSpokeVpcConstruct} vpc - The vpc to use for the codebuild project
   * @param {DfCodeBuildCredentialStack} credentialStack - The credential stack to use for the codebuild project
   * ! The Credential Stack is here as a dependency to ensure that the credential is created before the codebuild project
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    githubRepo: string,
    vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct,
    credentialStack: DfCodeBuildCredentialStack
  ) {
    super(stackId, stackConfig);

    const packerPermissionsDocument = this.createPermissionsDocument();
    const packerAssumptionDocument = this.createAssumptionDocument();
    const packerRole = this.createIamRole(
      packerPermissionsDocument,
      packerAssumptionDocument
    );
    /**
     * This instance profile gets used by Packer
     * To build the Liquibase base image as it needs to pull from S3
     * It can also be used by other tiers in the future as needed
     */
    this.createPackerInstanceProfile(packerRole);
    this.codeBuildResource = this.createCodeBuildResource(githubRepo, vpc);
    this.createPackerPolicy();
    this.createTrivyPolicy();
    this.addDependency(credentialStack);
  }

  /**
   * Creates the IAM permissions document for the stack.
   * @return {DataAwsIamPolicyDocument} The IAM permissions document.
   */
  private createPermissionsDocument(): DataAwsIamPolicyDocument {
    return new DataAwsIamPolicyDocument(
      this,
      `${this.stackId}-packerInstanceProfilePerms`,
      {
        statement: [
          {
            effect: 'Allow',
            actions: [
              's3:Get*',
              's3:List*',
              'ssm:Describe*',
              'ssm:Get*',
              'ssm:List*',
              'kms:Decrypt*',
              'kms:GenerateDataKey*',
            ],
            resources: ['*'],
          },
        ],
      }
    );
  }

  /**
   * Creates the IAM role assumption document for the stack.
   * @return {DataAwsIamPolicyDocument} The IAM role assumption document.
   */
  private createAssumptionDocument(): DataAwsIamPolicyDocument {
    return new DataAwsIamPolicyDocument(
      this,
      `${this.stackId}-roleAssumptionDoc`,
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            principals: [
              {
                type: 'Service',
                identifiers: ['ec2.amazonaws.com'],
              },
            ],
          },
        ],
      }
    );
  }

  /**
   * Creates the IAM role for the stack.
   * @param {DataAwsIamPolicyDocument} permissionsDocument - The permissions document for the IAM role.
   * @param {DataAwsIamPolicyDocument} assumptionDocument - The role assumption document for the IAM role.
   * @return {DfIamRoleConstruct} The IAM role.
   */
  private createIamRole(
    permissionsDocument: DataAwsIamPolicyDocument,
    assumptionDocument: DataAwsIamPolicyDocument
  ): DfIamRoleConstruct {
    return new DfIamRoleConstruct(this, {
      roleName: `${this.stackId}-packerInstanceRole`,
      permissionsDocuments: [permissionsDocument],
      assumptionDocument: assumptionDocument,
    });
  }

  /**
   * Creates the IAM instance profile for the stack.
   * @param {DfIamRoleConstruct} cbRole - The IAM role to use for the instance profile.
   */
  private createPackerInstanceProfile(cbRole: DfIamRoleConstruct): void {
    new IamInstanceProfile(this, `${this.stackId}-packerInstanceProfile`, {
      name: `${this.stackId}-packerInstanceProfile`,
      role: cbRole.role.name,
      tags: { Name: `${this.stackId}-packer-instance-profile` },
    });
  }

  /**
   * Creates the Packer policy for the stack.
   */
  private createPackerPolicy(): void {
    new IamRolePolicy(this, `${this.stackId}-uobBaseImagesPackerPolicy`, {
      name: 'uobBaseImagesPacker',
      role: this.codeBuildResource.codeBuildRoleId,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'ec2:AttachVolume',
              'ec2:AuthorizeSecurityGroupIngress',
              'ec2:CopyImage',
              'ec2:CreateImage',
              'ec2:CreateKeypair',
              'ec2:CreateSecurityGroup',
              'ec2:CreateSnapshot',
              'ec2:CreateTags',
              'ec2:CreateVolume',
              'ec2:DeleteKeyPair',
              'ec2:DeleteSecurityGroup',
              'ec2:DeleteSnapshot',
              'ec2:DeleteVolume',
              'ec2:DeregisterImage',
              'ec2:DescribeImageAttribute',
              'ec2:DescribeImages',
              'ec2:DescribeInstances',
              'ec2:DescribeInstanceStatus',
              'ec2:DescribeRegions',
              'ec2:DescribeSnapshots',
              'ec2:DescribeTags',
              'ec2:DescribeVolumes',
              'ec2:DetachVolume',
              'ec2:GetPasswordData',
              'ec2:ModifyImageAttribute',
              'ec2:ModifyInstanceAttribute',
              'ec2:ModifySnapshotAttribute',
              'ec2:RegisterImage',
              'ec2:RunInstances',
              'ec2:StopInstances',
              'ec2:TerminateInstances',
              'iam:PassRole',
              'iam:GetInstanceProfile',
            ],
            Resource: '*',
          },
        ],
      }),
    });
  }

  /**
   * Creates the Trivy policy for the stack.
   */
  private createTrivyPolicy(): void {
    new IamRolePolicy(this, `${this.stackId}-uobBaseImagesTrivyPolicy`, {
      name: 'uobBaseImagestrivy',
      role: this.codeBuildResource.codeBuildRoleId,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['ebs:ListSnapshotBlocks', 'ebs:GetSnapshotBlock'],
            Resource: '*',
          },
        ],
      }),
    });
  }

  /**
   * Creates the CodeBuild resource for the stack.
   * @param {string} githubRepo - The GitHub repo to use for the CodeBuild project.
   * @param {DfSpokeVpcConstruc} vpc - The VPC to use for the CodeBuild project.
   * @return {DfCodeBuildConstruct} The CodeBuild resource.
   */
  private createCodeBuildResource(
    githubRepo: string,
    vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct
  ): DfCodeBuildConstruct {
    return new DfCodeBuildConstruct(this, `${this.stackId}-uobBaseImages`, {
      projectName: 'amibuilder',
      description: 'Packer AMI builder pipeline',
      type: 'LINUX_CONTAINER',
      computeType: 'BUILD_GENERAL1_MEDIUM',
      privilegedMode: false,
      image: 'aws/codebuild/amazonlinux2-x86_64-standard:4.0',
      imageBuildCredentialsType: 'CODEBUILD',
      repoUrl: githubRepo,
      vpc: vpc,
    });
  }
}
