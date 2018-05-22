import { IDependencies, JobDescriptor, RetryFunctionTimingFunction, Job, JobBase } from "..";

// The erasure here (and in a lot of places in the client library) is mostly to facilitate
// server-side binding of jobs to job names. It is a bit inelegant, but it allows us to
// throw around ES6 classes that inherit from Job<TDependencies> while erasing TDependencies
// on the client side (because we have no idea, and really can have no idea, what that will
// actually resolve to on the server side).
export interface ConstructableJobBase {
  new(deps: IDependencies, descriptor: JobDescriptor): JobBase;
  name: string;
  jobName: string;
  defaultQueue: string;
  maxRetries: boolean | number;
  backtrace: boolean | number;
  skipDeadJob: boolean;
  calculateNextRetry: RetryFunctionTimingFunction;
}

export interface ConstructableJob<TDependencies extends IDependencies> extends ConstructableJobBase {
  new(deps: TDependencies, descriptor: JobDescriptor): Job<TDependencies>;
}
