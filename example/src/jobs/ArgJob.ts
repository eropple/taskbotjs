import Chance from "chance";
import sleepAsync from "sleep-promise";
import { DateTime } from "luxon";

import { Job, IDependencies, constantBackoff, RetryFunctionTimingFunction } from "@taskbotjs/client";

import { NoDeps } from "../NoDeps";

const chance = new Chance();

export class ArgJob extends Job<NoDeps> {
  static readonly jobName: string = "taskbot.arg";
  static readonly maxRetries = 5;
  static readonly calculateNextRetry: RetryFunctionTimingFunction = constantBackoff(3);

  async perform(arg: number): Promise<void> {
    const interval = Math.max(25, Math.round(chance.normal({mean: 300, dev: 250})));
    await sleepAsync(interval);
    this.logger.debug({ arg}, `I have an arg: ${arg}`);
  }
}
