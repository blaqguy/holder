import { tierProperties } from '@dragonfly/stacks';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { QE_VOLUME_CONFIG } from './volumes';

export const QE_APP_REDUCED: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 't3.xlarge',
  volumes: [QE_VOLUME_CONFIG.appVolumeReduced],
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
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 't3.xlarge',
  volumes: [QE_VOLUME_CONFIG.mqVolumeReduced],
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

export const QE_WEB_REDUCED: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 't3.xlarge',
  volumes: [QE_VOLUME_CONFIG.webVolumeReduced],
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

export const QE_DB_REDUCED: tierProperties = {
  count: 1,
  ami: Constants.MANAGED_AMI_IDS.LEGACY[Constants.AMIS.CIS_BASE_IMAGE_LATEST],
  instanceType: 't3.xlarge',
  volumes: [QE_VOLUME_CONFIG.webVolumeReduced],
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
