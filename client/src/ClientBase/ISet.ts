import { JobDescriptor } from "..";

export interface ISet {
  size(): Promise<number>;
  clear(): Promise<void>;

  add(job: JobDescriptor): Promise<number>;
  remove(jd: JobDescriptor): Promise<boolean>;

  fetchAndUse<T>(min: number, max: number, fn: (data: JobDescriptor) => T, orElseFn: () => T): Promise<T | null>

  forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void>;
  map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>>;
  find(fn: (data: JobDescriptor) => boolean | Promise<boolean>): Promise<JobDescriptor | null>;

  byId(id: string): Promise<JobDescriptor | null>;
  peek(limit: number, offset: number): Promise<Array<JobDescriptor>>;
  remove(jd: JobDescriptor): Promise<boolean>;
  removeById(id: string): Promise<boolean>;
}

export interface IRetries extends ISet {
  retry(jd: JobDescriptor): Promise<string | null>;
  retryById(id: string): Promise<string | null>;
}

export interface IDead extends ISet {
  resurrect(jd: JobDescriptor): Promise<string | null>;
  resurrectById(id: string): Promise<string | null>;
}

export interface IScheduled extends ISet {
  launch(jd: JobDescriptor): Promise<string | null>;
  launchById(id: string): Promise<string | null>;
}
