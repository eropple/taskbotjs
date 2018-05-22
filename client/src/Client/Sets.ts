import { DateTime } from "luxon";

import { AsyncRedis } from "../redis";
import { JobDescriptor } from "../JobMetadata";
import { IRetries, IScheduled, IDead } from "../ClientBase/ISet";
import { ScoreSortedSet } from "./ScoreSortedSet";
import { Client } from ".";

const retryScorer = (jd: JobDescriptor) => jd.status.nextRetryAt;
const scheduledScorer = (jd: JobDescriptor) => jd.orchestration.scheduledFor;
const deadScorer = (jd: JobDescriptor) => jd.status.endedAt;

export class RetrySortedSet extends ScoreSortedSet implements IRetries {
  constructor(private readonly client: Client, asyncRedis: AsyncRedis) {
    super(asyncRedis, "retry", client.redisPrefix, retryScorer);
  }

  async retry(jd: JobDescriptor): Promise<string | null> {
    await this.client.withQueue(
      jd.options.queue,
      async (queue) => {
        const rq = await queue.enqueue(jd);
        await this.remove(jd);
        return rq;
      }
    );

    return jd.id;
  }

  async retryById(id: string): Promise<string | null> {
    const jd = await this.byId(id);

    if (jd) {
      return this.retry(jd);
    } else {
      return null;
    }
  }
}

export class ScheduledSortedSet extends ScoreSortedSet implements IScheduled {
  constructor(private readonly client: Client, asyncRedis: AsyncRedis) {
    super(asyncRedis, "scheduled", client.redisPrefix, scheduledScorer);
  }

  async launch(jd: JobDescriptor): Promise<string | null> {
    await this.client.withQueue(
      jd.options.queue,
      async (queue) => {
        const rq = await queue.requeue(jd);
        await this.remove(jd);
        return rq;
      }
    );

    return jd.id;
  }

  async launchById(id: string): Promise<string | null> {
    const jd = await this.byId(id);

    if (jd) {
      return this.launch(jd);
    } else {
      return null;
    }
  }
}

export class DeadSortedSet extends ScoreSortedSet implements IDead {
  constructor(private readonly client: Client, asyncRedis: AsyncRedis) {
    super(asyncRedis, "dead", client.redisPrefix, deadScorer);
  }

  async resurrect(jd: JobDescriptor): Promise<string | null> {
    await this.client.withQueue(
      jd.options.queue,
      async (queue) => {
        const rq = await queue.enqueue(jd);
        await this.remove(jd);
        return rq;
      }
    );

    return jd.id;
  }

  async resurrectById(id: string): Promise<string | null> {
    const jd = await this.byId(id);

    if (jd) {
      return this.resurrect(jd);
    } else {
      return null;
    }
  }
}
