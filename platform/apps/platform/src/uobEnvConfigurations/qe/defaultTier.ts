import { tierProperties } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { QE_VOLUME_CONFIG } from './volumes';

export const QE_APP_LEGACY: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 'r6i.xlarge',
  volumes: [QE_VOLUME_CONFIG.appVolumeLegacy],
  instanceResourceConfig: {
    disableApiTermination: true,
    disableApiStop: false,
    userDataReplaceOnChange: false,
    tags: {
      'volume-reduction-target': 'false',
      'volume-reduction-restore-target': 'false',
    },
  },
  tierIngresses: [
    {
      description: 'Allow SSH from Tools',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: [`${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`],
    },
  ],
  templateEnabled: false,
  hostnamePattern:
    '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
  userDataFileName: 'install-ssm-agent.sh',
};

export const QE_APP_REDUCED: tierProperties = {
  ...QE_APP_LEGACY,
  ...{
    volumes: [QE_VOLUME_CONFIG.appVolumeReduced],
  },
};

export const QE_APP_REDUCED_ENCRYPTED: tierProperties = {
  ...QE_APP_LEGACY,
  ...{
    volumes: [QE_VOLUME_CONFIG.appVolumeReducedEncrypted],
  },
};

export const QE_MQ_LEGACY: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 'm6i.large',
  volumes: [QE_VOLUME_CONFIG.mqPlatformLegacy, QE_VOLUME_CONFIG.mqAppLegacy],
  instanceResourceConfig: {
    disableApiTermination: true,
    disableApiStop: false,
    userDataReplaceOnChange: false,
    tags: {
      'volume-reduction-target': 'false',
      'volume-reduction-restore-target': 'false',
    },
  },
  tierIngresses: [
    {
      description: 'Allow SSH from Tools',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: [`${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`],
    },
  ],
  templateEnabled: false,
  hostnamePattern:
    '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
  userDataFileName: 'install-ssm-agent.sh',
};

export const QE_MQ_REDUCED: tierProperties = {
  ...QE_MQ_LEGACY,
  ...{
    volumes: [
      QE_VOLUME_CONFIG.mqPlatformReduced,
      QE_VOLUME_CONFIG.mqAppReduced,
    ],
  },
};

export const QE_MQ_REDUCED_ENCRYPTED: tierProperties = {
  ...QE_MQ_LEGACY,
  ...{
    volumes: [
      QE_VOLUME_CONFIG.mqPlatformReducedEncrypted,
      QE_VOLUME_CONFIG.mqAppReducedEncrpyted,
    ],
  },
};

export const QE_MSI_LEGACY: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 'r6i.large',
  volumes: [QE_VOLUME_CONFIG.msiVolumeLegacy],
  instanceResourceConfig: {
    disableApiTermination: true,
    disableApiStop: false,
    userDataReplaceOnChange: false,
    tags: {
      'volume-reduction-target': 'false',
      'volume-reduction-restore-target': 'false',
    },
  },
  tierIngresses: [
    {
      description: 'Temp rule to allow all traffic from within VPC',
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: [DfAccounts.getQeAccountDef().vpcCidrs.main.legacy],
    },
    {
      description: 'Allow SSH from Tools',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: [`${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`],
    },
  ],
  templateEnabled: false,
  hostnamePattern:
    '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
  userDataFileName: 'install-ssm-agent.sh',
};

export const QE_MSI_REDUCED: tierProperties = {
  ...QE_MSI_LEGACY,
  ...{
    volumes: [QE_VOLUME_CONFIG.msiVolumeReduced],
  },
};

export const QE_MSI_REDUCED_ENCRYPTED: tierProperties = {
  ...QE_MSI_LEGACY,
  ...{
    volumes: [QE_VOLUME_CONFIG.msiVolumeReducedEncrypted],
  },
};

export const QE_RPT_LEGACY: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 'r6i.large',
  volumes: [QE_VOLUME_CONFIG.rptVolumeLegacy],
  instanceResourceConfig: {
    disableApiTermination: true,
    userDataReplaceOnChange: false,
    disableApiStop: false,
    tags: {
      'volume-reduction-target': 'false',
      'volume-reduction-restore-target': 'false',
    },
  },
  tierIngresses: [
    {
      description: 'Allow SSH from Tools',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: [`${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`],
    },
  ],
  templateEnabled: false,
  hostnamePattern:
    '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
  userDataFileName: 'install-ssm-agent.sh',
};

export const QE_RPT_REDUCED: tierProperties = {
  ...QE_RPT_LEGACY,
  ...{ volumes: [QE_VOLUME_CONFIG.rptVolumeReduced] },
};

export const QE_RPT_REDUCED_ENCRYPTED: tierProperties = {
  ...QE_RPT_LEGACY,
  ...{ volumes: [QE_VOLUME_CONFIG.rptVolumeReducedEncrypted] },
};

export const QE_WEB_LEGACY: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 't3.medium',
  volumes: [QE_VOLUME_CONFIG.webVolumeLegacy],
  instanceResourceConfig: {
    disableApiTermination: true,
    userDataReplaceOnChange: false,
    disableApiStop: false,
    tags: {
      'volume-reduction-target': 'false',
      'volume-reduction-restore-target': 'false',
    },
  },
  tierIngresses: [
    {
      description: 'Allow SSH from Tools',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: [`${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`],
    },
  ],
  templateEnabled: false,
  hostnamePattern:
    '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
  userDataFileName: 'install-ssm-agent.sh',
};

export const QE_WEB_REDUCED: tierProperties = {
  ...QE_WEB_LEGACY,
  ...{ volumes: [QE_VOLUME_CONFIG.webVolumeReduced] },
};

export const QE_RT_LEGACY: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 'r6i.large',
  volumes: [QE_VOLUME_CONFIG.rtVolumeLegacy],
  instanceResourceConfig: {
    disableApiTermination: true,
    disableApiStop: false,
    userDataReplaceOnChange: false,
    tags: {
      'volume-reduction-target': 'false',
      'volume-reduction-restore-target': 'false',
    },
  },
  tierIngresses: [
    {
      description: 'Allow SSH from Tools',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: [`${DfAccounts.getToolsAccountDef().vpcCidrs.main.legacy}`],
    },
  ],
  templateEnabled: false,
  userDataFileName: 'install-ssm-agent.sh',
  hostnamePattern:
    '${UobTier.TOKENS.fiName}${UobTier.TOKENS.envSubdomain}${UobTier.TOKENS.tier}${UobTier.TOKENS.instanceIndex}',
};

export const QE_RT_REDUCED: tierProperties = {
  ...QE_RT_LEGACY,
  ...{ volumes: [QE_VOLUME_CONFIG.rtVolumeReduced] },
};

export const QE_WEB_REDUCED_ENCRYPTED: tierProperties = {
  ...QE_WEB_LEGACY,
  ...{ volumes: [QE_VOLUME_CONFIG.webVolumeReducedEncrypted] },
};
