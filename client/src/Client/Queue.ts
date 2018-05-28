import Bunyan from "bunyan";

import { AsyncRedis } from "../redis";
import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { IQueue } from "../ClientBase/IQueue";
import { Client } from ".";
import { Multi } from "redis";

const CanonicalJSON = require("canonicaljson");

export function keyForQueue(name: string): string {
  return `queue/${name}`;
}

export class Queue implements IQueue {
  readonly key: string;

  private readonly logger: Bunyan

  constructor(private readonly client: Client, private readonly asyncRedis: AsyncRedis, baseLogger: Bunyan, readonly name: string) {
    this.key = keyForQueue(name);
    this.asyncRedis = asyncRedis;

    this.logger = baseLogger.child({ queueName: name });
  }

  async size(): Promise<number> {
    return this.asyncRedis.llen(this.key);
  }

  async peek(limit: number, offset: number): Promise<Array<JobDescriptor>> {
    const pageStart = -offset - 1;
    const pageEnd = pageStart - limit + 1; // because we're in negative-land
    const a = Math.min(pageStart, pageEnd);
    const b = Math.max(pageStart, pageEnd);
    const jobKeys: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

    if (jobKeys.length === 0) {
      return [];
    }

    return (await this.client.readJobs(jobKeys)).filter((jd) => jd);
  }

  async map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>> {
    const ret: Array<T> = [];
    const pageSize = 10;

    for (let x = 0;; ++x) {
      const start = (-1) - (x * pageSize);
      const end = -((x + 1) * pageSize)
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      const jobKeys: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

      if (jobKeys.length === 0) {
        return ret;
      }

      const items = await this.client.readJobs(jobKeys);

      for (let item of items) {
        if (!item) {
          return ret;
        }

        ret.push(await fn(item));
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
      const jobKeys: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

      if (jobKeys.length === 0) {
        return;
      }

      const items = await this.client.readJobs(jobKeys);

      for (let item of items) {
        if (!item) {
          return;
        }

        await fn(item);
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
      const jobKeys: string[] = (await this.asyncRedis.lrange(this.key, a, b)).reverse();

      if (jobKeys.length === 0) {
        return null;
      }

      const items = await this.client.readJobs(jobKeys);

      for (let item of items) {
        if (!item) {
          return null;
        }

        if (await fn(item)) {
          return item;
        }
      }
    }

    // never falls through
  }

  async remove(jobOrId: JobDescriptorOrId): Promise<boolean> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    return (await this.asyncRedis.lrem(this.key, 1, jobId)) === 1;
  }

  async launch(jobOrId: JobDescriptorOrId): Promise<string | null> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;
    const jd = await this.client.readJob(jobId);

    if (!jd) {
      this.logger.warn({ jobId }, "launch: Job not in queue.")
      return null;
    }

    if (!await this.remove(jobId)) {
      this.logger.warn({ jobId }, "Job not already in queue. To put a new job at the head of the queue, use the requeue method.");
      return null;
    } else {
      await this.requeue(jd);
    }

    return jobId;
  }

  async enqueue(job: JobDescriptor): Promise<string> {
    if (job.options.queue !== this.name) {
      throw new Error(`Misqueued job: queue '${this.name}', job '${job.options.queue}'.`);
    }

    const multi = this.asyncRedis.multi();
    this.multiEnqueue(multi, job);

    await this.asyncRedis.execMulti(multi);
    return job.id;
  }

  multiEnqueue(multi: Multi, job: JobDescriptor): Multi {
    return multi.set(`jobs/${job.id}`, CanonicalJSON.stringify(job)).lpush(this.key, job.id);
  }

  async requeue(job: JobDescriptor): Promise<void> {
    if (job.options.queue !== this.name) {
      throw new Error(`Misqueued job: queue '${this.name}', job '${job.options.queue}'.`);
    }

    const multi = this.asyncRedis.multi();
    this.multiRequeue(multi, job);

    await this.asyncRedis.execMulti(multi);
  }

  multiRequeue(multi: Multi, job: JobDescriptor): Multi {
    return multi.set(`jobs/${job.id}`, CanonicalJSON.stringify(job)).rpush(this.key, job.id);
  }

  async acknowledge(job: JobDescriptor): Promise<void> { /* nothing needed for standard Redis */ }
}
