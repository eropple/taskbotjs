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
import { RetrySortedSet, ScheduledSortedSet, DeadSortedSet } from "./Sets";
import { ICounter } from "../ClientBase/ICounter";
import { Counter } from "./Counter";
import { WorkerInfo, MetricDayRange, LUXON_YMD, QueueInfo, StorageInfo } from "..";
import { BasicMetrics } from "../domain";

const CanonicalJSON = require("canonicaljson");

export class Client extends ClientBase<AsyncRedis> {
  readonly requiresAcknowledge: boolean = false;

  constructor(logger: Bunyan, asyncRedis: AsyncRedis) {
    super(logger, asyncRedis);
  }

  static withRedisPool(baseLogger: Bunyan, pool: RedisPool, poolOptions?: PoolOptions): ClientPool {
    return buildClientPool(Client, pool, baseLogger, poolOptions);
  }
  static withRedisOptions(
    baseLogger: Bunyan,
    options: RedisClientOptions,
    redisPoolOptions?: PoolOptions,
    clientPoolOptions?: PoolOptions
  ) : ClientPool {
    // baseLogger.debug({ options, redisPoolOptions }, "Instantiating Redis pool.");
    const redisPool = buildRedisPool(options, redisPoolOptions);
    return buildClientPool(Client, redisPool, baseLogger, clientPoolOptions);
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

  async withQueue<T>(queueName: string, fn: (queue: IQueue) => Promise<T>): Promise<T> {
    return fn(new Queue(this, this.asyncRedis, queueName));
  }

  async withRetrySet<T>(fn: (retry: IRetries) => Promise<T>): Promise<T> {
    return fn(new RetrySortedSet(this, this.asyncRedis));
  }

  async withScheduledSet<T>(fn: (retry: IScheduled) => Promise<T>): Promise<T> {
    return fn(new ScheduledSortedSet(this, this.asyncRedis));
  }

  async withDeadSet<T>(fn: (retry: IDead) => Promise<T>): Promise<T> {
    return fn(new DeadSortedSet(this, this.asyncRedis));
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
        .filter((w) => w.lastBeat > DateTime.utc().minus({ seconds: 15 }).valueOf())
        .map(async (w) => {
          try {
            await this.clearWorkerInfo(w.name)
            return 1;
          } catch (error) {
            this.logger.error({ error }, "Error clearing dead worker.");
            return 0;
          }
        });

    return (await Promise.all(promises)).reduce((a, v) => a + v, 0);
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
    const ss = this.asyncRedis.zcard("sorted/scheduled");
    const rs = this.asyncRedis.zcard("sorted/retry");
    const ds = this.asyncRedis.zcard("sorted/dead");

    const enqueued = (await this.getQueueInfo()).map((q) => q.size).reduce((a, v) => a + v, 0);

    const ret: BasicMetrics = {
      totalProcessed: parseInt(await tp || "0", 10),
      totalErrored: parseInt(await te || "0", 10),
      enqueued,
      scheduledSetSize: await ss || 0,
      retrySetSize: await rs || 0,
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
        `metrics/died/${ymd}`
      ];
      const resp = await this.asyncRedis.mget(...keys);
      ret[ymd] = {
        processed: parseInt(resp[0] || "0", 10),
        errored: parseInt(resp[1] || "0", 10),
        died: parseInt(resp[2] || "0", 10)
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

  fetchJob(queues: ReadonlyArray<string>, timeout?: number): Promise<JobDescriptor | null> {
    // An early version of JSJobs suffered from queue starvation because
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
    redisArgs.push(timeout.toString());

    return new Promise((resolve, reject) => {
      this.logger.trace({ redisArgs }, "BRPOPping.");
      this.asyncRedis.redis.brpop(redisArgs, (err, ret) => {
        if (err) {
          resolve(null);
        } else {
          if (ret) {
            const queueName = ret[0];
            const queueValue = ret[1];
            resolve(CanonicalJSON.parse(queueValue) as JobDescriptor);
          } else {
            resolve(null);
          }
        }
      })
    });
  }

  async acknowledgeJob(JobDescriptor: JobDescriptor): Promise<void> {}

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
