export type JobDescriptorOptions = {
  queue: string;
  expiresAt?: number;
  maxRetries: boolean | number;
  backtrace: boolean | number;
  skipDeadJob: boolean;
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

export type JobDescriptorOrchestrationScheduling = {}
export type JobDescriptorOrchestrationRecurring = {}

export type JobDescriptorOrchestration = {
  scheduledFor?: number;
  recurring?: JobDescriptorOrchestrationRecurring;
}

export type JobDescriptor = {
  id: string;
  name: string;
  source: string;
  createdAt: number;
  args: ReadonlyArray<any>;
  options: JobDescriptorOptions;
  status?: JobDescriptorStatus;
  orchestration?: JobDescriptorOrchestration;
  x: object;
}
