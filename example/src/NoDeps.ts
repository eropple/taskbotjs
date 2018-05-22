import Bunyan from "bunyan";
import { IDependencies, ClientRoot } from "@jsjobs/client";

export class NoDeps implements IDependencies {
  readonly baseLogger: Bunyan;
  readonly jsjobs: ClientRoot;

  constructor(baseLogger: Bunyan, jsjobs: ClientRoot) {
    this.baseLogger = baseLogger;
    this.jsjobs = jsjobs;
  }
};
