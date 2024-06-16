import { App } from 'cdktf';
import { AbstractEnvironment } from './abstractEnvironment';

/**
 * Default Environment config, this is intended to be overridden via the build configurations found in project.json
 */
export default class Environment {
  /**
   * This is a constructor stub intended to provide type information to platform.ts
   * @constructor
   * @param {App} app - The Root CDKTF APP
   */
  constructor(private app: App) {}

  /**
   * @param {App} app - The Root CDKTF APP
   */
  public static getInstance(app: App): AbstractEnvironment {
    throw new Error(`Error - method not implemented: ${app}`);
  }
}
