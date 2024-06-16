import { DfEcrConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';
import { TerraformOutput } from 'cdktf';
import { Constants } from '@dragonfly/utils';

interface EcrConfig {
  servicePrincipal?: string;
  accountId?: string;
  region?: Constants.AWS_REGION_ALIASES;
}

/**
 * Custom Codebuild image stack
 */
export class DfEcrDeployStack extends RemoteStack {
  /**
   *
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   * @param {EcrConfig} ecrConfig - optional ecr config including service principal and/or accountId
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    protected readonly ecrConfig?: EcrConfig
  ) {
    super(stackId, stackConfig);
    const provider = this.getProviderForRegion(ecrConfig.region);
    const ecr = new DfEcrConstruct(
      this,
      stackId,
      stackId,
      ecrConfig.servicePrincipal,
      ecrConfig.accountId,
      provider
    );
    new TerraformOutput(this, `${stackId}-url`, {
      value: ecr.repoUrl,
    });
  }
}
