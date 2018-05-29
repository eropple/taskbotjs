import Bunyan from "bunyan";
import * as _ from "lodash";

import { AsyncRedis } from "../redis";
import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { generateJobId } from "../Job";
import { Client } from ".";
import { ISortedSet, ICleanableSet } from "../ClientBase/ISortedSet";
import { Multi } from "redis";
import { DateTime } from "luxon";
import { notEmpty } from "../util/notEmpty";

// TODO: contribute a typings?
const CanonicalJSON = require("canonicaljson");

export function keyForSortedSet(name: string): string {
  return `sorted/${name}`;
}

/**
 * Redis supports a sorted set that internally uses a score to determine its
 * sorting. As an invariant, we're going to:
 *
 * - store all values as JSON
 * - store the score in the object being stored
 *
 * See stuff like ZADD and other related commands for details.
 */
export class ScoreSortedSet implements ISortedSet {
  // TODO: async iterators would make life a little easier

  protected readonly key: string;
  protected readonly logger: Bunyan;

  /**
   * @param asyncRedis a Redis client
   * @param name the name used to derive the Redis key
   * @param scoreSelector a function that determines the numerical score of the Redis zset
   */
  constructor(
    baseLogger: Bunyan,
    protected readonly client: Client,
    protected readonly asyncRedis: AsyncRedis,
    readonly name: string,
    readonly prefix: string,
    private readonly scoreSelector: (jd: JobDescriptor) => number
  ) {
    this.key = keyForSortedSet(name);
    this.logger = baseLogger.child({ sortedSet: name });
  }

  /**
   * The (current) size of the set in question.
   */
  async size(): Promise<number> {
    return this.asyncRedis.zcard(this.key);
  }

  /**
   * @param jd The entry to add to this set
   */
  async add(jd: JobDescriptor): Promise<number> {
    const score = this.scoreSelector(jd);

    const multi = this.asyncRedis.multi();
    this.client._multiUpdateJob(multi, jd);
    multi.zadd(this.key, [score, jd.id]);

    await this.asyncRedis.execMulti(multi);

    return score;
  }

  /**
   * Attempts to remove a job from the set.
   *
   * @param jd the job to remove
   */
  async remove(jobOrId: JobDescriptorOrId): Promise<boolean> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;
    const numRemoved = await this.asyncRedis.zrem(this.key, jobId);

    return numRemoved === 1;
  }

  multiRemove(multi: Multi, jobOrId: JobDescriptorOrId): Multi {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    return multi.zrem(this.key, jobId);
  }

  async contains(jobOrId: JobDescriptorOrId): Promise<boolean> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    return !!(await this.asyncRedis.zrank(this.key, jobId));
  }

  /**
   * Fetches one item from the sorted set based on the min/max parameters, then
   * applies the provided function to it. If the function throws an error, the
   * data will be returned to the sorted set.
   *
   * @param min minimum score
   * @param max maximum score
   * @param fn function to apply to the yielded data
   */
  async fetchAndUse<T>(min: number, max: number, fn: (jd: JobDescriptor) => T, orElseFn: () => T): Promise<T | null> {
    const data = await this.fetchOne(min, max);

    if (!data) {
      if (orElseFn) {
        return orElseFn();
      } else {
        return null;
      }
    }

    try {
      return fn(data);
    } catch (err) {
      // adding back to the sorted set 'cause we couldn't finish
      this.add(data);
      throw err;
    }
  }

  /**
   * Iterates over the entire zset and calls the provided function. (This is a
   * slow function that causes a lot of IO.)
   *
   * @param fn the function to call on each item
   */
  async forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const jobKeys = chunks.map((chunk) => chunk[0]);
      const items = await this.client.readJobs(jobKeys);

      for (let item of items) {
        if (!item) {
          return;
        }

        await fn(item);
      }
    } while (cursor !== 0)
  }

  /**
   * Maps over the entire zset. (This is a slow function that causes a lot of
   * IO.)
   *
   * @param fn the mapping function to apply
   */
  async map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>> {
    const ret: Array<T> = [];

    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const jobKeys = chunks.map((chunk) => chunk[0]);
      const items = await this.client.readJobs(jobKeys);

      for (let item of items) {
        if (!item) {
          return ret;
        }

        ret.push(await fn(item));
      }
    } while (cursor !== 0)

    return ret;
  }

  /**
   * Returns the first value that matches the provided predicate function. (This
   * is a slow function that causes a lot of IO.)
   *
   * @param fn predicate function
   */
  async find(fn: (data: JobDescriptor) => boolean | Promise<boolean>): Promise<JobDescriptor | null> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const jobKeys = chunks.map((chunk) => chunk[0]);
      const items = await this.client.readJobs(jobKeys);

      for (let item of items) {
        if (!item) {
          return null;
        }

        if (await fn(item)) {
          return item;
        }
      }
    } while (cursor !== 0)

    return null;
  }

  /**
   * Looks at a subsection of the sorted set.
   *
   * @param limit return no more than this number of items
   * @param offset offset from the front of the sorted set
   */
  async peek(limit: number, offset: number): Promise<Array<JobDescriptor>> {
    const jobKeys = await this.asyncRedis.zrange(this.key, offset, offset + limit);
    return (await this.client.readJobs(jobKeys)).filter(notEmpty);
  }

  protected async scanIdBatches(fn: (jobIds: Array<string>) => any): Promise<void> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const jobIds = chunks.map((chunk) => chunk[0] as string);
      await fn(jobIds);
    } while (cursor !== 0);
  }

  protected async fetchOne(min: number, max: number): Promise<JobDescriptor | null> {
    const ret = await this.asyncRedis.zrangebyscore(this.key, min, max, "limit" as any, [0, 1]);
    if (!ret || ret.length === 0) {
      return null;
    }

    const jobId = ret[0];
    const rows = await this.asyncRedis.zrem(this.key, jobId);

    if (rows !== 1) {
      // We were raced to this item by another worker and failed to fetch.
      return null;
    }

    return CanonicalJSON.parse(await this.asyncRedis.get(`jobs/${jobId}`)) as JobDescriptor;
  }

  protected async fetchManyIds(min: number, max: number): Promise<Array<string>> {
    return this.asyncRedis.zrangebyscore(this.key, min, max, "limit" as any, [0, 10]);
  }
}

export class CleanableScoreSortedSet extends ScoreSortedSet implements ICleanableSet {
  async cleanAllBefore(cutoff: DateTime): Promise<number> {
    return this.cleanBetween(0, cutoff.valueOf());
  }

  async cleanAll(): Promise<number> {
    // this is awful, but Redis supports it and node-redis doesn't
    return this.cleanBetween("-inf" as any, "+inf" as any);
  }

  private async cleanBetween(min: number, max: number): Promise<number> {
    let runningTotal = 0;

    let jobIds: Array<string> = [];

    do {
      jobIds = await this.fetchManyIds(min, max);

      const multi = this.asyncRedis.multi();

      for (let jobId of jobIds) {
        multi.zrem(this.key, jobId);
        multi.del(`jobs/${jobId}`);
      }

      const result = await this.asyncRedis.execMulti(multi);
      runningTotal = runningTotal + (result as Array<string>).map((i) => parseInt(i, 10)).reduce((a, v) => a + v, 0);
    } while (jobIds && jobIds.length > 0);

    return runningTotal / 2;
  }
}
