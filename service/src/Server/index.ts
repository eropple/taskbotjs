import os from "os";

import * as _ from "lodash";
import Bunyan from "bunyan";
import Chance from "chance";

import { EventEmitter, Listener } from "typed-event-emitter";
import sleepAsync from "sleep-promise";
import AsyncLock from "async-lock";

import {
  JobDescriptor,
  IDependencies,
  Client,
  ClientPool,
  defaultJobBackoff,
  ClientRoot
} from "@taskbotjs/client";

import { Config, ConfigBase } from "../Config";
import {
  buildIntake,
  Intake,
  IIntake
} from "./intakes";
import { Worker } from "./Worker";

import { RetryPoller } from "./pollers/RetryPoller";
import { ScheduledPoller } from "./pollers/ScheduledPoller";

import { sleepFor, yieldExecution } from "../util";
import { ClientRequest } from "http";
import { ServerPlugin, ServerPluginBase } from "./ServerPlugin";
import { ServerPoller } from "./ServerPoller";

import { Metrics } from "./Metrics";
import { Heartbeat } from "./Heartbeat";
import { VERSION, FLAVOR } from "..";
import { worker } from "cluster";
import { JanitorPoller } from "./pollers/JanitorPoller";

const chance = new Chance();

/**
 * The type-erased base class for the TaskBotJS service.
 */
export abstract class ServerBase extends EventEmitter {
  /**
   * The name of this server. Generated from your OS hostname, process PID, and
   * a random value.
   */
  readonly name: string;
  /**
   * The configuration for this server.
   */
  abstract get config(): ConfigBase;

  /**
   * The server's client pool. Exposed to allow external libraries (particularly
   * `ServerPlugin`s) to request client access.
   */
  readonly clientPool: ClientPool;

  /**
   * Invoked when an error is caught from the intake mechanism.
   */
  readonly onIntakeError = this.registerEvent<(err: Error) => void>();
  /**
   * Invoked when an error is caught in the worker babysitter loop.
   */
  readonly onJobLoopError = this.registerEvent<(err: Error) => void>();

  /**
   * Invoked when a job has started on a worker.
   */
  readonly onJobStarting = this.registerEvent<(job: JobDescriptor) => void>();
  /**
   * Invoked when a job has been completed.
   */
  readonly onJobComplete = this.registerEvent<(job: JobDescriptor) => void>();
  /**
   * Invoked when a job throws an error.
   */
  readonly onJobError = this.registerEvent<(job: JobDescriptor, err: Error) => void>();
  /**
   * Invoked when a job is placed into the retry set.
   */
  readonly onJobRetryQueued = this.registerEvent<(job: JobDescriptor) => void>();
  /**
   * Invoked when a job is placed into the dead set.
   */
  readonly onJobDeath = this.registerEvent<(job: JobDescriptor) => void>();

  /**
   * Invoked when the service has started.
   */
  readonly onStarted = this.registerEvent<() => void>();
  /**
   * Invoked to clean up any hanging resources incidental to the server.
   */
  readonly onCleanup = this.registerEvent<() => void>();
  /**
   * Invoked just as the server completes its shutdown.
   */
  readonly onShutdown = this.registerEvent<() => void>();

  /**
   * The number of jobs currently being processed.
   */
  abstract get activeWorkerCount(): number;

  /**
   * Starts the server.
   */
  abstract async start(): Promise<void>;
  /**
   * Stops the server. This is a graceful shutdown and the promise should be
   * awaited on in order to make sure that any jobs currently being executed
   * are returned to the job queue.
   */
  abstract async shutdown(): Promise<void>;

  constructor(cp: ClientPool) {
    super();

    // this should be overwritten, and is by `Server`.
    this.clientPool = cp;

    this.name = [
      os.hostname(),
      process.pid,
      chance.hash({ length: 6 })
    ].join("-")
  }
}

export class Server<TDependencies extends IDependencies> extends ServerBase {
  /**
   * The base logger for the server. Child loggers should be created from this.
   */
  readonly baseLogger: Bunyan;
  private readonly logger: Bunyan;

  /**
   * This server's configuration.
   */
  readonly config: Config<TDependencies>;
  private readonly metrics: Metrics;
  private readonly heartbeat: Heartbeat;
  private readonly retryPoller: RetryPoller;
  private readonly scheduledPoller: ScheduledPoller;
  private readonly janitorPoller: JanitorPoller;

  private plugins: Array<ServerPluginBase> = [];
  private isShuttingDown: boolean = false;
  private intakeLoopTerminated: boolean = false;
  private workerHandleLoopTerminated: boolean = false;
  private intake: IIntake;

  private readonly jobLock: AsyncLock = new AsyncLock();
  private readonly jobsToStart: Array<JobDescriptor> = [];
  private readonly activeWorkers: Array<Worker<TDependencies>> = [];

  constructor(config: Config<TDependencies>) {
    super(config.buildClientPool());
    this.config = config.copy();
    this.baseLogger = this.config.logger;

    this.logger = this.baseLogger.child({ component: "Server" });
    this.logger.info({ version: VERSION, flavor: FLAVOR }, "Instantiating server.");

    this.metrics = new Metrics(this.baseLogger, this);
    this.heartbeat = new Heartbeat(this.baseLogger, this);
    this.intake = buildIntake(this.config, this, this.logger);

    this.retryPoller = new RetryPoller(this.baseLogger, this);
    this.scheduledPoller = new ScheduledPoller(this.baseLogger, this);
    this.janitorPoller = new JanitorPoller(this.baseLogger, this);
  }

  get activeWorkerCount() { return this.activeWorkers.length; }

  async start(): Promise<void> {
    if (this.intakeLoopTerminated) {
      throw new Error("Server cannot be restarted once terminated.");
    }

    this.plugins = _.concat([
      this.metrics,
      this.heartbeat,

      this.retryPoller,
      this.scheduledPoller,
      this.janitorPoller
    ], this.config.plugins.map((p) => new p(this.logger, this)));

    this.logger.info({ jobHandlerCount: Object.values(this.config.jobMap).length }, "Starting server.");

    this.logger.info("Initializing plugins.");
    for (let plugin of this.plugins) {
      await plugin.doInitialize();
    }

    this.logger.debug("Initializing intake.");
    this.intake.initialize();

    this.logger.debug("Initializing pollers.");
    for (let poller of this.plugins.filter((p) => p instanceof ServerPoller)) {
      // TODO: go back and redesign to type-erase ServerPoller's generic type.
      // this is intentionally not awaited; we don't care about its return
      (poller as any).doStart();
    }

    if (this.config.listenToSignals) {
      // TODO: attach processes to allow an orderly shutdown.
      this.logger.debug("Attaching process signals.");

      let isStopping = false;
      // the import causes Typescript to get mad because there's no types for this module.
      require("death")(async (signal: string) => {
        if (!isStopping) {
          isStopping = true;

          this.logger.info({ signal }, "Signal caught.");

          await this.shutdown();
          process.exit(0);
        }
      });
    }

    this.intakeLoop();
    this.workerHandleLoop();

    this.emit(this.onStarted);
  }

  async shutdown() {
    // TODO: this can probably be folded into the event loop, but are these too order-dependent?
    this.logger.info("Shutting down server.");

    this.logger.debug("Stopping pollers.");
    for (let poller of this.plugins.filter((p) => p instanceof ServerPoller)) {
      // TODO: go back and redesign to type-erase ServerPoller's generic type.
      await (poller as any).doStop();
    }

    // We need to wait for the main loops to terminate in order to make
    // our job slots settle out and be consistent for our cleanup step.
    this.logger.debug("Waiting for main loops to terminate.");
    this.isShuttingDown = true;
    while (!this.intakeLoopTerminated || !this.workerHandleLoopTerminated) {
      await sleepAsync(250);
    }

    this.logger.info("Cleaning up plugins.");
    for (let plugin of this.plugins) {
      await plugin.doCleanup();
    }

    this.logger.info("Cleaning up.");
    await this.cleanup();

    this.logger.info("Server shut down without incident.");
    this.emit(this.onShutdown);
  }

  private async intakeLoop(): Promise<void> {
    const logger = this.logger.child({ loop: "intake" });
    logger.debug("Entering intake loop.");

    await this.clientPool.use(async (taskbot) => {
      let connectedLastPass = false;
      while (!this.isShuttingDown) {
        try {
          if (taskbot.connected) {
            if (!connectedLastPass) {
              logger.info("Redis connected.");
              connectedLastPass = true;
            }

            await this.intakeLoopIter(logger);
          } else {
            if (connectedLastPass) {
              logger.warn("Redis disconnected.");
            }

            connectedLastPass = false;
          }
        } catch (err) {
          logger.error(err, "Error during intake loop.");
          this.emit(this.onIntakeError, err);
        }

        await sleepFor(this.config.intakePause);
      }
    });

    this.intakeLoopTerminated = true;
  }

  /**
   * @private
   */
  private async workerHandleLoop(): Promise<void> {
    const logger = this.logger.child({ loop: "worker" });
    logger.debug("Entering worker handle loop.");

    await this.clientPool.use(async (taskbot) => {
      while (!this.isShuttingDown) {
        try {
          if (taskbot.connected) {
            await this.workerHandleLoopIter(taskbot, logger);
          }
        } catch (err) {
          logger.error(err, "Error during worker handle loop.")
          this.emit(this.onJobLoopError, err);
        }

        await sleepFor(this.config.jobPause);
      }

      await this.cleanupWorkersDuringShutdown(taskbot, logger);
    });

    this.workerHandleLoopTerminated = true;
  }

  /**
   * @private
   */
  private async intakeLoopIter(logger: Bunyan): Promise<void> {
    // We don't acquire the job lock here because `jobLoopIter` can
    // only increase this value (by finishing and removing jobs
    // from `this.activeWorkers`); this is a safe lower-bound estimate.
    const { concurrency, activeJobCount, availableSlots } = this.currentWorkerStatus();

    if (availableSlots <= 0) {
      logger.trace("No slots; don't try to do intake.");
    } else { // availableSlots is positive
      let fetched = 0;

      while (fetched < availableSlots) {
        logger.trace({ fetched, availableSlots}, "Fetching.");
        const job: JobDescriptor | null = await this.intake.doFetch();

        if (!job) {
          logger.trace("No job fetched; breaking from iter to restart intake loop.");
          break;
        }

        logger.debug({ jobId: job.id }, "Job acquired.");

        await this.acquireJobLock(() => {
          logger.trace({ jobsToStartLength: this.jobsToStart.length }, "Acquired job lock; pushing to jobsToStart.");
          this.jobsToStart.push(job);
        });

        fetched++;
      }

      logger.trace({ fetched, availableSlots }, "Completed inner intake loop.")
    }
  }

  /**
   * @private
   */
  private async workerHandleLoopIter(client: ClientRoot, logger: Bunyan): Promise<void> {
    await this.handleCompletedJobs(client, logger);
    // TODO: consider switching over to Bluebird promises to have a runaway-job cancellation phase?
    await this.startJobs(logger);
  }

  /**
   * @private
   */
  private async handleCompletedJobs(client: ClientRoot, logger: Bunyan): Promise<void> {
    // TODO:  can we improve throughput here?
    //        I'm bothered a little by using a single-pass step to handle completed
    //        jobs. I wonder if we can improve throughput (and very marginally improve
    //        reliability) by having each separate worker handle its acknowledgement
    //        directly.
    const doneWorkers = await this.acquireJobLock(() => _.remove(this.activeWorkers, (w) => w.done));

    if (doneWorkers.length > 0) {
      logger.debug({ doneWorkerCount: doneWorkers.length }, "Processing done workers.");
    }

    for (let worker of doneWorkers) {
      if (!worker.error) {
        this.emit(this.onJobComplete, worker.descriptor);

        this.logger.debug({ jobId: worker.descriptor.id }, "Acking job and placing in done set.");

        await Promise.all<any>([
          client.doneSet.add(worker.descriptor),
          this.intake.requireAcknowledgment ? client.acknowledgeQueueJob(worker.descriptor, this.name) : null
        ]);
      } else {
        // Once we've got a failure, we need to:
        // - figure out if we need to retry the job
        // - if so, figure out the next retry time
        // - if not, send it to the dead set if the job is configured for it
        this.handleErroredJob(worker, client, logger.child({ jobId: worker.descriptor.id }));
        this.emit(this.onJobError, worker.descriptor, worker.error);
      }
    }
  }

  /**
   * @private
   */
  private async cleanupWorkersDuringShutdown(client: ClientRoot, logger: Bunyan): Promise<void> {
    // We've received a shutdown message, and so we need to cancel and
    // requeue any jobs currently occupying job slots that are not yet
    // completed. It is possible that a job will finish despite having
    // been cleaned up; this is acceptable, however, as TaskBotJS only
    // guarantees _at least once_ execution.

    for (let worker of this.activeWorkers.filter((w) => !w.done)) {
      this.logger.info({ jobId: worker.descriptor.id }, "Requeuing due to worker shutdown.");
      await Promise.all<any>([
        client.queue(worker.descriptor.options.queue).requeue(worker.descriptor),
        this.intake.requireAcknowledgment ? client.acknowledgeQueueJob(worker.descriptor, this.name) : null
      ]);
    }
  }

  /**
   * @private
   */
  private async startJobs(logger: Bunyan): Promise<void> {
    const newWorkers: Array<Worker<TDependencies>> = [];

    // TODO: figure out how much of this can be outside the critical section
    await this.acquireJobLock(async () => {
      const jobsToStart = this.jobsToStart;
      const activeWorkers = this.activeWorkers;
      const { activeJobCount, waitingJobCount, availableSlots } = this.currentWorkerStatus();

      while (jobsToStart.length > 0) {
        const descriptor = jobsToStart.shift()!; // ! = length is guaranteed to be greater than zero
        const jobName = descriptor.name;

        const worker = new Worker<TDependencies>(this.baseLogger, descriptor, this.config.jobMap);
        newWorkers.push(worker);
        activeWorkers.push(worker);
      }
    });

    for (let newWorker of newWorkers) {
      const taskbot = await this.clientPool.acquire();
      newWorker.start(
        this.config.dependencies(this.baseLogger, taskbot),
        async (jd: JobDescriptor) => this.emit(this.onJobStarting, jd),
        async () => this.clientPool.release(taskbot)
      );
    }
  }

  /**
   * @private
   */
  private async handleErroredJob(worker: Worker<TDependencies>, client: ClientRoot, logger: Bunyan) {
    const descriptor = worker.descriptor;
    if (!descriptor.status) {
      throw new Error("Invariant: by the time we get here, descriptors should have a status object.");
    }

    if (!descriptor.status.endedAt) {
      throw new Error("Invariant: endedAt should already be set.");
    }

    const retryCount: number = _.get(descriptor, ["status", "retry"], 0);
    const dead =
      !worker.jobCtor ||
      descriptor.options.maxRetries === false ||
      descriptor.options.maxRetries === retryCount; // ! = we know these have been created

    if (dead) {
      if (!worker.jobCtor) {
        logger.error({ jobName: descriptor.name }, "No worker bound for this job; placing in the dead set.");
      } else {
        logger.info("Job has no retries left; placing in the dead set.");
      }

      if (descriptor.options.skipDeadJob) {
        await client.unsafeDeleteJob(descriptor.id);
      } else {
        descriptor.status.success = false;
        delete descriptor.status.nextRetryAt;

        await Promise.all<any>([
          client.deadSet.add(descriptor),
          this.intake.requireAcknowledgment ? client.acknowledgeQueueJob(descriptor, this.name) : null
        ]);
        this.emit(this.onJobDeath, descriptor);
      }
    } else {
      descriptor.status.retry = (descriptor.status.retry || 0) + 1;
      delete descriptor.status.nextRetryAt;

      const nextRetryFunction = worker.jobCtor ? worker.jobCtor.calculateNextRetry : defaultJobBackoff;
      descriptor.status.nextRetryAt = nextRetryFunction(descriptor.status.endedAt, descriptor.status.retry).valueOf();

      const delta = (descriptor.status.nextRetryAt - descriptor.status.endedAt) / 1000;
      logger.info(
        {
          retry: descriptor.status.retry,
          nextRetryAt: descriptor.status.nextRetryAt,
          endedAt: descriptor.status.endedAt,
          delta
        },
        `Job has retries remaining; computing next retry and placing in retry set (${delta}s from now).`);

        await Promise.all<any>([
          client.retrySet.add(descriptor),
          this.intake.requireAcknowledgment ? client.acknowledgeQueueJob(descriptor, this.name) : null
        ]);
      this.emit(this.onJobRetryQueued, descriptor);
    }
  }

  /**
   * @private
   */
  private async cleanup(): Promise<void> {
    this.logger.debug("Setting Redis pool to drain.");
    this.clientPool.drain();

    this.emit(this.onCleanup);
  }

  /**
   * @private
   */
  private async acquireJobLock<T>(fn: () => T): Promise<T> {
    return this.jobLock.acquire("jobLock", fn);
  }

  /**
   * Returns a snapshot of the current status of this server instance.
   */
  currentWorkerStatus() {
    return {
      concurrency: this.config.concurrency,
      activeJobCount: this.activeWorkers.length,
      waitingJobCount: this.jobsToStart.length,
      availableSlots: this.config.concurrency - this.activeWorkers.length - this.jobsToStart.length
    };
  }
}
