import Bunyan from "bunyan";
import { DateTime } from "luxon";

import {
  ClientPool,
  WorkerInfo
} from "@taskbotjs/client";

import { ServerBase } from "..";
import { ServerPlugin } from "../../ServerPlugin";
import { VERSION, FLAVOR } from "../..";
import { PluginConfig } from "../../Config/Config";

/**
 * Handles worker heartbeat updates through the poller mechanism.
 *
 * @private
 */
export class Heartbeat extends ServerPlugin<PluginConfig> {
  private static readonly CONFIG: PluginConfig = { enabled: true };

  private timeout: NodeJS.Timer;
  private isShuttingDown: boolean = false;

  // this plugin requires no plugin and is always enabled.
  protected get config() { return Heartbeat.CONFIG; }

  async initialize(): Promise<void> {
    this.timeout = setInterval(
      async () => {
        if (!this.isShuttingDown) {
          await this.withClient(async (taskbot) => taskbot.updateWorkerInfo(this.buildWorkerInfo()));
        }
      },
      250
    );
  }

  async cleanup(): Promise<void> {
    if (this.timeout) {
      this.isShuttingDown = true;
      clearInterval(this.timeout);
    } else {
      this.logger.warn("Timeout was not established - improper startup?");
    }

    this.logger.info("Clearing worker from storage.");
    await this.clientPool.use(async (taskbot) => taskbot.clearWorkerInfo(this.server.name));
  }

  private buildWorkerInfo(): WorkerInfo {
    return {
      name: this.server.name,
      version: VERSION,
      flavor: FLAVOR,
      concurrency: this.server.config.concurrency,
      active: this.server.activeWorkerCount,
      lastBeat: DateTime.utc().valueOf()
    };
  }
}
