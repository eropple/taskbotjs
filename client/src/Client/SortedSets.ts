import Bunyan from "bunyan";
import { DateTime } from "luxon";

import { AsyncRedis } from "../redis";
import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { IRetries, IScheduled, IDead, IDone } from "../ClientBase/ISortedSet";
import { ScoreSortedSet, CleanableScoreSortedSet } from "./ScoreSortedSet";
import { Client } from ".";

const retryScorer = (jd: JobDescriptor) => jd.status.nextRetryAt;
const scheduledScorer = (jd: JobDescriptor) => jd.orchestration.scheduledFor;
const deadScorer = (jd: JobDescriptor) => jd.status.endedAt;
const doneScorer = (jd: JobDescriptor) => jd.status.endedAt;

export class RetrySortedSet extends ScoreSortedSet implements IRetries {
  constructor(baseLogger: Bunyan, client: Client, asyncRedis: AsyncRedis) {
    super(baseLogger, client, asyncRedis, "retry", client.redisPrefix, retryScorer);
  }

  async retry(jobOrId: JobDescriptorOrId): Promise<string | null> {
    const jobId = (typeof jobOrId === "string") ? jobOrId : jobOrId.id;

    if (!await this.contains(jobOrId)) {
      this.logger.warn("Attempted to launch a job not in set.");
      return null;
    }

    const jd = await this.client.readJob(jobId);

    const queue = this.client.queue(jd.options.queue);
    const multi = this.asyncRedis.multi();
    this.multiRemove(multi, jobId);
    queue.multiEnqueue(multi, jd);

    await this.asyncRedis.execMulti(multi);

    return jd.id;
  }
}

export class ScheduledSortedSet extends ScoreSortedSet implements IScheduled {
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

    const queue = this.client.queue(jd.options.queue);
    const multi = this.asyncRedis.multi();
    this.multiRemove(multi, jobId);
    queue.multiRequeue(multi, jd);

    await this.asyncRedis.execMulti(multi);

    return jd.id;
  }
}

export class DeadSortedSet extends CleanableScoreSortedSet implements IDead {
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

    const queue = this.client.queue(jd.options.queue);
    const multi = this.asyncRedis.multi();
    this.multiRemove(multi, jobId);
    queue.multiEnqueue(multi, jd);

    await this.asyncRedis.execMulti(multi);

    return jd.id;
  }
}

export class DoneSortedSet extends CleanableScoreSortedSet implements IDone {
  constructor(baseLogger: Bunyan, client: Client, asyncRedis: AsyncRedis) {
    super(baseLogger, client, asyncRedis, "done", client.redisPrefix, doneScorer);
  }
}
