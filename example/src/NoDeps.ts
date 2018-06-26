import Bunyan from "bunyan";
import {
  IDependencies,
  ClientPool
} from "@taskbotjs/client";

export class NoDeps implements IDependencies {
  constructor(readonly baseLogger: Bunyan, readonly clientPool: ClientPool) {
  }
};
