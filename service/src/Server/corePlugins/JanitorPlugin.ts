import { DateTime } from "luxon";

import {
  ClientRoot,
  ICleanableSet
} from "@taskbotjs/client";

import { JanitorConfig } from "../../Config/Config";
import { intervalSplayDuration } from "../../util/random";
import { ServerPlugin } from "../ServerPlugin";

export class JanitorPlugin extends ServerPlugin<JanitorConfig> {
  protected get config(): JanitorConfig { return this.server.config.janitor; }

  async initialize() {
    this.registerPoller(this.loopIter, this.config.polling);
  }
  async cleanup() {}

  async loopIter(taskbot: ClientRoot): Promise<void> {
    const now = DateTime.utc();

    const deadCutoff = now.minus(this.config.deadAge);
    const doneCutoff = now.minus(this.config.doneAge);

    const deadCount = await taskbot.deadSet.cleanAllBefore(deadCutoff);
    this.logger.debug({ deadCount }, "Completed dead cleanup.");

    const doneCount = await taskbot.doneSet.cleanAllBefore(doneCutoff);
    this.logger.debug({ doneCount }, "Completed done cleanup.");
  }
}
