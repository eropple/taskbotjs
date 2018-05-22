import Chance from "chance";
import sleepAsync from "sleep-promise";

import { Job, IDependencies } from "@jsjobs/client";

import { NoDeps } from "../NoDeps";

const chance = new Chance();

export class LongJob extends Job<NoDeps> {
  static readonly jobName: string = "jsj.long";

  async perform(): Promise<void> {
    const interval = Math.max(10000, Math.round(chance.normal({mean: 30000, dev: 10000})));
    this.logger.info({ interval }, "Starting a long job.");
    await sleepAsync(interval);
    this.logger.info({ interval }, "Long job done!");
  }
}
