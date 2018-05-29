import Bunyan from "bunyan";

import {
  ClientPool,
  ClientRoot
} from "@taskbotjs/client";

import { ServerBase } from ".";
import { PluginConfig } from "../Config/Config";

export interface ConstructableServerPlugin {
  new(baseLogger: Bunyan, server: ServerBase): ServerPluginBase;
}

export abstract class ServerPluginBase {
  protected readonly logger: Bunyan;

  constructor(baseLogger: Bunyan, protected readonly server: ServerBase) {
    this.logger = baseLogger.child({ component: this.constructor.name, componentType: "plugin" });
  }

  protected get clientPool(): ClientPool { return this.server.clientPool; }

  abstract async doInitialize(): Promise<void>;
  abstract async doCleanup(): Promise<void>;

  /**
   * Invoked when the server is starting up. All server plugins are initialized before
   * any jobs are accepted.
   */
  protected abstract async initialize(): Promise<void>;

  /**
   * Invoked when the server is shutting down. Server plugin cleanup happens after all
   * jobs have drained out of JSJobs.
   */
  protected abstract async cleanup(): Promise<void>;

  protected async withClient<T>(fn: (taskbot: ClientRoot) => Promise<T>): Promise<T> {
    return this.server.clientPool.use((taskbot) => fn(taskbot));
  }
}

export abstract class ServerPlugin<TConfig extends PluginConfig> extends ServerPluginBase {
  protected abstract get config(): TConfig;

  async doInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info("Plugin installed, but not enabled.");
    } else {
      this.logger.info("Initializing.");

      await this.initialize();
    }
  }

  async doCleanup(): Promise<void> {
    if (this.config.enabled) {
      this.logger.info("Cleaning up.");

      await this.cleanup();
    }
  }
}
