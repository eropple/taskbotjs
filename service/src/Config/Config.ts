import Bunyan from "bunyan";

import * as _ from "lodash";
import GenericPool from "generic-pool";
import { default as deepFreeze, DeepReadonly } from "deep-freeze";

import { ClientOpts as RedisClientOptions } from "redis";
import {
  IDependencies,

  JobDescriptor,
  Job,
  ConstructableJob,

  Client,
  ClientBase,
  ClientRoot,

  buildRedisPool,
  PoolOptions,
  RetryFunctionTimingFunction
} from "@taskbotjs/client";

import { ConstructableServerPlugin } from "../ServerPlugin";
import { Duration } from "luxon";

export type FinalizedConfig<TDependencies extends IDependencies> = DeepReadonly<Config<TDependencies>>;
export type LoggerFactory = () => Bunyan;
export type DependenciesFactory<TDependencies extends IDependencies> =
  (baseLogger: Bunyan, taskbot: ClientRoot) => TDependencies;

export type JobMapping<TDependencies extends IDependencies> = { [s: string]: ConstructableJob<TDependencies> };

/**
 * A type-lifted version of the important bits of Luxon's `Duration.fromObject()`,
 * which is used in our `TimeInterval` class.
 */
export type DurationFields = {
  years?: number,
  quarters?: number,
  months?: number,
  weeks?: number,
  days?: number,
  hours?: number,
  minutes?: number,
  seconds?: number,
  milliseconds?: number
};

/**
 * The various queue intakes are configured through inheritors of this
 * interface. Well, _intended_ queue intakes; right now there's only one at the
 * moment, though I intend to eventually write a strict option that will
 * probably depend on polling (ugh).
 */
export interface IntakeConfig {
  type: string;
}

/**
 * Configuration for the standard weighted queue. With it, one specifies
 * one or more queues and, optionally, a weight for each one. They'll
 * be polled through a weighted random algorithm.
 */
export interface WeightedQueueIntakeConfig extends IntakeConfig {
  type: "weighted";
  timeoutSeconds: number;
  queues: Array<WeightedQueueConfig>;
}

export interface WeightedQueueConfig {
  name: string;
  weight?: number;
}

/**
 * A measure of time for use in the sleep between instances of polling. The idea
 * is that there's an expected interval, modifies by the splay parameter, to
 * avoid thundering herds.
 */
export interface TimeInterval {
  /**
   * The baseline amount of time this interval expresses.
   */
  interval: DurationFields | Duration;
  /**
   * The maximum divergence from the interval's center. Generates a (theoretically)
   * uniform distribution from (interval - splay) to (interval + splay).
   */
  splay: DurationFields | Duration;
}

export interface PluginConfig {
  enabled: boolean;
}

/**
 * Base interface for any poller plugin. Provides the `polling` interface
 * which governs how rapidly the poller should tick.
 */
export interface PollerConfig extends PluginConfig {
  polling: TimeInterval;
}

/**
 * Configuration for the retry poller, which checks the retry set for
 * jobs ready to be retried.
 */
export interface RetryConfig extends PollerConfig {

}
/**
 * Configuration for the scheduled poller, which checks the scheduled set for
 * jobs ready to be queued at a given time.
 */
export interface ScheduleConfig extends PollerConfig {

}

/**
 * Configuration details for the Redis connector.
 */
export interface RedisOptions {
  options: RedisClientOptions;
  pool: PoolOptions;
}

/**
 * The basic, type-erased parent of the Config class. Exists mostly to satisfy
 * the TypeScript compiler.
 */
export class ConfigBase {
  /**
   * If set to true, the service listens for `SIGINT` and `SIGTERM` in able to
   * gracefully shut down. If set to false and you wish for graceful shutdown
   * (returning incomplete jobs to the queue), you must handle them yourself
   * and invoke `Server.shutdown()`.
   */
  listenToSignals: boolean = true;

  /**
   * Connection details for the Redis connector.
   */
  redis?: RedisOptions;
  /**
   * The maximum number of jobs that can be in-flight at the same time. This number
   * often requires tweaking; very IO-heavy workloads that rely mostly on external
   * sources can probably get away with a high concurrency, while more crunchy
   * workloads, even ones offloading heavy computation to child processes or to
   * C++ running outside the Node event loop, may thrash when not using a low
   * concurrency.
   *
   * Going above 20 is not recommended, but may work with some workloads and a
   * sufficiently specced Redis cluster.
   */
  concurrency: number = 20;
  /**
   * Period of time to pause after each intake pass.
   */
  intakePause: TimeInterval = {
    interval: Duration.fromObject({ milliseconds: 5 }),
    splay: Duration.fromObject({})
  };

  /**
   * Period of time to pause after checking all workers for completion.
   */
  jobPause: TimeInterval = {
    interval: Duration.fromObject({milliseconds: 5 }),
    splay: Duration.fromObject({})
  };

  /**
   * Configuration for the retry poller.
   */
  retry: RetryConfig = {
    enabled: true,
    polling: {
      interval: Duration.fromObject({ seconds: 1 }),
      splay: Duration.fromObject({ milliseconds: 100 })
    }
  };

  /**
   * Configuration for the schedule poller.
   */
  schedule: ScheduleConfig = {
    enabled: true,
    polling: {
      interval: Duration.fromObject({ seconds: 1 }),
      splay: Duration.fromObject({ milliseconds: 100 })
    }
  };

  /**
   * Configuration for the server intake, which governs how the server reads from
   * its job queues.
   */
  intake: IntakeConfig =
    { type: "weighted", queues: [{ name: "default" }] } as WeightedQueueIntakeConfig;

  /**
   * The Bunyan-based logger for the application. By default, will create a standard
   * logger named "taskbotjs-server", with no special streams or customization. Adjust to
   * taste.
   */
  logger: Bunyan = Bunyan.createLogger({ name: "taskbotjs-server" });

  /**
   * Plugins that implement the `ServerPlugin` abstract class.
   */
  plugins: Array<ConstructableServerPlugin> = [];

  /**
   * Generic config extensions. Nothing in TaskBotJS proper uses this field, but it's
   * provided for plugins or other uses. Please note that Config objects are deeply
   * copied before being used by the server; putting complex objects into this field
   * might get weird.
   */
  x: object = {};

  /**
   * Builds a JSJobs client for the server. This method should be considered internal.
   *
   * @private
   */
  buildClientPool() {
    if (this.redis) {
      const min = 4;
      const max = 6 + this.concurrency;
      return Client.withRedisOptions(this.logger, this.redis.options, this.redis.pool, { min, max });
    } else {
      throw new Error("No client configuration found.");
    }
  }
}

/**
 * The configuration object for the standard, Redis-backed TaskBotJS service. In TypeScript,
 * it accepts a generic type for dependency injection into your jobs.
 */
export class Config<TDependencies extends IDependencies> extends ConfigBase {
  readonly jobMap: JobMapping<TDependencies> = {};

  /**
   * The function that will be used to produce a dependencies object for each job.
   * The default value creates an object that passes only the barest requirements,
   * the logger and a TaskBotJS client, to the job.
   */
  dependencies: DependenciesFactory<TDependencies> =
    (baseLogger, taskbot) => ({ baseLogger, taskbot } as TDependencies);

  /**
   * Creates a shallow clone of this object, with one exception: the logger that is a
   * part of the Config object instead is referenced rather than copied.
   */
  copy(): Config<TDependencies> {
    // TODO:  so this is awful, but it's happening because otherwise _.cloneDeep does
    //        a real number on Bunyan. Maybe there's a better way.
    const logger = this.logger;
    this.logger = null;

    const newConfig = _.cloneDeep(this);
    this.logger = logger;
    newConfig.logger = logger;

    return newConfig;
  }

  /**
   * Register one or more jobs for use with the service.
   *
   * @param jobTypes jobs to register
   */
  register(...jobTypes: ConstructableJob<TDependencies>[]) {
    jobTypes.forEach((jobType) => {
      if (!jobType.jobName) {
        throw new Error(`Job '${jobType.name}' needs a jobName set.`);
      }

      this.jobMap[jobType.jobName] = jobType;
    });
  }
}
