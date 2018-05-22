import { DateTime } from "luxon";

import { Poller } from "./Poller";
import { RetryConfig } from "../../Config/Config";
import { ClientRoot } from "@jsjobs/client";

export class RetryPoller extends Poller<RetryConfig> {
  async loopIter(client: ClientRoot): Promise<void> {
    await client.withRetrySet(async (retrySet) => {
      const now = DateTime.utc().valueOf();

      let shallBreak = false;

      while (!shallBreak) {
        await retrySet.fetchAndUse(0, now,
          async (descriptor) => {
            const logger = this.logger.child({ jobId: descriptor.id });
            logger.info("Found job ready for retry; retrying.");

            client.withQueue(descriptor.options.queue, async (queue) => {
              await queue.requeue(descriptor);
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
