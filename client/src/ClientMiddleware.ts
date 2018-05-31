import * as _ from "lodash";
import Bunyan from "bunyan";

import { JobDescriptor } from "./JobMetadata";
import { ClientRoot } from "./ClientBase";

/**
 * Middleware functions that can mutate descriptors when invoked. Should return a `Promise<boolean>`
 * where `true` indicates that the next entry in the middleware chain shall be invoked and `false`
 * ends the middleware execution right here.
 */
export type ClientMiddlewareFunction =
  (phase: ClientMiddlewarePhase, jd: JobDescriptor, logger: Bunyan, client: ClientRoot) => Promise<boolean>;

export interface ClientMiddlewareEntry {
  fn: ClientMiddlewareFunction,
  logger: Bunyan
};

export enum ClientMiddlewarePhase {
  /**
   * Job is being read from a datastore. Mutations to the JobDescriptor object will
   * be returned.
   */
  READ = "READ",

  /**
   * Job is being written to the datastore. Mutations to the JobDescriptor object
   * will be persisted to the datastore.
   */
  WRITE = "WRITE"
};

export class ClientMiddleware {
  private chain: Array<ClientMiddlewareEntry> = [];

  register(logger: Bunyan, fn: ClientMiddlewareFunction): void {
    this.chain = _.concat(this.chain, [{ fn, logger: logger.child({ aspect: "middleware-client" }) }]);
  }

  async resolve(phase: ClientMiddlewarePhase, jd: JobDescriptor, client: ClientRoot): Promise<void> {
    for (let middlewareEntry of this.chain) {
      const ret = await middlewareEntry.fn(phase, jd, middlewareEntry.logger, client);

      if (!ret) {
        break;
      }
    }
  }
}
