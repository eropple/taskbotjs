import sleepAsync from "sleep-promise";

import { ClientRoot } from "@taskbotjs/client";

import { TimeInterval } from "../Config";
import { ServerPlugin } from "../ServerPlugin";
import { sleepFor } from "../util";
import { PollerConfig } from "../Config/Config";

export abstract class ServerPoller<TConfig extends PollerConfig> extends ServerPlugin<TConfig> {
  private running: boolean = false;
  private hasShutDown: boolean = false;

  async doStart(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info("Poller installed, but not enabled.");
    } else {
      this.logger.info("Starting poller.");

      this.running = true;
      while (this.running) {
        try {
          await this.withClient(async (taskbot) => this.loopIter(taskbot));
        } catch (err) {
          this.logger.error({ err }, "Error when polling.");
        }

        await sleepFor(this.config.polling);
      }

      this.hasShutDown = true;
      this.logger.info("Poll loop has exited.");
    }
  }

  async doStop(): Promise<void> {
    if (this.config.enabled) {
      this.logger.info("Stopping poller.");
      this.running = false;

      while (!this.hasShutDown) {
        this.logger.trace("Waiting for shutdown.");
        await sleepAsync(100);
      }

      this.logger.info("Poller stopped.");
    }
  }

  protected abstract async loopIter(taskbot: ClientRoot): Promise<void>;
}
