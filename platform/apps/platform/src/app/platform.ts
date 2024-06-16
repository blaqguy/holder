import { App } from 'cdktf';
import { default as Environment } from '../environments/environment';
import { PlatformSecrets } from '@dragonfly/utils';

/**
 * Dragonfly Platform
 */
export class DragonflyPlatform {
  private dragonflyApp: App;

  /**
   * Creates Dragonfly platform
   * @param {SopsData} sopsData - SOPS JSON secrets data
   * @constructor
   */
  constructor(sopsData: PlatformSecrets) {
    this.dragonflyApp = new App();
    this.dragonflyApp.node.setContext('sopsData', sopsData);

    Environment.getInstance(this.dragonflyApp);

    this.dragonflyApp.synth();
  }
}
