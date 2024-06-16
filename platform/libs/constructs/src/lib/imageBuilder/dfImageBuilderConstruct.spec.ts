import { Testing } from 'cdktf';
import { DfImageBuilderConstruct } from './dfImageBuilderConstruct';
import 'cdktf/lib/testing/adapters/jest';
import { Constants } from '@dragonfly/utils';

describe('Image builder pipeline snapshot test', () => {
  it('Should create a pipeline that builds a Docker image and publishes to ECR', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      new DfImageBuilderConstruct(mockStack, 'test-image-builder-pipeline', {
        imageName: 'test-image',
        dockerfileDir: 'path/to/dockerfile/dir',
        federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
      });
    });
    expect(synthedMockStack).toMatchSnapshot();
  });
});
