import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import {
  DfSsmAssociationConfig,
  DfSsmAssociationConstruct,
} from './dfSsmAssociationConstruct';
import { Construct } from 'constructs';

interface DfSsmRunShellScriptAssociationConfig extends DfSsmAssociationConfig {
  command: string;
}

/**
 * Dragonfly FT implementation of an SSM Association for executing PowerShell
 */
export class DfSsmRunShellScriptAssociationConstruct extends DfSsmAssociationConstruct {
  /**
   * @param {Constuct} scope
   * @param {string} id
   * @param {DfSsmRunShellScriptAssociationConfig} config
   */
  constructor(
    scope: Construct,
    id: string,
    config: DfSsmRunShellScriptAssociationConfig
  ) {
    super(scope, id, config);

    new SsmAssociation(scope, `${id}-shell-script`, {
      provider: config.provider,
      name: 'AWS-RunShellScript',
      associationName: `${id}-shell-script`,
      parameters: {
        commands: config.command,
      },
      targets: this.targets,
    });
  }
}
