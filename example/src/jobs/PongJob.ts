import Chance from "chance";
import sleepAsync from "sleep-promise";

import { Job, IDependencies } from "@jsjobs/client";

import { NoDeps } from "../NoDeps";

const chance = new Chance();

export class PongJob extends Job<NoDeps> {
  static readonly jobName: string = "jsj.pong";

  async perform(): Promise<void> {
    const interval = Math.max(25, Math.round(chance.normal({mean: 300, dev: 250})));
    await sleepAsync(interval);
    this.logger.info({ interval }, "Pong!");
  }
}
