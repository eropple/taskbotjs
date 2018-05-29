import sleepAsync from "sleep-promise";

import {
  ClientRoot
} from "@taskbotjs/client";

import { TimeInterval } from "../Config";
import { ServerPlugin } from "./ServerPlugin";
import { sleepFor } from "../util";
import { PollerConfig } from "../Config/Config";
import { intervalSplayMilliseconds } from "../util/random";

export abstract class ServerPoller<TConfig extends PollerConfig> extends ServerPlugin<TConfig> {
  private timeout: NodeJS.Timer | null = null;
  private executing: boolean = false;

  async doStart(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info("Poller installed, but not enabled.");
    } else {
      this.logger.info("Starting poller.");

      await this.loop();
      this.setLoopOnTimeout();
    }
  }

  private async loop(): Promise<void> {
    this.executing = true;

    try {
      this.logger.debug("Entering poll iteration.");
      await this.withClient(async (taskbot) => this.loopIter(taskbot));
    } catch (err) {
      this.logger.error(err);
    }

    this.executing = false;

    this.setLoopOnTimeout();
  }

  private setLoopOnTimeout(): void {
    const next = intervalSplayMilliseconds(this.config.polling.interval, this.config.polling.splay);
    this.timeout = setTimeout(() => this.loop(), next);
  }

  async doStop(): Promise<void> {
    if (this.config.enabled) {
      this.logger.info("Stopping poller.");

      if (this.executing) {
        this.logger.trace("Waiting for poller to finish.");
        await sleepAsync(100);
      }

      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      this.logger.info("Poller stopped.");
    }
  }

  protected abstract async loopIter(taskbot: ClientRoot): Promise<void>;
}
