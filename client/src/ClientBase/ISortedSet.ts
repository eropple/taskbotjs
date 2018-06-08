import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { DateTime } from "luxon";

export interface ISortedSet<T> {
  size(): Promise<number>;

  add(item: T): Promise<number>;
  remove(itemOrId: T | string): Promise<boolean>;
  contains(itemOrId: T | string): Promise<boolean>;

  fetchAndUse<U>(min: number, max: number, fn: (item: T) => U, orElseFn: () => U): Promise<U | null>

  forEach(fn: (item: T) => any | Promise<any>): Promise<void>;
  map<U>(fn: (item: T) => U | Promise<U>): Promise<Array<U>>;
  find(fn: (item: T) => boolean | Promise<boolean>): Promise<T | null>;

  peek(limit: number, offset: number): Promise<Array<T>>;

  cleanAllBefore(cutoff: DateTime): Promise<number>;

  /**
   * Iterates over the set, deletes all jobs whose IDs TaskBotJS can find in the
   * set, and removes the job ID from the set.
   *
   * This expects an interface to be somewhat lossy and, as such, invoking this
   * function is not guaranteed to result in a set of size 0 if there are
   * elements being added. (Consider the Redis ZSCAN case; items added during
   * the scan are not guaranteed to be covered by the ZSCAN cursor pass.)
   */
  cleanAll(): Promise<number>;
}

export interface IJobSortedSet extends ISortedSet<JobDescriptor> {

}

export interface IRetries extends IJobSortedSet {
  retry(jobOrId: JobDescriptorOrId): Promise<string | null>;
}

export interface IScheduled extends IJobSortedSet {
  launch(jobOrId: JobDescriptorOrId): Promise<string | null>;
}

export interface IDead extends IJobSortedSet {
  resurrect(jobOrId: JobDescriptorOrId): Promise<string | null>;
}

export interface IDone extends IJobSortedSet {

}
