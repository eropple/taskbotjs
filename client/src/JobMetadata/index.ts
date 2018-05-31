export type JobDescriptorOptions = {
  queue: string;
  expiresAt?: number;
  maxRetries: boolean | number;
  backtrace: boolean | number;
}

export type JobDescriptorErrorDetail = {
  message: string;
  backtrace?: string[];
}

export type JobDescriptorStatus = {
  success?: boolean;
  startedAt: number;
  endedAt?: number;
  retry: number;
  nextRetryAt?: number;
  error?: JobDescriptorErrorDetail;
}

export type JobDescriptorOrchestration = {
  scheduledFor?: number;
}

export type JobDescriptor = {
  /**
   * The job ID. Randomly assigned.
   */
  id: string;

  /**
   * The name of the job. A `Job` must be registered with the server that
   * responds to this name in order to handle a job.
   *
   * @see Job
   */
  name: string;

  /**
   * The system that created the job. Format is "hostname/pid".
   */
  source: string;

  /**
   * Millisecond timestamp of the creation of this job.
   */
  createdAt: number;

  /**
   * Arguments to pass to the job.
   */
  args: Array<any>;

  options: JobDescriptorOptions;
  status?: JobDescriptorStatus;
  orchestration?: JobDescriptorOrchestration;

  /**
   * Catch-all extensibility member. TaskBotJS will never directly use anything
   * in this object; rather, it exists for third parties to attach data to a
   * job descriptor for use in plugins/middleware.
   */
  x: { [name: string]: any };
}

export type JobDescriptorOrId = JobDescriptor | string;
