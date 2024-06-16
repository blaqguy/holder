import { CodebuildSourceCredential } from '@cdktf/provider-aws/lib/codebuild-source-credential';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { PlatformSecrets, Utils } from '@dragonfly/utils';

/**
 * The DfCodeBuildCredentialStack class represents an AWS CodeBuild source credential
 * This class helps you create a CodeBuild source credential in a
 * modular and organized way.
 * ! Codebuild only allows a single credential per given server type in a given region.
 * ! Therefore, when you define aws_codebuild_source_credential, aws_codebuild_project
 * ! resource defined in the same module will use it.
 * ! (https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_source_credential)
 * @extends {RemoteStack}
 *
 */
export class DfCodeBuildCredentialStack extends RemoteStack {
  /**
   * Creates an instance of DfCodeBuildCredentialStack.
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig
  ) {
    super(stackId, stackConfig);

    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

    new CodebuildSourceCredential(this, 'codebuild-credentials', {
      serverType: 'GITHUB',
      authType: 'PERSONAL_ACCESS_TOKEN',
      token: sopsData.EMEKA_GITHUB_PA_TOKEN,
    });
  }
}
