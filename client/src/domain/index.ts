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
  readonly completed: number;
  readonly died: number;
}

export interface BasicMetrics extends WorkMetric {
  readonly enqueued: number;
  readonly scheduledSetSize: number;
  readonly retrySetSize: number;
  readonly deadSetSize: number;
  readonly doneSetSize: number;
}

export type MetricDayRange = { [date: string]: WorkMetric };

/**
 * Details about a single job queue in TaskBotJS.
 */
export interface QueueInfo {
  readonly name: string;
  readonly size: number;
}

/**
 * Catch-all data representation for the underlying health of the TaskBotJS
 * storage system (i.e., Redis metrics).
 */
export interface StorageInfo {
  readonly type: string;
  readonly data: object;
}
