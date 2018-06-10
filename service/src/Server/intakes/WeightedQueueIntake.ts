import * as _ from "lodash";
import { promisify } from "util";
import Bunyan from "bunyan";

import {
  IntakeConfig,
  WeightedQueueIntakeConfig,
  WeightedQueueConfig,
  ConfigBase
} from "../../Config";

import { Intake } from "./Intake";

import {
  JobDescriptor,
  IDependencies,
  keyForQueue,
  Client,
  ClientPool,
  ClientRoot
} from "@taskbotjs/client";
import { ServerBase } from "..";

export function weightedIntakes(
  config: ConfigBase, server: ServerBase, baseLogger: Bunyan
): WeightedJobIntake | null {
  if (config.intake.type !== "weighted") {
    return null;
  } else {
    const intake = config.intake as WeightedQueueIntakeConfig;
    return new WeightedJobIntake(intake, server, baseLogger);
  }
}

function weightsFromQueues(queues: ReadonlyArray<WeightedQueueConfig>): ReadonlyArray<string> {
  const qw: Array<string> = [];
  queues.forEach((queue) => {
    const weight = queue.weight || 1;
    for (let i = 0; i < weight; ++i) {
      qw.push(queue.name);
    }
  });
  return qw;
}

export class WeightedJobIntake extends Intake<WeightedQueueIntakeConfig> {
  protected readonly timeoutSeconds: number;
  protected readonly queueWeights: ReadonlyArray<string>;

  constructor(intakeConfig: WeightedQueueIntakeConfig, server: ServerBase, baseLogger: Bunyan) {
    super(intakeConfig, server, baseLogger);

    this.timeoutSeconds = Math.floor(intakeConfig.timeoutSeconds || 15);
    this.queueWeights = weightsFromQueues(intakeConfig.queues);
  }

  async fetch(client: ClientRoot): Promise<JobDescriptor | null> {
    const job = await client.fetchQueueJob(_.uniq(_.shuffle(this.queueWeights)), this.timeoutSeconds);

    if (job) {
      this.logger.debug({ jobId: job.id }, "Job fetched.");
      return job;
    } else {
      this.logger.trace("No jobs found during intake.");
      return null;
    }
  }
}
