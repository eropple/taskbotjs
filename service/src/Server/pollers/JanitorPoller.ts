import { DateTime } from "luxon";

import {
  ClientRoot
} from "@taskbotjs/client";

import { JanitorConfig } from "../../Config/Config";
import { ServerPoller } from "../../ServerPoller";
import { ICleanableSet } from "../../../../client/dist/ClientBase/ISortedSet";
import { intervalSplayDuration } from "../../util/random";

export class JanitorPoller extends ServerPoller<JanitorConfig> {
  protected get config(): JanitorConfig { return this.server.config.janitor; }

  async initialize() {}
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
