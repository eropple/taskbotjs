import Bunyan from "bunyan";
import {
  IDependencies,
  ClientRoot
} from "@taskbotjs/client";

export class NoDeps implements IDependencies {
  readonly baseLogger: Bunyan;
  readonly taskbot: ClientRoot;

  constructor(baseLogger: Bunyan, taskbot: ClientRoot) {
    this.baseLogger = baseLogger;
    this.taskbot = taskbot;
  }
};
