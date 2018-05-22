import { JobDescriptor } from "../JobMetadata";

export interface IQueue {
  size(): Promise<number>;
  peek(limit: number, offset: number): Promise<Array<JobDescriptor>>;
  clear(): Promise<void>;

  map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>>;
  forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void>;
  find(fn: (data: JobDescriptor) => boolean): Promise<JobDescriptor | null>;

  byId(id: string): Promise<JobDescriptor | null>;
  remove(jd: JobDescriptor): Promise<boolean>;
  removeById(id: string): Promise<boolean>;

  enqueue(job: JobDescriptor): Promise<void>;
  requeue(job: JobDescriptor): Promise<void>;
  launchById(id: string): Promise<string | null>;

  acknowledge(job: JobDescriptor): Promise<void>;
}
