import { JobDescriptor, JobDescriptorOrId } from "../JobMetadata";

export interface IQueue {
  size(): Promise<number>;
  peek(limit: number, offset: number): Promise<Array<JobDescriptor>>;

  map<T>(fn: (data: JobDescriptor) => T | Promise<T>): Promise<Array<T>>;
  forEach(fn: (data: JobDescriptor) => any | Promise<any>): Promise<void>;
  find(fn: (data: JobDescriptor) => boolean): Promise<JobDescriptor | null>;

  remove(jobOrId: JobDescriptorOrId): Promise<boolean>;

  enqueue(job: JobDescriptor): Promise<string>;
  requeue(job: JobDescriptor): Promise<void>;
  launch(jobOrId: JobDescriptorOrId): Promise<string | null>;

  acknowledge(job: JobDescriptor): Promise<void>;
}
