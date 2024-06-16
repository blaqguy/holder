import { Constants } from '@dragonfly/utils';

export interface PaloAltoConfigs {
  [key: string]: {
    name: string;
    ami: string;
    instanceType: string;
    rootVolumeSize: number;
    region: string;
    azIndex: number;
  }[];
}

/**
 * Class defining the prod palo alto configurations
 */
export abstract class PaloAltoConfiguration {
  public static Configuration: PaloAltoConfigs = {
    vpn: [
      {
        name: `Palo-vpn-primary-1`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        azIndex: 0,
      },
      {
        name: `Palo-vpn-primary-2`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        azIndex: 1,
      },
      {
        name: `Palo-vpn-recovery-1`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        azIndex: 0,
      },
      {
        name: `Palo-vpn-recovery-2`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        azIndex: 1,
      },
    ],
    ingress: [
      {
        name: `Palo-ingress-primary-1`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        azIndex: 0,
      },
      {
        name: `Palo-ingress-primary-2`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        azIndex: 1,
      },
      {
        name: `Palo-ingress-recovery-1`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        azIndex: 0,
      },
      {
        name: `Palo-ingress-recovery-2`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        azIndex: 1,
      },
    ],
    egress: [
      {
        name: `Palo-egress-primary-1`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        azIndex: 0,
      },
      {
        name: `Palo-egress-primary-2`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        azIndex: 1,
      },
      {
        name: `Palo-egress-recovery-1`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        azIndex: 0,
      },
      {
        name: `Palo-egress-recovery-2`,
        ami: Constants.AMIS.PALO_ALTO_BYOL,
        instanceType: 'c5n.xlarge',
        rootVolumeSize: 100,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
        azIndex: 1,
      },
    ],
  };
}
