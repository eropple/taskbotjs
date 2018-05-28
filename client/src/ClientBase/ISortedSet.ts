import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";
import { DateTime } from "luxon";

export interface ISortedSet {
  size(): Promise<number>;

  add(job: JobDescriptor): Promise<number>;
  remove(jobOrId: JobDescriptorOrId): Promise<boolean>;
  contains(jobOrId: JobDescriptorOrId): Promise<boolean>;

  fetchAndUse<T>(min: number, max: number, fn: (data: JobDescriptor) => T, orElseFn: () => T): Promise<T | null>

  forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void>;
  map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>>;
  find(fn: (data: JobDescriptor) => boolean | Promise<boolean>): Promise<JobDescriptor | null>;

  peek(limit: number, offset: number): Promise<Array<JobDescriptor>>;
  remove(jd: JobDescriptor): Promise<boolean>;
}

export interface ICleanableSet extends ISortedSet {
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

export interface IRetries extends ISortedSet {
  retry(jobOrId: JobDescriptorOrId): Promise<string | null>;
}

export interface IScheduled extends ISortedSet {
  launch(jobOrId: JobDescriptorOrId): Promise<string | null>;
}

export interface IDead extends ICleanableSet {
  resurrect(jobOrId: JobDescriptorOrId): Promise<string | null>;
}

export interface IDone extends ICleanableSet {

}
