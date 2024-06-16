import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Construct } from 'constructs';

export interface DfSsmAssociationConfig {
  provider: AwsProvider;
  targetType: 'InstanceIds' | 'tag';
  instanceIds?: string[];
  tagKey?: string;
  tagValues?: string[];
}

/**
 * Base class for Dragonfly FT implementations of an SSM associations
 */
export abstract class DfSsmAssociationConstruct {
  protected readonly scope: Construct;
  protected readonly id: string;
  protected readonly targets: {
    key: string;
    values: string[];
  }[];

  /**
   *
   * @param {Constuct} scope
   * @param {string} id
   * @param {DfSsmAssociationConfig} config
   */
  constructor(scope: Construct, id: string, config: DfSsmAssociationConfig) {
    this.scope = scope;
    this.id = id;

    if (config.targetType === 'InstanceIds') {
      if (config.instanceIds) {
        this.targets = [
          {
            key: 'InstanceIds',
            values: config.instanceIds,
          },
        ];
      } else {
        throw new Error('instanceIds required for InstanceIds targetType');
      }
    } else if (config.targetType === 'tag') {
      if (config.tagKey && config.tagValues) {
        this.targets = [
          {
            key: `tag:${config.tagKey}`,
            values: config.tagValues,
          },
        ];
      } else {
        throw new Error('tagKey and tagValue required for tag targetType');
      }
    }
  }
}
