import { DateTime } from "luxon";

import {
  ClientRoot
} from "@taskbotjs/client";

import { ScheduleConfig } from "../../Config/Config";
import { ServerPoller } from "../../ServerPoller";

export class ScheduledPoller extends ServerPoller<ScheduleConfig> {
  protected get config(): ScheduleConfig { return this.server.config.schedule; }

  async initialize() {}
  async cleanup() {}

  async loopIter(taskbot: ClientRoot): Promise<void> {
    const scheduleSet = taskbot.scheduleSet;
    const now = DateTime.utc().valueOf();
    let shallBreak = false;

    while (!shallBreak) {
      await scheduleSet.fetchAndUse(0, now,
        async (descriptor) => {
          const logger = this.logger.child({ jobId: descriptor.id });
          logger.info("Found scheduled job; queueing.");
          await taskbot.queue(descriptor.options.queue).enqueue(descriptor);
        },
        () => {
          shallBreak = true;
        }
      );
    }
  }
}
