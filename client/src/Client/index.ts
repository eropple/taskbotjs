import _ from "lodash";
import os from "os";

import Bunyan from "bunyan";
import GenericPool from "generic-pool";
import ChangeCase from "change-case";
import { DateTime, Interval } from "luxon";

import { createHandyClient } from "handy-redis";

import {
  AsyncRedis,
  RedisPool,
  PoolOptions,

  RedisClientOptions,
  buildRedisPool
} from "../redis";
import { JobDescriptorOptions, JobDescriptor } from "../JobMetadata";
import { optionsFor, generateJobId, Job } from "../Job";

import { ClientBase, ClientPoolBase, buildClientPool, ClientPool, IRetries, IScheduled, IDead } from "../ClientBase";
import { keyForQueue, Queue } from "./Queue";
import { IQueue } from "../ClientBase/IQueue";
import { RetryJobSortedSet, ScheduledJobSortedSet, DeadJobSortedSet, DoneJobSortedSet } from "./JobSortedSets";
import { ICounter } from "../ClientBase/ICounter";
import { Counter } from "./Counter";
import { WorkerInfo, MetricDayRange, LUXON_YMD, QueueInfo, StorageInfo } from "..";
import { BasicMetrics } from "../domain";
import { Multi } from "redis";
import { IDone } from "../ClientBase/ISortedSet";
import { ClientMiddlewarePhase, ClientMiddleware } from "../ClientMiddleware";

const CanonicalJSON = require("canonicaljson");

export class Client extends ClientBase<AsyncRedis> {
  readonly requiresAcknowledge: boolean = false;

  readonly retrySet: RetryJobSortedSet;
  readonly scheduleSet: ScheduledJobSortedSet;
  readonly deadSet: DeadJobSortedSet;
  readonly doneSet: DoneJobSortedSet;

  private readonly queues: { [queueName: string]: Queue } = {};

  constructor(logger: Bunyan, asyncRedis: AsyncRedis, middleware?: ClientMiddleware) {
    super(logger, asyncRedis, middleware);

    // mildly gross, but the node-redis typescript definitions hide this and we need 'em.
    let options = (asyncRedis.redis as any).options;
    if (options.password) {
      options = _.cloneDeep(options);
      options.password = "*";
    }

    this.logger.debug("Connecting to Redis.", options);

    this.retrySet = new RetryJobSortedSet(this.logger, this, this.asyncRedis);
    this.scheduleSet = new ScheduledJobSortedSet(this.logger, this, this.asyncRedis);
    this.deadSet = new DeadJobSortedSet(this.logger, this, this.asyncRedis);
    this.doneSet = new DoneJobSortedSet(this.logger, this, this.asyncRedis);
  }

  queue(queueName: string): Queue {
    let q = this.queues[queueName];

    if (!q) {
      q = new Queue(this, this.asyncRedis, this.logger, queueName);
      this.queues[queueName] = q;
    }

    return q;
  }

  static withRedisPool(
    baseLogger: Bunyan,
    pool: RedisPool,
    middleware?: ClientMiddleware,
    poolOptions?: PoolOptions
  ): ClientPool {
    return buildClientPool(Client, pool, baseLogger, middleware, poolOptions);
  }
  static withRedisOptions(
    baseLogger: Bunyan,
    options: RedisClientOptions,
    middleware?: ClientMiddleware,
    redisPoolOptions?: PoolOptions,
    clientPoolOptions?: PoolOptions
  ) : ClientPool {
    // baseLogger.debug({ options, redisPoolOptions }, "Instantiating Redis pool.");
    const redisPool = buildRedisPool(options, redisPoolOptions);
    return buildClientPool(Client, redisPool, baseLogger, middleware, clientPoolOptions);
  }

  get connected(): boolean { return this.storage.redis.connected; }

  private get asyncRedis(): AsyncRedis { return this.storage; }
  private get redisOptions(): RedisClientOptions { return (this.asyncRedis.redis as any).options; }
  get redisPrefix(): string { return this.redisOptions.prefix || ""; }

  async incrementCounter(counterName: string): Promise<number> {
    const counter = new Counter(this.asyncRedis, counterName);
    return counter.increment();
  }
  async withCounter<T>(counterName: string, fn: (counter: ICounter) => Promise<T>): Promise<T> {
    return fn(new Counter(this.asyncRedis, counterName));
  }

  async updateJob(descriptor: JobDescriptor): Promise<JobDescriptor> {
    const key = `jobs/${descriptor.id}`;
    this.logger.trace({ jobId: descriptor.id }, "Updating job.");

    const d = _.cloneDeep(descriptor);
    await this.middleware.resolve(ClientMiddlewarePhase.WRITE, d, this);

    const json = CanonicalJSON.stringify(d) as string;
    await this.asyncRedis.set(key, json);

    // This is to "re-hydrate" the object for continued use in TaskBotJS. For example,
    // take the argument encryption case: the WRITE middleware would have encrypted
    // it, but we need to decrypt it back into memory for continued use otherwise a
    // middleware that just did something like "increment a field by 1 on every write"
    // would lose its value if the descriptor object was reused after the update.
    await this.middleware.resolve(ClientMiddlewarePhase.READ, d, this);
    return d;
  }

  async _multiUpdateJob(multi: Multi, descriptor: JobDescriptor): Promise<Multi> {
    const key = `jobs/${descriptor.id}`;
    this.logger.trace({ jobId: descriptor.id }, "Updating job in multi.");

    const d = _.cloneDeep(descriptor);
    await this.middleware.resolve(ClientMiddlewarePhase.WRITE, d, this);

    const json = CanonicalJSON.stringify(d) as string;
    return multi.set(key, json);
  }

  async readJob(id: string): Promise<JobDescriptor | null> {
    const key = `jobs/${id}`;
    this.logger.trace({ jobId: id }, "Fetching job.");

    const json = await this.asyncRedis.get(key);
    if (!json) {
      this.logger.trace({ jobId: id }, `Job '${id}' not found in the store.`);
      return null;
    } else {
      const jd = CanonicalJSON.parse(json) as JobDescriptor;
      await this.middleware.resolve(ClientMiddlewarePhase.READ, jd, this);
      return jd;
    }
  }

  async readJobs(jobIds: Array<string>): Promise<Array<JobDescriptor | null>> {
    const keys = jobIds.map((id) => `jobs/${id}`);

    this.logger.trace({ jobIds }, "Fetching jobs.");

    const jsons = await this.asyncRedis.mget(...keys);

    return Promise.all(
      (jsons as (string | null)[]).map(async (json: string | null) => {
        if (json) {
          const jd = CanonicalJSON.parse(json) as JobDescriptor;
          await this.middleware.resolve(ClientMiddlewarePhase.READ, jd, this);
          return jd;
        } else {
          return null;
        }
      })
    );
  }

  async unsafeDeleteJob(jobOrJobId: string | JobDescriptor): Promise<void> {
    let id;

    if (typeof(jobOrJobId) === "string") {
      id = jobOrJobId;
    } else {
      id = (jobOrJobId as JobDescriptor).id;
    }

    this.logger.trace({ jobId: id }, "Deleting job.");
    const num = await this.asyncRedis.del(id);

    if (num !== 1) {
      this.logger.info({ jobId: id }, "DEL returned non-1 value; potential anomaly.");
    }
  }

  async withQueue<T>(queueName: string, fn: (queue: IQueue) => Promise<T>): Promise<T> {
    return fn(this.queue(queueName));
  }

  async withRetrySet<T>(fn: (retry: IRetries) => Promise<T>): Promise<T> {
    return fn(this.retrySet);
  }

  async withScheduledSet<T>(fn: (scheduled: IScheduled) => Promise<T>): Promise<T> {
    return fn(this.scheduleSet);
  }

  async withDeadSet<T>(fn: (dead: IDead) => Promise<T>): Promise<T> {
    return fn(this.deadSet);
  }

  async withDoneSet<T>(fn: (done: IDone) => Promise<T>): Promise<T> {
    return fn(this.doneSet);
  }

  async getQueueInfo(): Promise<Array<QueueInfo>> {
    const keys = await this.scanAll("queue/*");

    const promises: Array<Promise<QueueInfo>> = keys.map(async (key) => {
      return {
        name: key.split("/")[1],
        size: await this.asyncRedis.llen(key)
      };
    });

    return Promise.all(promises);
  }

  async getWorkerInfo(): Promise<Array<WorkerInfo>> {
    const keys = await this.scanAll("workers/*");

    const arr: Array<WorkerInfo> = [];
    for (let key of keys) {
      const workerData = await this.asyncRedis.get(key);
      arr.push(CanonicalJSON.parse(await this.asyncRedis.get(key)))
    }

    // sorting by most recent heartbeat
    return arr.sort((a, b) => -(a.lastBeat - b.lastBeat));
  }

  async cleanUpDeadWorkers(): Promise<number> {
    // TODO: 15 seconds is a little arbitrary and kind of magic-numbery
    //       That said, I'm not worried about it; the heartbeats are coming
    //       every 250ms and if a machine somehow comes back to life its
    //       heartbeat data will reappear.
    const workers = await this.getWorkerInfo();

    const promises =
      workers
        .filter((w) => w.lastBeat < DateTime.utc().minus({ seconds: 15 }).valueOf())
        .map(async (w) => {
          try {
            await this.clearWorkerInfo(w.name)
            return 1;
          } catch (error) {
            this.logger.error({ error }, "Error clearing dead worker.");
            return 0;
          }
        });

    return (await Promise.all(promises)).reduce((a: number, v: number) => a + v, 0);
  }

  async updateWorkerInfo(info: WorkerInfo): Promise<void> {
    await this.setJsonScalar(`workers/${info.name}`, info);
  }

  async clearWorkerInfo(name: string): Promise<void> {
    await this.asyncRedis.del(`workers/${name}`);
  }

  async getBasicMetrics(): Promise<BasicMetrics> {
    const tp = this.asyncRedis.get("metrics/processed");
    const te = this.asyncRedis.get("metrics/errored");
    const tc = this.asyncRedis.get("metrics/completed");
    const td = this.asyncRedis.get("metrics/died");
    const ss = this.asyncRedis.zcard("sorted/scheduled");
    const rs = this.asyncRedis.zcard("sorted/retry");
    const ds = this.asyncRedis.zcard("sorted/dead");
    const dns = this.asyncRedis.zcard("sorted/done");

    const enqueued = (await this.getQueueInfo()).map((q) => q.size).reduce((a, v) => a + v, 0);

    const ret: BasicMetrics = {
      processed: parseInt(await tp || "0", 10),
      errored: parseInt(await te || "0", 10),
      completed: parseInt(await tc || "0", 10),
      died: parseInt(await td || "0", 10),
      enqueued,
      scheduledSetSize: await ss || 0,
      retrySetSize: await rs || 0,
      doneSetSize: await dns || 0,
      deadSetSize: await ds || 0
    };

    return ret;
  }

  async getDatedMetrics(start: DateTime, end: DateTime): Promise<MetricDayRange> {
    start = start.startOf("day");
    end = end.startOf("day");

    if (end < start) {
      const t = end;
      end = start;
      start = t;
    }

    const interval = Interval.fromDateTimes(start, end);
    const dates = _.concat(interval.splitBy({ days: 1 }).map((i) => i.start), [end]);

    const ret: MetricDayRange = {};

    for (let date of dates) {
      const ymd = date.toFormat(LUXON_YMD);
      const keys = [
        `metrics/processed/${ymd}`,
        `metrics/errored/${ymd}`,
        `metrics/completed/${ymd}`,
        `metrics/died/${ymd}`
      ];
      const resp = await this.asyncRedis.mget(...keys);
      ret[ymd] = {
        processed: parseInt(resp[0] || "0", 10),
        errored: parseInt(resp[1] || "0", 10),
        completed: parseInt(resp[2] || "0", 10),
        died: parseInt(resp[3] || "0", 10)
      };
    }

    return ret;
  }

  async getStorageMetrics(): Promise<StorageInfo> {
    const respLines = (await this.asyncRedis.info()).split("\r\n");
    return {
      type: "redis",
      data: _.fromPairs(respLines.filter((line) => line.indexOf(":") > -1).map((line) => {
        const tokens = line.split(":", 2).map((token) => token.trim());

        tokens[0] = ChangeCase.camelCase(tokens[0]);

        return tokens;
      }))
    };
  }

  fetchQueueJob(queues: ReadonlyArray<string>, timeout?: number): Promise<JobDescriptor | null> {
    // An early version of TaskBotJS suffered from queue starvation because
    // the queues at the top of the *weighted* list always were pulled from
    // first. `this.queueWeights` exists to solve that. We shuffle them so
    // that they are randomly distributed (and thus have different chances of
    // being at the head of the list), and then uniq it to remove the
    // duplicates. Since BRPOP accepts any number of lists to watch at once,
    // this lets us preferentially specify our priority lists but still fall
    // through if those are empty.
    const redisArgs: string[] = queues.map((q) => keyForQueue(q));

    // We could fight TypeScript to make this strings-or-numbers...but that's
    // annoying and Redis takes string args anyway, so.
    if (timeout) {
      redisArgs.push(timeout.toString());
    }

    return new Promise((resolve, reject) => {
      this.logger.trace({ redisArgs }, "BRPOPping.");
      this.asyncRedis.redis.brpop(redisArgs, (err, ret) => {
        if (err) {
          resolve(null);
        } else {
          if (ret) {
            const queueName = ret[0];
            const queueValue = ret[1];
            resolve(this.readJob(queueValue));
          } else {
            resolve(null);
          }
        }
      })
    });
  }

  async acknowledgeQueueJob(jd: JobDescriptor, workerName: string): Promise<void> {

  }

  private async scanAll<T>(pattern: string, count: number = 10): Promise<Array<string>> {
    const data: Array<Array<string>> = [];
    const prefix = this.redisPrefix;

    let cursor = 0;
    do {
      const resp = await (this.asyncRedis as any).scan(cursor, "MATCH", `${prefix}${pattern}`, "COUNT", count);
      cursor = parseInt(resp[0], 10);
      data.push(resp[1] as Array<string>);
    } while (cursor !== 0)

    return _.flatten(data).map((key) => key.substring(prefix.length));
  }

  private async setJsonScalar<T>(key: string, obj: T): Promise<string> {
    const data = CanonicalJSON.stringify(obj);
    return this.asyncRedis.set(key, data);
  }
}
