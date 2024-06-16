import { AccessanalyzerAnalyzer } from '@cdktf/provider-aws/lib/accessanalyzer-analyzer';
import { RemoteStack, StackConfig } from '../stacks';

export class DfAccessAnalyzerStack extends RemoteStack {
  /**
   *
   * @param {string} stackName - the stack name
   * @param {StackConfig} stackConfig - the access analyzer properties
   */

  constructor(stackName: string, protected stackConfig: StackConfig) {
    super(stackName, stackConfig);

    new AccessanalyzerAnalyzer(this, 'org-level-access-analyzer', {
      analyzerName: 'org-level-access-analyzer',
      type: 'ORGANIZATION_UNUSED_ACCESS',
    });
  }
}
