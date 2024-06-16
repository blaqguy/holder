import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import { EcrRepository } from '@cdktf/provider-aws/lib/ecr-repository';
import { EcrRepositoryPolicy } from '@cdktf/provider-aws/lib/ecr-repository-policy';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Construct } from 'constructs';

// ? Do we want to enable/support Enhanced Scanning? Plugs into AWS Inspector
// ? Do we want to change the encryption key to a CMK? (default is AWS managed)
/**
 * Dragonfly ECR Construct
 */
export class DfEcrConstruct extends Construct {
  private ecrRepository: EcrRepository;
  private ecrRepositoryPolicy: EcrRepositoryPolicy;

  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {string} id -  A logical identifier for the construct
   * @param {string} repositoryName - Repository Name
   * @param {string} servicePrincipal - override account principal with service principal
   * @param {string} accountId - override account principal with service principal
   * @param {AwsProvider} provider - Provider of the stack
   */
  constructor(
    scope: Construct,
    id: string,
    private repositoryName: string,
    servicePrincipal?: string,
    accountId?: string,
    provider?: AwsProvider
  ) {
    super(scope, id);

    this.ecrRepository = new EcrRepository(
      this,
      `${this.repositoryName}-EcrRepository`,
      {
        provider: provider,
        name: this.repositoryName,
        imageTagMutability: 'MUTABLE',
        encryptionConfiguration: [
          {
            encryptionType: 'AES256',
          },
        ],
        imageScanningConfiguration: {
          scanOnPush: true,
        },
        forceDelete: true,
        tags: {
          Name: this.repositoryName,
        },
      }
    );

    const dragonflyAccountId =
      accountId ??
      new DataAwsCallerIdentity(this, `${this.repositoryName}`, {}).id;

    new EcrRepositoryPolicy(
      this,
      `${this.repositoryName}-EcrRepositoryPolicy`,
      {
        provider: provider,
        repository: this.ecrRepository.name,
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Action: [
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:BatchCheckLayerAvailability',
                'ecr:PutImage',
                'ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart',
                'ecr:CompleteLayerUpload',
                'ecr:DescribeRepositories',
                'ecr:GetRepositoryPolicy',
                'ecr:ListImages',
                'ecr:DeleteRepository',
                'ecr:BatchDeleteImage',
                'ecr:SetRepositoryPolicy',
                'ecr:DeleteRepositoryPolicy',
              ],
              Effect: 'Allow',
              Principal: servicePrincipal
                ? {
                    Service: [servicePrincipal],
                  }
                : {
                    AWS: [`arn:aws:iam::${dragonflyAccountId}:root`],
                  },
            },
          ],
        }),
      }
    );
  }

  /**
   * @return {string} - A Token representing the ecr repository Terraform resource repositoryUrl attribute
   */
  public get repoUrl() {
    return this.ecrRepository.repositoryUrl;
  }

  /**
   * @return {string} - The ECR repository resource
   */
  public get repository() {
    return this.ecrRepository;
  }

  /**
   * @return {EcrRepositoryPolicy} - The ECR Repository policy tf resource
   */
  public get ecrRepositoryPolicyResource() {
    return this.ecrRepositoryPolicy;
  }
}
