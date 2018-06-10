import os from "os";

import Bunyan from "bunyan";
import GenericPool from "generic-pool";
import Chance from "chance";
import { DateTime } from "luxon";

import { Job, optionsFor, generateJobId, ConstructableJob } from "../Job";
import { JobDescriptor, JobDescriptorOptions } from "../JobMetadata";
import { IQueue } from "./IQueue";

import { JobBase } from "../Job/Job";
import { ConstructableJobBase } from "../Job/ConstructableJob";
import { ICounter } from "./ICounter";
import { IScalar } from "./IScalar";
import { ClientMiddleware, ClientMiddlewarePhase } from "../ClientMiddleware";
import { QueueInfo, StorageInfo, BasicMetrics, WorkerInfo, MetricDayRange } from "../domain";
import { IRetries, IDead, IScheduled, IDone } from "./ISortedSet";
export { IRetries, IDead, IScheduled } from "./ISortedSet";

const chance = new Chance();

export type DateLike = Date | DateTime | { valueOf(): number };

export type ClientPool = GenericPool.Pool<ClientRoot>;
export type ClientPoolBase<TStorage, TClient extends ClientBase<TStorage>> = GenericPool.Pool<TClient>;
export type ConstructableClient<TStorage, TClient extends ClientBase<TStorage>> =
  { new(logger: Bunyan, storage: TStorage, middleware?: ClientMiddleware): TClient };

let nextClientId = 1;

export function buildClientPool<TStorage, TClient extends ClientBase<TStorage>>(
  type: ConstructableClient<TStorage, TClient>,
  storagePool: GenericPool.Pool<TStorage>,
  baseLogger: Bunyan,
  clientMiddleware?: ClientMiddleware,
  poolOptions?: GenericPool.Options
): ClientPool {
  const factory: GenericPool.Factory<TClient> = {
    create: async (): Promise<TClient> => new type(
      baseLogger.child({ component: type.name, clientId: nextClientId++ }),
      await storagePool.acquire(),
      clientMiddleware
    ),
    destroy: async (client: TClient): Promise<any> => storagePool.release(client.storage)
  };

  const p: GenericPool.Options = poolOptions || {
    min: storagePool.min,
    max: storagePool.max
  };

  return GenericPool.createPool<TClient>(factory, p);
}

export function buildBaseDescriptor(
  idOverride: string | null,
  jobType: ConstructableJobBase | string,
  args: Array<any>,
  userOptions?: JobDescriptorOptions
): JobDescriptor {
  const jobName = typeof(jobType) === "string" ? jobType : jobType.jobName;
  if (!jobName) {
    throw new Error("Job passed to buildBaseDescriptor has no jobName.");
  }

  const id = idOverride || generateJobId();
  const options = optionsFor(jobType, userOptions);

  return {
    id,
    name: jobName,
    source: `${os.hostname}/${process.pid}`,
    createdAt: DateTime.utc().valueOf(),
    args,
    options,
    x: {}
  };
}

export abstract class ClientRoot {
  protected readonly middleware: ClientMiddleware;

  constructor(middleware?: ClientMiddleware) {
    this.middleware = middleware || new ClientMiddleware();
  }

  abstract get connected(): boolean;

  abstract get retrySet(): IRetries;
  abstract get scheduleSet(): IScheduled;
  abstract get deadSet(): IDead;
  abstract get doneSet(): IDone;
  abstract queue(queueName: string): IQueue;

  async performAsync(jobType: ConstructableJobBase, ...args: any[]): Promise<string> {
    // TypeScript dsallows default arguments in abstract class methods or interface methods, so...
    return this.performAsyncWithOptions(jobType, optionsFor(jobType), args);
  }

  async performAsyncWithOptions(jobType: ConstructableJobBase | string, userOptions: JobDescriptorOptions, ...args: any[]): Promise<string> {
    const descriptor = buildBaseDescriptor(null, jobType, args, userOptions);
    await this.middleware.resolve(ClientMiddlewarePhase.WRITE, descriptor, this);
    return this.queue(descriptor.options.queue).enqueue(descriptor);
  }

  async performAt(date: DateLike, jobType: ConstructableJobBase, ...args: any[]): Promise<string> {
    return this.performAtWithOptions(date, jobType, optionsFor(jobType), args);
  }

  async performAtWithOptions(date: DateLike, jobType: ConstructableJobBase | string, userOptions: JobDescriptorOptions, ...args: any[]): Promise<string> {
    const descriptor = buildBaseDescriptor(null, jobType, args, userOptions);
    await this.middleware.resolve(ClientMiddlewarePhase.WRITE, descriptor, this);
    descriptor.orchestration = { scheduledFor: date.valueOf() };

    await this.scheduleSet.add(descriptor);
    return descriptor.id;
  }

  abstract async incrementCounter(counterName: string): Promise<number>;
  abstract async withCounter<T>(counterName: string, fn: (counter: ICounter) => Promise<T>): Promise<T>;

  abstract async updateJob(descriptor: JobDescriptor): Promise<JobDescriptor>;
  abstract async readJob(id: string): Promise<JobDescriptor | null>;
  abstract async readJobs(ids: Array<string>): Promise<Array<JobDescriptor | null>>;
  abstract async unsafeDeleteJob(id: string): Promise<void>;

  abstract async withQueue<T>(queueName: string, fn: (queue: IQueue) => Promise<T>): Promise<T>;
  abstract async withRetrySet<T>(fn: (retry: IRetries) => Promise<T>): Promise<T>;
  abstract async withScheduledSet<T>(fn: (scheduled: IScheduled) => Promise<T>): Promise<T>;
  abstract async withDeadSet<T>(fn: (dead: IDead) => Promise<T>): Promise<T>;
  abstract async withDoneSet<T>(fn: (done: IDone) => Promise<T>): Promise<T>;

  abstract async getQueueInfo(): Promise<Array<QueueInfo>>;
  abstract async getWorkerInfo(): Promise<Array<WorkerInfo>>;
  abstract async cleanUpDeadWorkers(): Promise<number>;
  abstract async updateWorkerInfo(info: WorkerInfo): Promise<void>;
  abstract async clearWorkerInfo(name: string): Promise<void>;
  abstract async getBasicMetrics(): Promise<BasicMetrics>;
  abstract async getDatedMetrics(start: DateTime, end: DateTime): Promise<MetricDayRange>;
  abstract async getStorageMetrics(): Promise<StorageInfo>;

  abstract async fetchQueueJob(queues: Array<string>, timeout?: number): Promise<JobDescriptor | null>;
  abstract async acknowledgeQueueJob(jd: JobDescriptor, workerName: string): Promise<void>;
}

export abstract class ClientBase<TStorage> extends ClientRoot {
  readonly storage: TStorage;
  protected readonly logger: Bunyan;

  readonly requiresAcknowledge: boolean = false;

  constructor(logger: Bunyan, storage: TStorage, middleware?: ClientMiddleware) {
    super(middleware);
    this.storage = storage;
    this.logger = logger;

    this.logger.debug("Initializing client.");
  }
}
