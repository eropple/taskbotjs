export interface WorkerInfo {
  readonly name: string;
  readonly version: string;
  readonly flavor: string;
  readonly concurrency: number;
  readonly active: number;
  readonly lastBeat: number;
}

export interface WorkMetric {
  readonly processed: number;
  readonly errored: number;
  readonly died: number;
}

// TODO: unify this and WorkMetric; is "total" really necessary?
export interface BasicMetrics {
  readonly totalProcessed: number;
  readonly totalErrored: number;
  readonly enqueued: number;
  readonly scheduledSetSize: number;
  readonly retrySetSize: number;
  readonly deadSetSize: number;
}

export type MetricDayRange = { [date: string]: WorkMetric };

export interface QueueInfo {
  readonly name: string;
  readonly size: number;
}

export interface StorageInfo {
  readonly type: string;
  readonly data: object;
}
