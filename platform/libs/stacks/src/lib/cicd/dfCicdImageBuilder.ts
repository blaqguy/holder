import { DfImageBuilderConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';

/**
 * Image builder stack for building custom image to be used with CodeBuild
 */
export class DfCicdImageBuilder extends RemoteStack {
  /**
   *
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    protected readonly platformSandboxDeploy?: boolean
  ) {
    super(stackId, stackConfig);

    new DfImageBuilderConstruct(this, 'cicd-pipeline', {
      imageName: 'cicd-pipeline',
      dockerfileDir: 'buildAssets/codebuild-image/',
      platformSandboxDeploy: platformSandboxDeploy,
      federatedAccountId: this.stackConfig.federatedAccountId,
    });
  }
}
