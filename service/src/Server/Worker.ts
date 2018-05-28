import Bunyan from "bunyan";
import { DateTime } from "luxon";

import { DeepReadonly } from "deep-freeze";

import {
  JobDescriptor, IDependencies, Job, ConstructableJob, ClientRoot
} from "@taskbotjs/client";
import { JobMapping } from "../Config";

/**
 * Job runner; accepts a descriptor and handles the runtime lifecycle
 * of the job.
 *
 * @private
 */
export class Worker<TDependencies extends IDependencies> {
  readonly descriptor: JobDescriptor;

  private readonly jobMapping: JobMapping<TDependencies>;
  private readonly logger: Bunyan;

  private _jobCtor: ConstructableJob<TDependencies>;
  get jobCtor(): ConstructableJob<TDependencies> | null { return this._jobCtor; }

  private _done: boolean = false;
  get done(): boolean { return this._done; }

  private _error: Error | undefined = undefined;
  get error(): Error | undefined { return this._error; }

  constructor(baseLogger: Bunyan, descriptor: JobDescriptor, jobMapping: JobMapping<TDependencies>) {
    this.descriptor = descriptor;
    this.jobMapping = jobMapping;
    this.logger = baseLogger.child({ component: "Worker", jobId: descriptor.id });
  }

  async start(deps: TDependencies, onStarting: (jd: JobDescriptor) => any, onComplete: () => Promise<void>): Promise<void> {
    const logger = this.logger;
    const descriptor = this.descriptor;

    try {
      logger.debug("Starting job.");
      const startedAt = DateTime.utc().valueOf();
      descriptor.status = descriptor.status || { startedAt, retry: 0 };
      descriptor.status.startedAt = startedAt;

      this._jobCtor = this.jobMapping[descriptor.name];
      if (!this._jobCtor) {
        throw new Error(`No job handler found for '${descriptor.name}'.`);
      }

      onStarting(descriptor);

      const job = new this._jobCtor(deps, descriptor);
      await job.perform.apply(job, this.descriptor.args);
      logger.debug("Job completed successfully.");
    } catch (err) {
      logger.error(err, "Error in job execution.");
      this._error = err;

      const stack: Array<string> = err.stack.split("\n").map((s: string) => s.trim());

      descriptor.status.error = { message: stack.shift() };

      const bt = descriptor.options.backtrace;
      if (bt) {
        if (typeof(bt) === "number") {
          descriptor.status.error.backtrace = stack.slice(0, bt);
        } else {
          descriptor.status.error.backtrace = stack;
        }
      }
    }

    this.descriptor.status.endedAt = DateTime.utc().valueOf();
    this._done = true;

    await onComplete();
  }
}
