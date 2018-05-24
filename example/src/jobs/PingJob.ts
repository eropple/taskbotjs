import Chance from "chance";
import sleepAsync from "sleep-promise";

import { Job, IDependencies } from "@taskbotjs/client";

import { NoDeps } from "../NoDeps";

const chance = new Chance();

export class PingJob extends Job<NoDeps> {
  static readonly jobName: string = "taskbot.ping";

  async perform(): Promise<void> {
    const interval = Math.max(25, Math.round(chance.normal({mean: 300, dev: 250})));
    await sleepAsync(interval);
    this.logger.info({ interval }, "Ping!");
  }
}
