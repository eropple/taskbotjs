import { AsyncRedis } from "../redis";
import { JobDescriptor } from "../JobMetadata";
import { IQueue } from "../ClientBase/IQueue";
import { Client } from ".";

const CanonicalJSON = require("canonicaljson");

export function keyForQueue(name: string): string {
  return `queue/${name}`;
}

export class Queue implements IQueue {
  readonly key: string;

  constructor(client: Client, private readonly asyncRedis: AsyncRedis, readonly name: string) {
    this.key = keyForQueue(name);
    this.asyncRedis = asyncRedis;
  }

  async size(): Promise<number> {
    return this.asyncRedis.llen(this.key);
  }

  async clear(): Promise<void> {
    await this.asyncRedis.del(this.key);
  }

  async peek(limit: number, offset: number): Promise<Array<JobDescriptor>> {
    const pageStart = -offset - 1;
    const pageEnd = pageStart - limit + 1; // because we're in negative-land
    const a = Math.min(pageStart, pageEnd);
    const b = Math.max(pageStart, pageEnd);
    const resp = await this.asyncRedis.lrange(this.key, a, b);
    return resp.map((item) => CanonicalJSON.parse(item) as JobDescriptor).reverse();
  }

  async map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>> {
    const ret: Array<T> = [];
    const pageSize = 10;

    for (let x = 0;; ++x) {
      const start = (-1) - (x * pageSize);
      const end = -((x + 1) * pageSize)
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      const items: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

      if (items.length === 0) {
        return ret;
      }

      for (let item of items) {
        if (!item) {
          return ret;
        }

        const jd = CanonicalJSON.parse(item);
        ret.push(await fn(jd));
      }
    }

    // never falls through
  }

  async forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void> {
    const pageSize = 10;

    for (let x = 0;; ++x) {
      const start = (-1) - (x * pageSize);
      const end = -((x + 1) * pageSize)
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      const items: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

      if (items.length === 0) {
        return;
      }

      for (let item of items) {
        if (!item) {
          return;
        }

        const jd = CanonicalJSON.parse(item);
        await fn(jd);
      }
    }

    // never falls through
  }
  async find(fn: (data: JobDescriptor) => boolean): Promise<JobDescriptor | null> {
    const pageSize = 10;

    for (let x = 0;; ++x) {
      const start = (-1) - (x * pageSize);
      const end = -((x + 1) * pageSize)
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      const items: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

      if (items.length === 0) {
        return null;
      }

      for (let item of items) {
        if (!item) {
          return null;
        }

        const jd = CanonicalJSON.parse(item);
        if (await fn(jd)) {
          return jd;
        }
      }
    }

    // never falls through
  }

  async byId(id: string): Promise<JobDescriptor | null> {
    return this.find((jd) => jd.id === id);
  }

  async remove(jd: JobDescriptor): Promise<boolean> {
    return (await this.asyncRedis.lrem(this.key, 1, CanonicalJSON.stringify(jd))) === 1;
  }

  async removeById(id: string): Promise<boolean> {
    const jd = await this.byId(id);

    if (!jd) {
      return false;
    }

    return this.remove(jd);
  }

  async launchById(id: string): Promise<string | null> {
    const jd = await this.byId(id);

    if (!jd) {
      return null;
    }

    if (await this.remove(jd)) {
      await this.requeue(jd);
    }

    return jd.id;
  }

  async enqueue(job: JobDescriptor): Promise<void> {
    if (job.options.queue !== this.name) {
      throw new Error(`Misqueued job: queue '${this.name}', job '${job.options.queue}'.`);
    }

    await this.asyncRedis.lpush(this.key, CanonicalJSON.stringify(job));
  }

  async requeue(job: JobDescriptor): Promise<void> {
    if (job.options.queue !== this.name) {
      throw new Error(`Misqueued job: queue '${this.name}', job '${job.options.queue}'.`);
    }

    await this.asyncRedis.rpush(this.key, CanonicalJSON.stringify(job));
  }

  async acknowledge(job: JobDescriptor): Promise<void> { /* nothing needed for standard Redis */ }
}
