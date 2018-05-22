import * as _ from "lodash";

import { AsyncRedis } from "../redis";
import { JobDescriptor } from "../JobMetadata";
import { generateJobId } from "../Job";

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
export class ScoreSortedSet {
  // TODO: async iterators would make life a little easier

  private readonly key: string;

  /**
   * @param asyncRedis a Redis client
   * @param name the name used to derive the Redis key
   * @param scoreSelector a function that determines the numerical score of the Redis zset
   */
  constructor(
    protected readonly asyncRedis: AsyncRedis,
    readonly name: string,
    readonly prefix: string,
    private readonly scoreSelector: (jd: JobDescriptor) => number
  ) {
    this.key = keyForSortedSet(name);
  }

  /**
   * The (current) size of the set in question.
   */
  async size(): Promise<number> {
    return this.asyncRedis.zcard(this.key);
  }

  /**
   * Clear the entire set. Don't do this unless you really mean it.
   */
  async clear(): Promise<void> {
    await this.asyncRedis.del(this.key);
  }

  /**
   * @param jd The entry to add to this set
   */
  async add(jd: JobDescriptor): Promise<number> {
    const score = this.scoreSelector(jd);
    const value = CanonicalJSON.stringify(jd);

    await this.asyncRedis.zadd(this.key, [score, value]);

    return score;
  }

  /**
   * Attempts to remove a job from the set. The job will be canonicalized before
   * being pushed to Redis, which removes ordering issues, but if the job has
   * changed (i.e., the job is from the retry queue, has been re-scheduled, has
   * failed, and been added back to the retry set) it won't be recognized because
   * its data has changed.
   *
   * @param jd the job to remove
   */
  async remove(jd: JobDescriptor): Promise<boolean> {
    const value = CanonicalJSON.stringify(jd);
    console.log(value);
    const numRemoved = await this.asyncRedis.zrem(this.key, value);

    return numRemoved === 1;
  }

  async removeById(id: string): Promise<boolean> {
    const entry = await this.find((jd: JobDescriptor) => {
      return jd.id === id;
    });

    return this.remove(entry);
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
   * Iterates over the entire zset and calls the provided function
   *
   * @param fn the function to call on each item
   */
  async forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      for (let chunk of chunks) {
        const item = CanonicalJSON.parse(chunk[0]) as JobDescriptor;
        await fn(item);
      }
    } while (cursor !== 0)
  }

  /**
   * Maps over the entire zset. (This is a slow operation.)
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

      for (let chunk of chunks) {
        const item = CanonicalJSON.parse(chunk[0]) as JobDescriptor;
        ret.push(await fn(item));
      }
    } while (cursor !== 0)

    return ret;
  }

  /**
   * Returns the first value that matches the provided predicate function.
   *
   * @param fn predicate function
   */
  async find(fn: (data: JobDescriptor) => boolean | Promise<boolean>): Promise<JobDescriptor | null> {
    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      for (let chunk of chunks) {
        const item = CanonicalJSON.parse(chunk[0]) as JobDescriptor;
        if (await fn(item)) {
          return item;
        }
      }
    } while (cursor !== 0)

    return null;
  }

  /**
   * Searches the sorted set for a job with the given ID. This is a slow
   * operation.
   * @param id the ID of the job to fetch
   */
  async byId(id: string): Promise<JobDescriptor | null> {
    return this.find((jd) => jd.id === id);
  }

  /**
   * Looks at a subsection of the sorted set.
   *
   * @param limit return no more than this number of items
   * @param offset offset from the front of the sorted set
   */
  async peek<T>(limit: number, offset: number): Promise<Array<T>> {
    return (await this.asyncRedis.zrange(this.key, offset, offset + limit)).map((s) => CanonicalJSON.parse(s) as T);
  }

  protected async fetchOne(min: number, max: number): Promise<JobDescriptor | null> {
    const ret = await this.asyncRedis.zrangebyscore(this.key, min, max, "limit" as any, [0, 1]);
    if (!ret || ret.length === 0) {
      return null;
    }

    const data = ret[0];
    const rows = await this.asyncRedis.zrem(this.key, data);

    if (rows !== 1) {
      // We were raced to this item by another worker and failed to fetch.
      return null;
    }

    return CanonicalJSON.parse(data) as JobDescriptor;
  }
}
