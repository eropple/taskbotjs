import Bunyan from "bunyan";
import sleepAsync from "sleep-promise";
import { Duration } from "luxon";

import {
  ClientRoot
} from "@taskbotjs/client";

import { TimeInterval } from "../Config";
import { sleepFor } from "../util";
import { PollerConfig, DurationFields } from "../Config/Config";
import { intervalSplayMilliseconds } from "../util/random";
import { ServerBase } from ".";

export type PollerFunction = (taskbot: ClientRoot) => Promise<void>;

export class Poller {
  protected readonly logger: Bunyan;

  private timeout: NodeJS.Timer | null = null;
  private executing: boolean = false;

  constructor(
    baseLogger: Bunyan,
    protected readonly server: ServerBase,
    private readonly fn: PollerFunction,
    readonly frequency: TimeInterval
  ) {
    this.logger = baseLogger.child({ aspect: "poller" });
  }

  async doStart(): Promise<void> {
    await this.loop();
    this.setLoopOnTimeout();
  }

  private async loop(): Promise<void> {
    this.executing = true;

    try {
      this.logger.trace("Entering poll iteration.");
      await this.server.clientPool.use(async (taskbot) => this.fn(taskbot));
    } catch (err) {
      this.logger.error(err);
    }

    this.executing = false;

    this.setLoopOnTimeout();
  }

  private setLoopOnTimeout(): void {
    const next = intervalSplayMilliseconds(this.frequency.interval, this.frequency.splay);
    this.timeout = setTimeout(() => this.loop(), next);
  }

  async doStop(): Promise<void> {
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
