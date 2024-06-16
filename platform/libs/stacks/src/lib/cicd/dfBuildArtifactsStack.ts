import {
  DfCodeartifactConstruct,
  DfCodeartifactProps,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';

/**
 * CICD Build artifact stack
 */
export class DfBuildArtifactStack extends RemoteStack {
  private codeaftifactConstruct: DfCodeartifactConstruct;

  /**
   *
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   * @param {DfCodeartifactProps} props - props passed to Codeartifact construct
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    protected readonly props: DfCodeartifactProps
  ) {
    super(stackId, stackConfig);

    this.codeaftifactConstruct = new DfCodeartifactConstruct(this, this.props);
  }

  /**
   * @return {DfCodeartifactConstruct} - Getter for the Codeartifact construct
   */
  public get codeartifactConstruct() {
    return this.codeaftifactConstruct;
  }
}
