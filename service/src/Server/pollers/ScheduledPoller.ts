import { DateTime } from "luxon";

import { Poller } from "./Poller";
import { ScheduleConfig } from "../../Config/Config";
import { ClientRoot } from "@taskbotjs/client";

export class ScheduledPoller extends Poller<ScheduleConfig> {
  async loopIter(client: ClientRoot): Promise<void> {
    await client.withScheduledSet(async (scheduledSet) => {
      const now = DateTime.utc().valueOf();
      let shallBreak = false;

      while (!shallBreak) {
        await scheduledSet.fetchAndUse(0, now,
          async (descriptor) => {
            const logger = this.logger.child({ jobId: descriptor.id });
            logger.info("Found scheduled job; queueing.");

            client.withQueue(descriptor.options.queue, async (queue) => {
              await queue.enqueue(descriptor);
            });
          },
          () => {
            shallBreak = true;
          }
        );
      }
    });
  }
}
