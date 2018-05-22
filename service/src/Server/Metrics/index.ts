import Bunyan from "bunyan";
import { DateTime } from "luxon";

import { ServerBase } from "..";
import { ClientPool, JobDescriptor, LUXON_YMD } from "@jsjobs/client";

export class Metrics {
  private readonly logger: Bunyan;

  constructor(baseLogger: Bunyan, private readonly server: ServerBase, private readonly clientPool: ClientPool) {
    this.logger = baseLogger.child({ component: "Metrics" });
  }

  attach() {
    this.logger.info("Attaching metrics listeners.");

    this.server.onJobComplete(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status.endedAt, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/processed";
      const dateKey = "metrics/processed/" + date;
      await this.clientPool.use(async (jsjobs) => {
        await jsjobs.incrementCounter(allKey);
        await jsjobs.incrementCounter(dateKey);
      });
    });

    this.server.onJobError(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status.endedAt, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/errored";
      const dateKey = "metrics/errored/" + date;
      await this.clientPool.use(async (jsjobs) => {
        await jsjobs.incrementCounter(allKey);
        await jsjobs.incrementCounter(dateKey);
      });
    });

    this.server.onJobDeath(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status.endedAt, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/died";
      const dateKey = "metrics/died/" + date;
      await this.clientPool.use(async (jsjobs) => {
        await jsjobs.incrementCounter(allKey);
        await jsjobs.incrementCounter(dateKey);
      });
    });
  }
}
