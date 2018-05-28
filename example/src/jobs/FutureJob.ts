import Chance from "chance";
import sleepAsync from "sleep-promise";

import {
  Job,
  IDependencies
} from "@taskbotjs/client";

import { NoDeps } from "../NoDeps";

const chance = new Chance();

export class FutureJob extends Job<NoDeps> {
  static readonly jobName: string = "taskbot.future";

  async perform(): Promise<void> {
    const interval = Math.max(25, Math.round(chance.normal({mean: 300, dev: 250})));
    await sleepAsync(interval);
    this.logger.debug({ interval }, "I'm a job sent into the future!");
  }
}
