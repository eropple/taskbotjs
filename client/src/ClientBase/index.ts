import os from "os";

import Bunyan from "bunyan";
import GenericPool from "generic-pool";
import Chance from "chance";
import { DateTime } from "luxon";

import { Job, optionsFor, generateJobId, ConstructableJob } from "../Job";
import { JobDescriptor, JobDescriptorOptions } from "../JobMetadata";
import { IQueue } from "./IQueue";

import { IRetries, IDead, IScheduled } from "./ISet";
import { JobBase } from "../Job/Job";
import { ConstructableJobBase } from "../Job/ConstructableJob";
import { ICounter, IScalar, WorkerInfo, MetricDayRange } from "..";
import { QueueInfo, StorageInfo, BasicMetrics } from "../domain";
export { IRetries, IDead, IScheduled } from "./ISet";

const chance = new Chance();

export type DateLike = Date | DateTime | { valueOf(): number };

export type ClientPool = GenericPool.Pool<ClientRoot>;
export type ClientPoolBase<TStorage, TClient extends ClientBase<TStorage>> = GenericPool.Pool<TClient>;
export type ConstructableClient<TStorage, TClient extends ClientBase<TStorage>> =
  { new(logger: Bunyan, storage: TStorage): TClient };

let nextClientId = 1;

export function buildClientPool<TStorage, TClient extends ClientBase<TStorage>>(
  type: ConstructableClient<TStorage, TClient>,
  storagePool: GenericPool.Pool<TStorage>,
  baseLogger: Bunyan,
  poolOptions?: GenericPool.Options
): ClientPool {
  const factory: GenericPool.Factory<TClient> = {
    create: async (): Promise<TClient> => new type(
      baseLogger.child({ component: type.name, clientId: nextClientId++ }),
      await storagePool.acquire()
    ),
    destroy: async (client: TClient): Promise<any> => storagePool.release(client.storage)
  };

  const p: GenericPool.Options = poolOptions || {
    min: storagePool.min,
    max: storagePool.max
  };

  return GenericPool.createPool<TClient>(factory, p);
}

export abstract class ClientRoot {
  abstract get connected(): boolean;
  readonly requiresAcknowledge: boolean;

  async performAsync(jobType: ConstructableJobBase, ...args: any[]): Promise<string> {
    // TypeScript dsallows default arguments in abstract class methods or interface methods, so...
    return this.doPerformAsync(jobType, args, null);
  }

  async performAsyncWithOptions(jobType: ConstructableJobBase, userOptions: JobDescriptorOptions, ...args: any[]): Promise<string> {
    return this.doPerformAsync(jobType, args, userOptions);
  }

  async performAt(date: DateLike, jobType: ConstructableJobBase, ...args: any[]): Promise<string> {
    return this.doPerformAt(date, jobType, args, null);
  }

  async performAtWithOptions(date: DateLike, jobType: ConstructableJobBase, userOptions: JobDescriptorOptions, ...args: any[]): Promise<string> {
    return this.doPerformAt(date, jobType, args, userOptions);
  }

  protected abstract async doPerformAsync(jobType: ConstructableJobBase, args: Array<any>, userOptions?: JobDescriptorOptions): Promise<string>;
  protected abstract async doPerformAt(date: DateLike, jobType: ConstructableJobBase, args: Array<any>, userOptions?: JobDescriptorOptions): Promise<string>;

  abstract async incrementCounter(counterName: string): Promise<number>;
  abstract async withCounter<T>(counterName: string, fn: (counter: ICounter) => Promise<T>): Promise<T>;

  abstract async withQueue<T>(queueName: string, fn: (queue: IQueue) => Promise<T>): Promise<T>;
  abstract async withRetrySet<T>(fn: (retry: IRetries) => Promise<T>): Promise<T>;
  abstract async withScheduledSet<T>(fn: (retry: IScheduled) => Promise<T>): Promise<T>;
  abstract async withDeadSet<T>(fn: (retry: IDead) => Promise<T>): Promise<T>;

  abstract async getQueueInfo(): Promise<Array<QueueInfo>>;
  abstract async getWorkerInfo(): Promise<Array<WorkerInfo>>;
  abstract async cleanUpDeadWorkers(): Promise<number>;
  abstract async updateWorkerInfo(info: WorkerInfo): Promise<void>;
  abstract async clearWorkerInfo(name: string): Promise<void>;
  abstract async getBasicMetrics(): Promise<BasicMetrics>;
  abstract async getDatedMetrics(start: DateTime, end: DateTime): Promise<MetricDayRange>;
  abstract async getStorageMetrics(): Promise<StorageInfo>;

  abstract async fetchJob(queues: Array<string>, timeout?: number): Promise<JobDescriptor | null>;
  abstract async acknowledgeJob(JobDescriptor: JobDescriptor): Promise<void>;
}

export abstract class ClientBase<TStorage> extends ClientRoot {
  readonly storage: TStorage;
  protected readonly logger: Bunyan;

  readonly requiresAcknowledge: boolean = false;

  constructor(logger: Bunyan, storage: TStorage) {
    super();
    this.storage = storage;
    this.logger = logger;

    this.logger.debug("Initializing client.");
  }

  async doPerformAsync(jobType: ConstructableJobBase, args: Array<any> = [], userOptions?: JobDescriptorOptions): Promise<string> {
    const descriptor = this.buildBaseDescriptor(jobType, args, userOptions);

    return this.withQueue(descriptor.options.queue, async (queue) => {
      await queue.enqueue(descriptor)

      return descriptor.id;
    });
  }

  async doPerformAt(date: DateLike, jobType: ConstructableJobBase, args: Array<any> = [], userOptions?: JobDescriptorOptions): Promise<string> {
    const descriptor = this.buildBaseDescriptor(jobType, args, userOptions);
    descriptor.orchestration = { scheduledFor: date.valueOf() };

    return this.withScheduledSet(async (scheduled) => {
      await scheduled.add(descriptor);

      return descriptor.id;
    });
  }



  private buildBaseDescriptor(jobType: ConstructableJobBase, args: Array<any>, userOptions?: JobDescriptorOptions): JobDescriptor {
    const jobName = jobType.jobName;
    if (!jobName) {
      throw new Error(`job type '${jobType.name}' requires a specified jobName.`);
    }

    const id = generateJobId();
    const options = optionsFor(jobType, userOptions);

    return {
      id,
      name: jobName,
      source: `${os.hostname}/${process.pid}`,
      createdAt: DateTime.utc().valueOf(),
      args,
      options
    };
  }
}
