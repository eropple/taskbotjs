export interface WorkerInfo {
  readonly name: string;
  readonly version: string;
  readonly flavor: string;
  readonly concurrency: number;
  readonly active: number;
  readonly lastBeat: number;
}

export interface MetricDay {
  readonly processed: number;
  readonly errored: number;
  readonly died: number;
}

export interface BasicMetrics {
  readonly totalProcessed: number;
  readonly totalErrored: number;
  readonly enqueued: number;
  readonly scheduledSetSize: number;
  readonly retrySetSize: number;
  readonly deadSetSize: number;
}

export type MetricDayRange = { [date: string]: MetricDay };

export interface QueueInfo {
  readonly name: string;
  readonly size: number;
}

export interface StorageInfo {
  readonly type: string;
  readonly data: object;
}
