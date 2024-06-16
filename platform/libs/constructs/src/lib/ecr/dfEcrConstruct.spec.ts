import { EcrRepository } from '@cdktf/provider-aws/lib/ecr-repository';
import { EcrRepositoryPolicy } from '@cdktf/provider-aws/lib/ecr-repository-policy';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfEcrConstruct } from '../constructs';

describe('Ecr Constructs', () => {
  it('\r\nShould create an EcrRepository, a DataAwsCallerIdentity,\r\nand finally an EcrRepositoryPolicy', () => {
    const id = 'id';
    const repoName = 'privateRepoName';
    const synthedMockStack = Testing.synthScope((mockStack) => {
      // Create some object that is synth'able
      new DfEcrConstruct(mockStack, id, repoName);
    });

    const parsedJson = JSON.parse(synthedMockStack);
    const keyJson = parsedJson['resource'][EcrRepositoryPolicy.tfResourceType];
    const keyPolicy = Object.keys(keyJson)[0];
    const policyJson = JSON.parse(keyJson[keyPolicy]['policy']);

    expect(synthedMockStack).toHaveResourceWithProperties(EcrRepository, {
      name: repoName,
      image_tag_mutability: 'MUTABLE',
      encryption_configuration: [
        {
          encryption_type: 'AES256',
        },
      ],
      image_scanning_configuration: {
        scan_on_push: true,
      },
      force_delete: true,
      tags: {
        Name: repoName,
      },
    });

    expect(policyJson).toMatchObject({
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
          Principal: {},
        },
      ],
    });
  });
});
