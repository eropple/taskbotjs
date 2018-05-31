import * as _ from "lodash";
import Bunyan from "bunyan";

import {
  JobDescriptor
} from "@taskbotjs/client";
import { ServerBase } from ".";

/**
 * Middleware functions that can mutate descriptors when invoked. Should return a `Promise<boolean>`
 * where `true` indicates that the next entry in the middleware chain shall be invoked and `false`
 * ends the middleware execution right here.
 */
export type MiddlewareFunction =
  (phase: MiddlewarePhase, jd: JobDescriptor, logger: Bunyan, server: ServerBase) => Promise<boolean>;

export interface MiddlewareEntry {
  fn: MiddlewareFunction,
  logger: Bunyan
};

export enum MiddlewarePhase {
  /**
   * Job has been started in the worker. Modifications to the job will _not_ be saved
   * directly to the data store, so changes made here are limited to the scope of the
   * worker if the middleware then undoes or deletes its changes in other phases.
   */
  STARTING = "STARTING",

  /**
   * Job has been completed. After this middleware chain has completed its run, the job
   * will be saved and placed in the done set.
   */
  COMPLETED = "COMPLETED",

  /**
   * Job has failed. Error status is populated on the descriptor. After this
   * middleware chain has completed its run, the job will be saved and placed in
   * the retry set or done set.
   */
  ERRORED = "ERRORED"
};

export class Middleware {
  private chain: Array<MiddlewareEntry> = [];

  register(logger: Bunyan, fn: MiddlewareFunction): void {
    this.chain = _.concat(this.chain, [{ fn, logger: logger.child({ aspect: "middleware" }) }]);
  }

  async resolve(phase: MiddlewarePhase, jd: JobDescriptor, server: ServerBase): Promise<void> {
    for (let middlewareEntry of this.chain) {
      const ret = await middlewareEntry.fn(phase, jd, middlewareEntry.logger, server);

      if (!ret) {
        break;
      }
    }
  }
}
