import * as _ from "lodash";
import Bunyan from "bunyan";
import { DateTime } from "luxon";

import { AsyncRedis } from "../redis";
import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { IRetries, IScheduled, IDead, IDone, IJobSortedSet } from "../ClientBase/ISortedSet";
import { ScoreSortedSet } from "./ScoreSortedSet";
import { Client } from ".";

const retryScorer = (jd: JobDescriptor) => _.get(jd, ["status", "nextRetryAt"], Infinity);
const scheduledScorer = (jd: JobDescriptor) => _.get(jd, ["orchestration", "scheduledFor"], Infinity);
const deadScorer = (jd: JobDescriptor) => _.get(jd, ["status", "endedAt"], Infinity);
const doneScorer = (jd: JobDescriptor) => _.get(jd, ["status", "endedAt"], Infinity);

export class JobSortedSet extends ScoreSortedSet<JobDescriptor> implements IJobSortedSet {
  constructor(
    baseLogger: Bunyan,
    client: Client,
    asyncRedis: AsyncRedis,
    name: string,
    prefix: string,
    scoreSelector: (jd: JobDescriptor) => number
  ) {
    super(
      baseLogger,
      client,
      asyncRedis,
      name,
      prefix,
      "jobs/",
      (multi, jd) => this.client._multiUpdateJob(multi, jd),
      async (ids: Array<string>) => _.compact(await this.client.readJobs(ids)),
      scoreSelector
    )
  }

  async mapKeys<U>(fn: (raw: string) => U | Promise<U>): Promise<Array<U>> {
    const ret: Array<U> = [];

    let cursor = 0;
    do {
      const resp: any[] = await (this.asyncRedis as any).zscan(this.key, cursor, "COUNT", 10);
      cursor = parseInt(resp[0], 10);
      const chunks = _.chunk(resp[1] as any[], 2);

      const itemKeys = chunks.map((chunk) => chunk[0]);

      for (let itemkey of itemKeys) {
        if (!itemkey) {
          return ret;
        }

        ret.push(await fn(itemkey));
      }
    } while (cursor !== 0)

    return ret;
  }
}

export class RetryJobSortedSet extends JobSortedSet implements IRetries {
  constructor(baseLogger: Bunyan, client: Client, asyncRedis: AsyncRedis) {
    super(baseLogger, client, asyncRedis, "retry", client.redisPrefix, retryScorer);
  }

  async retry(jobOrId: JobDescriptorOrId): Promise<string | null> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    if (!await this.contains(jobOrId)) {
      this.logger.warn({ jobId }, "Attempted to launch a job not in set.");
      return null;
    }

    const jd = await this.client.readJob(jobId);
    if (!jd) {
      this.logger.warn({ jobId }, "Job not found in store. Deletion anomaly?");
      return null;
    }

    const queue = this.client.queue(jd.options.queue);
    const multi = this.asyncRedis.multi();
    this.multiRemove(multi, jobId);
    queue.multiEnqueue(multi, jd);

    await this.asyncRedis.execMulti(multi);

    return jd.id;
  }
}

export class ScheduledJobSortedSet extends JobSortedSet implements IScheduled {
  constructor(baseLogger: Bunyan, client: Client, asyncRedis: AsyncRedis) {
    super(baseLogger, client, asyncRedis, "scheduled", client.redisPrefix, scheduledScorer);
  }

  async launch(jobOrId: JobDescriptorOrId): Promise<string | null> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    if (!await this.contains(jobOrId)) {
      this.logger.warn("Attempted to launch a job not in set.");
      return null;
    }

    const jd = await this.client.readJob(jobId);
    if (!jd) {
      this.logger.warn({ jobId }, "Job not found in store. Deletion anomaly?");
      return null;
    }

    const queue = this.client.queue(jd.options.queue);
    const multi = this.asyncRedis.multi();
    this.multiRemove(multi, jobId);
    queue.multiRequeue(multi, jd);

    await this.asyncRedis.execMulti(multi);

    return jd.id;
  }
}

export class DeadJobSortedSet extends JobSortedSet implements IDead {
  constructor(baseLogger: Bunyan, client: Client, asyncRedis: AsyncRedis) {
    super(baseLogger, client, asyncRedis, "dead", client.redisPrefix, deadScorer);
  }

  async resurrect(jobOrId: JobDescriptorOrId): Promise<string | null> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    if (!await this.contains(jobOrId)) {
      this.logger.warn("Attempted to launch a job not in set.");
      return null;
    }

    const jd = await this.client.readJob(jobId);
    if (!jd) {
      this.logger.warn({ jobId }, "Job not found in store. Deletion anomaly?");
      return null;
    }

    const queue = this.client.queue(jd.options.queue);
    const multi = this.asyncRedis.multi();
    this.multiRemove(multi, jobId);
    queue.multiEnqueue(multi, jd);

    await this.asyncRedis.execMulti(multi);

    return jd.id;
  }
}

export class DoneJobSortedSet extends JobSortedSet implements IDone {
  constructor(baseLogger: Bunyan, client: Client, asyncRedis: AsyncRedis) {
    super(baseLogger, client, asyncRedis, "done", client.redisPrefix, doneScorer);
  }
}
