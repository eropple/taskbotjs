import { DateTime } from "luxon";

import {
  ClientRoot
} from "@taskbotjs/client";

import { RetryConfig } from "../../Config/Config";
import { ServerPoller } from "../../ServerPoller";

export class RetryPoller extends ServerPoller<RetryConfig> {
  protected get config(): RetryConfig { return this.server.config.retry; }

  async initialize() {}
  async cleanup() {}

  async loopIter(taskbot: ClientRoot): Promise<void> {
    await taskbot.withRetrySet(async (retrySet) => {
      const now = DateTime.utc().valueOf();

      let shallBreak = false;

      while (!shallBreak) {
        await retrySet.fetchAndUse(0, now,
          async (descriptor) => {
            const logger = this.logger.child({ jobId: descriptor.id });
            logger.info("Found job ready for retry; retrying.");

            taskbot.withQueue(descriptor.options.queue, async (queue) => {
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
