import Bunyan from "bunyan";
import { DateTime } from "luxon";

import { ServerBase } from "..";
import { ClientPool, WorkerInfo } from "@taskbotjs/client";
import { VERSION, FLAVOR } from "../..";

export class Heartbeat {
  private readonly logger: Bunyan;
  private readonly key: string;

  private timeout: NodeJS.Timer;
  private isShuttingDown: boolean = false;

  constructor(baseLogger: Bunyan, private readonly server: ServerBase, private readonly clientPool: ClientPool) {
    this.logger = baseLogger.child({ component: "Heartbeat" });
  }

  start() {
    this.timeout = setInterval(
      async () => {
        if (!this.isShuttingDown) {
          this.clientPool.use(async (taskbot) => taskbot.updateWorkerInfo(this.buildWorkerInfo()));
        }
      },
      250
    );
  }

  async shutdown() {
    this.logger.info("Shutting down heartbeat.");
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
