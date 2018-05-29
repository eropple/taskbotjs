import Bunyan from "bunyan";
import { DateTime } from "luxon";

import { ServerBase } from "..";
import {
  ClientPool,
  JobDescriptor,
  LUXON_YMD
} from "@taskbotjs/client";
import { ServerPlugin } from "../ServerPlugin";
import { PluginConfig } from "../../Config/Config";

/**
 * Attaches to server lifecycle events to publish metrics to the datastore.
 *
 * @private
 */
export class Metrics extends ServerPlugin<PluginConfig> {
  private static readonly CONFIG: PluginConfig = { enabled: true };

  // this plugin requires no plugin and is always enabled.
  protected get config() { return Metrics.CONFIG; }

  async initialize(): Promise<void> {
    this.logger.info("Attaching metrics listeners.");

    this.server.onJobStarting(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status!.startedAt!, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/processed";
      const dateKey = "metrics/processed/" + date;
      await this.withClient(async (taskbot) => {
        await taskbot.incrementCounter(allKey);
        await taskbot.incrementCounter(dateKey);
      });
    });

    this.server.onJobComplete(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status!.endedAt!, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/completed";
      const dateKey = "metrics/completed/" + date;
      await this.withClient(async (taskbot) => {
        await taskbot.incrementCounter(allKey);
        await taskbot.incrementCounter(dateKey);
      });
    });

    this.server.onJobError(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status!.endedAt!, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/errored";
      const dateKey = "metrics/errored/" + date;
      await this.withClient(async (taskbot) => {
        await taskbot.incrementCounter(allKey);
        await taskbot.incrementCounter(dateKey);
      });
    });

    this.server.onJobDeath(async (jd: JobDescriptor) => {
      const date = DateTime.fromMillis(jd.status!.endedAt!, { zone: "UTC" }).toFormat(LUXON_YMD);
      const allKey = "metrics/died";
      const dateKey = "metrics/died/" + date;
      await this.withClient(async (taskbot) => {
        await taskbot.incrementCounter(allKey);
        await taskbot.incrementCounter(dateKey);
      });
    });
  }

  async cleanup(): Promise<void> {}
}
