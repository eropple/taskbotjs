import Bunyan from "bunyan";
import sleepAsync from "sleep-promise";

import { ClientRoot, ClientPool } from "@jsjobs/client";

import { Config } from "../..";
import { TimeInterval, RedisClientOptions } from "../../Config";

import { sleepFor } from "../../util";
import { PollingConfig } from "../../Config/Config";

export interface IPoller {
  start(): void;
  loop(): Promise<void>;
  shutdown(): Promise<void>;
}

export abstract class Poller<TPollerConfig extends PollingConfig> implements IPoller {
  protected readonly pollerConfig: TPollerConfig;
  protected readonly logger: Bunyan;
  protected readonly clientPool: ClientPool;

  private isShuttingDown: boolean = false;
  private hasShutDown: boolean = false;

  constructor(pollerConfig: TPollerConfig, clientPool: ClientPool, baseLogger: Bunyan) {
    this.pollerConfig = pollerConfig;
    this.clientPool = clientPool;
    this.logger = baseLogger.child({ component: this.constructor.name });
  }

  start(): void {
    this.logger.debug("Starting poller.");

    this.loop();
  }

  async loop(): Promise<void> {
    this.logger.debug("Entering loop.");

    while (!this.isShuttingDown) {
      try {
        await this.clientPool.use(async (client) => {
          return this.loopIter(client);
        });
      } catch (err) {
        this.logger.error(err, "Error in polling.");
      }

      await sleepFor(this.pollerConfig.polling);
    }

    this.logger.debug("Loop exited.");
    this.hasShutDown = true;
  }

  abstract async loopIter(client: ClientRoot): Promise<void>;

  async shutdown(): Promise<void> {
    this.logger.debug("Stopping poller.");
    this.isShuttingDown = true;

    while (!this.hasShutDown) {
      await sleepAsync(100);
    }

    this.logger.debug("Poller stopped.");
  }
}
