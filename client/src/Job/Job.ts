import os from "os";

import Bunyan from "bunyan";
import Chance from "chance";
import { DateTime, Duration } from "luxon";

import { IDependencies } from "../dependencies/IDependencies";
import { JobDescriptor, ClientRoot } from "..";
import { JobDescriptorOptions } from "../JobMetadata";
import { RetryFunctionTimingFunction, defaultJobBackoff } from "./backoff";
import { ClientPool, DateLike } from "../ClientBase";
import { DurationFields } from "../domain";

const chance = new Chance();

const dwGen = require("diceware-generator");
const enEFF = require("diceware-wordlist-en-eff");
const jobIdOptions = { language: enEFF, wordcount: 2, format: "array" };

export function generateJobId(manual: boolean = false) {
  const h = chance.hash({ length: 6 });

  if (manual) {
    return `m-${os.hostname()}-${h}`;
  } else {
    // creates two words (one per byte pair)
    const pieces = dwGen(jobIdOptions);
    pieces.push(h);
    return pieces.join("-");
  }
}

const NO_DEFAULT_CLIENT_POOL =
  "No default client pool assigned. You must set a " +
  "default client pool before using static Job shorthand.";

export class JobBase {
  static readonly jobName: string;
  static readonly defaultQueue: string;
  static readonly maxRetries: boolean | number;
  static readonly backtrace: boolean | number;
  static readonly calculateNextRetry: RetryFunctionTimingFunction;

  readonly jobId: string;
  protected readonly descriptor: JobDescriptor | null;
  protected readonly logger: Bunyan;

  constructor(baseLogger: Bunyan, descriptor?: JobDescriptor) {
    this.descriptor = descriptor || null;
    this.jobId = this.descriptor ? this.descriptor.id : generateJobId(true);

    this.logger = baseLogger.child({ component: this.constructor.name, jobId: this.jobId });
  }

  protected static _defaultClientPool: ClientPool | undefined;
  static get defaultClientPool(): ClientPool | undefined { return this._defaultClientPool; }
  static setDefaultClientPool(v: ClientPool) {
    this._defaultClientPool = v;
  }
}

export class Job<TDependencies extends IDependencies> extends JobBase {
  "constructor": typeof Job;
  static readonly jobName: string;
  static readonly defaultQueue: string = "default";
  static readonly maxRetries: boolean | number = 20;
  static readonly backtrace: boolean | number = 3;
  static readonly calculateNextRetry: RetryFunctionTimingFunction = defaultJobBackoff;

  protected readonly deps: TDependencies;

  constructor(deps: TDependencies, descriptor?: JobDescriptor) {
    super(deps.baseLogger, descriptor);

    this.deps = deps as TDependencies;
  }

  protected async withClient<T>(fn: (client: ClientRoot) => T | Promise<T>): Promise<T> {
    return this.deps.clientPool.use(fn);
  }

  async perform(...args: any[]): Promise<void> {};

  static async perform(...args: any[]): Promise<string> {
    if (!this._defaultClientPool) {
      throw new Error(NO_DEFAULT_CLIENT_POOL);
    }

    return this._defaultClientPool.use((taskbot) => taskbot.perform(this, ...args));
  }

  static async performWithOptions(userOptions: Partial<JobDescriptorOptions>, ...args: any[]): Promise<string> {
    if (!this._defaultClientPool) {
      throw new Error(NO_DEFAULT_CLIENT_POOL);
    }

    return this._defaultClientPool.use((taskbot) => taskbot.performWithOptions(this, userOptions, ...args));
  }

  static async scheduleAt(date: DateLike, ...args: any[]): Promise<string> {
    if (!this._defaultClientPool) {
      throw new Error(NO_DEFAULT_CLIENT_POOL);
    }

    return this._defaultClientPool.use((taskbot) => taskbot.scheduleAt(date, this, ...args));
  }

  static async scheduleAtWithOptions(date: DateLike, userOptions: Partial<JobDescriptorOptions>, ...args: any[]) {
    if (!this._defaultClientPool) {
      throw new Error(NO_DEFAULT_CLIENT_POOL);
    }

    return this._defaultClientPool.use((taskbot) => taskbot.scheduleAtWithOptions(date, this, userOptions, ...args));
  }

  static async scheduleIn(duration: Duration | DurationFields, ...args: any[]): Promise<string> {
    if (!this._defaultClientPool) {
      throw new Error(NO_DEFAULT_CLIENT_POOL);
    }

    return this._defaultClientPool.use((taskbot) => taskbot.scheduleIn(duration, this, ...args));
  }

  static async scheduleInWithOptions(duration: Duration | DurationFields, userOptions: Partial<JobDescriptorOptions>, ...args: any[]) {
    if (!this._defaultClientPool) {
      throw new Error(NO_DEFAULT_CLIENT_POOL);
    }

    return this._defaultClientPool.use((taskbot) => taskbot.scheduleInWithOptions(duration, this, userOptions, ...args));
  }

}
