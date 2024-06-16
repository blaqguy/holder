import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import {
  DfSsmAssociationConfig,
  DfSsmAssociationConstruct,
} from './dfSsmAssociationConstruct';
import { Construct } from 'constructs';

interface DfSsmRunPowershellScriptAssociationConfig
  extends DfSsmAssociationConfig {
  command: string;
}

/**
 * Dragonfly FT implementation of an SSM Association for executing PowerShell
 */
export class DfSsmRunPowershellScriptAssociationConstruct extends DfSsmAssociationConstruct {
  /**
   * @param {Constuct} scope
   * @param {string} id
   * @param {DfSsmRunPowershellScriptAssociationConfig} config
   */
  constructor(
    scope: Construct,
    id: string,
    config: DfSsmRunPowershellScriptAssociationConfig
  ) {
    super(scope, id, config);

    new SsmAssociation(scope, `${id}-powershell-script`, {
      provider: config.provider,
      name: 'AWS-RunPowerShellScript',
      associationName: `${id}-powershell-script`,
      parameters: {
        commands: config.command,
      },
      targets: this.targets,
    });
  }
}
