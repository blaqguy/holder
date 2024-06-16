import { volumeProperties } from '@dragonfly/stacks';

export interface DfVolumeConfig {
  [key: string]: volumeProperties;
}
export const QE_VOLUME_CONFIG: DfVolumeConfig = {
  appVolumeLegacy: {
    volumeName: 'appSupport',
    volumeSize: 250,
    deviceName: '/dev/sdg',
  },
  appVolumeReduced: {
    volumeName: 'appSupport',
    volumeSize: 50,
    deviceName: '/dev/sdg',
  },
  appVolumeReducedEncrypted: {
    volumeName: 'appSupport',
    volumeSize: 50,
    deviceName: '/dev/sdg',
    volumeType: 'gp3',
    encrypted: true,
  },
  mqPlatformLegacy: {
    volumeName: 'Platform',
    volumeSize: 350,
    deviceName: '/dev/sdg',
  },
  mqAppLegacy: {
    volumeName: 'Apps',
    volumeSize: 200,
    deviceName: '/dev/sdh',
  },
  mqPlatformReduced: {
    volumeName: 'Platform',
    volumeSize: 50,
    deviceName: '/dev/sdg',
  },
  mqPlatformReducedEncrypted: {
    volumeName: 'Platform',
    volumeSize: 50,
    deviceName: '/dev/sdg',
    volumeType: 'gp3',
    encrypted: true,
  },
  mqAppReduced: {
    volumeName: 'Apps',
    volumeSize: 50,
    deviceName: '/dev/sdh',
  },
  mqAppReducedEncrpyted: {
    volumeName: 'Apps',
    volumeSize: 50,
    deviceName: '/dev/sdh',
    volumeType: 'gp3',
    encrypted: true,
  },
  msiVolumeLegacy: {
    volumeName: 'Support',
    volumeSize: 250,
    deviceName: '/dev/sdg',
  },
  msiVolumeReduced: {
    volumeName: 'Support',
    volumeSize: 50,
    deviceName: '/dev/sdg',
  },
  msiVolumeReducedEncrypted: {
    volumeName: 'Support',
    volumeSize: 50,
    deviceName: '/dev/sdg',
    volumeType: 'gp3',
    encrypted: true,
  },
  rptVolumeLegacy: {
    volumeName: 'Support',
    volumeSize: 250,
    deviceName: '/dev/sdg',
  },
  rptVolumeReduced: {
    volumeName: 'Support',
    volumeSize: 20,
    deviceName: '/dev/sdg',
  },
  rptVolumeReducedEncrypted: {
    volumeName: 'Support',
    volumeSize: 20,
    deviceName: '/dev/sdg',
    volumeType: 'gp3',
    encrypted: true,
  },
  webVolumeLegacy: {
    volumeName: 'Support',
    volumeSize: 250,
    deviceName: '/dev/sdg',
  },
  webVolumeReduced: {
    volumeName: 'Support',
    volumeSize: 20,
    deviceName: '/dev/sdg',
  },
  webVolumeReducedEncrypted: {
    volumeName: 'Support',
    volumeSize: 20,
    deviceName: '/dev/sdg',
    volumeType: 'gp3',
    encrypted: true,
  },
  rtVolumeLegacy: {
    volumeName: 'Support',
    volumeSize: 250,
    deviceName: '/dev/sdg',
  },
  rtVolumeReduced: {
    volumeName: 'Support',
    volumeSize: 50,
    deviceName: '/dev/sdg',
  },
};
