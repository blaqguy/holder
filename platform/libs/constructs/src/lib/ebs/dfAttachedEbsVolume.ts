import { EbsVolume } from '@cdktf/provider-aws/lib/ebs-volume';
import { VolumeAttachment } from '@cdktf/provider-aws/lib/volume-attachment';
import { Construct } from 'constructs';
import {
  DfAliasedKeyConstruct,
  DfPrivateInstanceConstruct,
} from '../constructs';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

interface DfEbsVolumeConfig {
  volume: {
    name: string;
    size: number;
    type?: 'standard' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'sc2';
  };
  attachment: {
    deviceName: string;
  };
  deps: {
    instance: DfPrivateInstanceConstruct;
    key?: DfAliasedKeyConstruct;
    encrypted?: boolean;
  };
  provider?: AwsProvider;
}

/**
 * Ebs volume to be mounted on an instance
 */
export class DfAttachedEbsVolume extends Construct {
  private volume: EbsVolume;

  /**
   *
   * @param {Construct} scope - Stack
   * @param {string} constructName - Construct Name
   * @param {DfEbsVolumeConfig} config - Construct config
   */
  constructor(
    private scope: Construct,
    private constructName: string,
    private config: DfEbsVolumeConfig
  ) {
    super(scope, constructName);

    this.volume = new EbsVolume(this, this.config.volume.name, {
      provider: this.config.provider,
      availabilityZone: this.config.deps.instance.instanceAz,
      size: this.config.volume.size,
      type: this.config.volume.type ?? 'gp3',
      encrypted: this.config.deps.encrypted ?? false,
      kmsKeyId: this.config.deps.key ? this.config.deps.key.key.arn : null,
      finalSnapshot: true,

      tags: {
        Name: this.config.volume.name,
      },
    });

    new VolumeAttachment(this, `${this.config.volume.name}-attachment`, {
      provider: this.config.provider,
      deviceName: this.config.attachment.deviceName,
      volumeId: this.volume.id,
      instanceId: this.config.deps.instance.instanceResource.id,
    });
  }
}
