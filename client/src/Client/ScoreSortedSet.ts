import Bunyan from "bunyan";
import * as _ from "lodash";

import { AsyncRedis } from "../redis";
import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { generateJobId } from "../Job";
import { Client } from ".";
import { ISortedSet } from "../ClientBase/ISortedSet";
import { Multi } from "redis";
import { DateTime } from "luxon";
import { notEmpty } from "../util/notEmpty";

// TODO: contribute a typings?
const CanonicalJSON = require("canonicaljson");

export function keyForSortedSet(name: string): string {
  return `sorted/${name}`;
}

export type HasId = { id: string };

/**
 * Redis supports a sorted set that internally uses a score to determine its
 * sorting. As an invariant, we're going to:
 *
 * - store all values as JSON
 * - store the score in the object being stored
 *
 * See stuff like ZADD and other related commands for details.
 */
export abstract class ScoreSortedSet<T extends HasId> implements ISortedSet<T> {
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
    readonly itemPrefix: string,
    private readonly itemMultiUpdate: (multi: Multi, item: T) => Promise<Multi>,
    private readonly readMany: (ids: Array<string>) => Promise<Array<T>>,
    private readonly scoreSelector: (item: T) => number
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
  async add(item: T): Promise<number> {
    const multi = this.asyncRedis.multi();
    await this.itemMultiUpdate(multi, item);
    const ret = this.multiAdd(multi, item);

    await this.asyncRedis.execMulti(multi);

    return ret[0];
  }

  multiAdd(multi: Multi, item: T): [number, Multi] {
    const score = this.scoreSelector(item);
    return [score, multi.zadd(this.key, [score, item.id])];
  }

  /**
   * Attempts to remove a job from the set.
   *
   * @param jd the job to remove
   */
  async remove(itemOrId: T | string): Promise<boolean> {
    const id = (typeof itemOrId === "string") ? itemOrId : itemOrId.id;
    const numRemoved = await this.asyncRedis.zrem(this.key, id);

    return numRemoved === 1;
  }

  multiRemove(multi: Multi, itemOrId: T | string): Multi {
    const id = (typeof itemOrId === "string") ? itemOrId : itemOrId.id;

    return multi.zrem(this.key, id);
  }

  async contains(itemOrId: T | string): Promise<boolean> {
    const id = (typeof itemOrId === "string") ? itemOrId : itemOrId.id;

    return !!(await this.asyncRedis.zrank(this.key, id));
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
  async fetchAndUse<U>(min: number, max: number, fn: (item: T) => U, orElseFn: () => U): Promise<U | null> {
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
  async forEach(fn: (item: T) => any | Promise<any>): Promise<void> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const itemKeys = chunks.map((chunk) => chunk[0]);
      const items = await this.readMany(itemKeys);

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
  async map<U>(fn: (item: T) => U | Promise<U>): Promise<Array<U>> {
    const ret: Array<U> = [];

    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const itemKeys = chunks.map((chunk) => chunk[0]);
      const items = await this.readMany(itemKeys);

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
  async find(fn: (item: T) => boolean | Promise<boolean>): Promise<T | null> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const itemKeys = chunks.map((chunk) => chunk[0]);
      const items = await this.readMany(itemKeys);

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
  async peek(limit: number, offset: number): Promise<Array<T>> {
    const itemKeys = await this.asyncRedis.zrange(this.key, offset, offset + limit);
    return (await this.readMany(itemKeys)).filter(notEmpty);
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

  protected async fetchOne(min: number, max: number): Promise<T | null> {
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

    return CanonicalJSON.parse(await this.asyncRedis.get(`${this.itemPrefix}${jobId}`)) as T;
  }

  protected async fetchManyIds(min: number, max: number): Promise<Array<string>> {
    return this.asyncRedis.zrangebyscore(this.key, min, max, "limit" as any, [0, 10]);
  }

  async cleanAllBefore(cutoff: DateTime): Promise<number> {
    return this.cleanBetween(0, cutoff.valueOf());
  }

  async cleanAll(): Promise<number> {
    // this is awful, but Redis supports it and node-redis doesn't
    return this.cleanBetween("-inf" as any, "+inf" as any);
  }

  async cleanBetween(min: number, max: number): Promise<number> {
    let runningTotal = 0;

    let itemIds: Array<string> = [];

    do {
      itemIds = await this.fetchManyIds(min, max);

      const multi = this.asyncRedis.multi();

      for (let itemId of itemIds) {
        multi.zrem(this.key, itemId);
        multi.del(`${this.itemPrefix}${itemId}`);
      }

      const result = await this.asyncRedis.execMulti(multi);
      runningTotal = runningTotal + (result as Array<string>).map((i) => parseInt(i, 10)).reduce((a, v) => a + v, 0);
    } while (itemIds && itemIds.length > 0);

    return runningTotal / 2;
  }
}
