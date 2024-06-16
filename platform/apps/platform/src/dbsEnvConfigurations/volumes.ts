import { volumeProperties } from '@dragonfly/stacks';

export interface DfVolumeConfig {
  [key: string]: volumeProperties;
}
export const QE_VOLUME_CONFIG: DfVolumeConfig = {
  appVolumeReduced: {
    volumeName: 'appSupport',
    volumeSize: 150,
    deviceName: '/dev/sdg',
    encrypted: true,
  },
  webVolumeReduced: {
    volumeName: 'appSupport',
    volumeSize: 150,
    deviceName: '/dev/sdg',
    encrypted: true,
  },
  mqVolumeReduced: {
    volumeName: 'appSupport',
    volumeSize: 150,
    deviceName: '/dev/sdg',
    encrypted: true,
  },
  dbVolumeReduced: {
    volumeName: 'appSupport',
    volumeSize: 150,
    deviceName: '/dev/sdg',
    encrypted: true,
  },
};
