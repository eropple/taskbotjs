import os from "os";

import Bunyan from "bunyan";
import Chance from "chance";
import { DateTime } from "luxon";

import { IDependencies } from "../dependencies/IDependencies";
import { JobDescriptor, ClientRoot } from "..";
import { JobDescriptorOptions } from "../JobMetadata";
import { RetryFunctionTimingFunction, defaultJobBackoff } from "./backoff";

const chance = new Chance();
const niceware = require("niceware");

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

export class JobBase {
  static readonly jobName: string;
  static readonly defaultQueue: string;
  static readonly maxRetries: boolean | number;
  static readonly backtrace: boolean | number;
  static readonly skipDeadJob: boolean;
  static readonly calculateNextRetry: RetryFunctionTimingFunction;

  readonly jobId: string;
  protected readonly descriptor: JobDescriptor | null;
  protected readonly logger: Bunyan;

  constructor(baseLogger: Bunyan, descriptor?: JobDescriptor) {
    this.descriptor = descriptor || null;
    this.jobId = this.descriptor ? this.descriptor.id : generateJobId(true);

    this.logger = baseLogger.child({ component: this.constructor.name, jobId: this.jobId });
  }
}

export class Job<TDependencies extends IDependencies> extends JobBase {
  "constructor": typeof Job;
  static readonly jobName: string;
  static readonly defaultQueue: string = "default";
  static readonly maxRetries: boolean | number = 20;
  static readonly backtrace: boolean | number = 3;
  static readonly skipDeadJob: boolean = false;
  static readonly calculateNextRetry: RetryFunctionTimingFunction = defaultJobBackoff;

  protected readonly deps: TDependencies;

  protected get taskbot() { return this.deps.taskbot; }

  constructor(deps: TDependencies, descriptor?: JobDescriptor) {
    super(deps.baseLogger, descriptor);

    this.deps = deps as TDependencies;
  }

  async perform(...args: any[]): Promise<void> {};
}
