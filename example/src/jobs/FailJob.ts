import Chance from "chance";
import sleepAsync from "sleep-promise";
import { DateTime } from "luxon";

import { Job, IDependencies, constantBackoff, RetryFunctionTimingFunction } from "@jsjobs/client";

import { NoDeps } from "../NoDeps";

const chance = new Chance();

export class FailJob extends Job<NoDeps> {
  static readonly jobName: string = "jsj.fail";
  static readonly maxRetries = 5;
  static readonly calculateNextRetry: RetryFunctionTimingFunction = constantBackoff(3);

  async perform(): Promise<void> {
    const interval = Math.max(25, Math.round(chance.normal({mean: 300, dev: 250})));
    await sleepAsync(interval);
    throw new Error(`I failed after ${interval}ms.`);
  }
}
