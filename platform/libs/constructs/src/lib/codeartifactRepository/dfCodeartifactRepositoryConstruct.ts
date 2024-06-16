import { CodeartifactDomain } from '@cdktf/provider-aws/lib/codeartifact-domain';
import { CodeartifactRepository } from '@cdktf/provider-aws/lib/codeartifact-repository';
import { CodeartifactRepositoryPermissionsPolicy } from '@cdktf/provider-aws/lib/codeartifact-repository-permissions-policy';
import { Utils } from '@dragonfly/utils';
import { Construct } from 'constructs';

export interface DfCodeartifactProps {
  repositoryName: string;
  domainName: string;
}

/**
 *  Codeartifact repository construct
 */
export class DfCodeartifactConstruct extends Construct {
  protected readonly domain: CodeartifactDomain;
  protected readonly repository: CodeartifactRepository;

  /**
   *
   * @param {Construct} scope - The parent stack
   * @param {CodeArtifactRepositoryProps} props - Properties of the repository and domain to assign it to
   */
  constructor(private scope: Construct, private props: DfCodeartifactProps) {
    super(scope, props.repositoryName);

    this.domain = new CodeartifactDomain(
      this.scope,
      `${this.props.domainName}-domain`,
      {
        domain: this.props.domainName,
        tags: { Name: this.props.domainName },
      }
    );

    const npmPublicExternalConnection = new CodeartifactRepository(
      this.scope,
      `${this.props.repositoryName}-npm-repository`,
      {
        repository: 'npm-public',
        domain: this.domain.domain,
        externalConnections: {
          externalConnectionName: 'public:npmjs',
        },
        tags: { Name: 'npm-public-external-connection' },
      }
    );
    Utils.addPublicTag(npmPublicExternalConnection);

    this.repository = new CodeartifactRepository(
      this.scope,
      `${this.props.repositoryName}-repository`,
      {
        repository: this.props.repositoryName,
        domain: this.domain.domain,
        upstream: [{ repositoryName: npmPublicExternalConnection.repository }],
        dependsOn: [npmPublicExternalConnection],
        tags: { Name: this.props.repositoryName },
      }
    );

    new CodeartifactRepositoryPermissionsPolicy(
      this.scope,
      `${this.props.repositoryName}-repository-policy`,
      {
        domain: this.domain.domain,
        repository: this.repository.repository,
        policyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Principal: {
                Service: ['codebuild.amazonaws.com'],
              },
              Action: [
                'codeartifact:DescribePackageVersion',
                'codeartifact:DescribeRepository',
                'codeartifact:GetPackageVersionReadme',
                'codeartifact:GetRepositoryEndpoint',
                'codeartifact:ListPackageVersionAssets',
                'codeartifact:ListPackageVersionDependencies',
                'codeartifact:ListPackageVersions',
                'codeartifact:ListPackages',
                'codeartifact:PublishPackageVersion',
                'codeartifact:PutPackageMetadata',
                'codeartifact:ReadFromRepository',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        }),
      }
    );
  }

  /**
   * @return {CodeartifactRepository} - Repository created from the construct
   */
  public get codeartifactRepositoryResource(): CodeartifactRepository {
    return this.repository;
  }

  /**
   * @return {CodeartifactDomain} - Domain created from the construct
   */
  public get codeartifactDomainResource(): CodeartifactDomain {
    return this.domain;
  }
}
