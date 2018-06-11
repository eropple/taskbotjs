import * as _ from "lodash";

import { Job, JobBase } from "./Job";
import { JobDescriptorOptions } from "../JobMetadata";
import { ConstructableJobBase } from "./ConstructableJob";

export { generateJobId, Job, JobBase } from "./Job";
export { ConstructableJob } from "./ConstructableJob";

export function optionsFor(
  jobType: ConstructableJobBase | string,
  userOptions?: Partial<JobDescriptorOptions>
): JobDescriptorOptions {
  if (typeof(jobType) === "string") {
    if (!userOptions || !userOptions.queue) {
      throw new Error("Jobs specified by name must provide their own options and specify a queue.");
    }

    return _.merge({}, {
      queue: Job.defaultQueue,
      maxRetries: Job.maxRetries,
      backtrace: Job.backtrace
    }, userOptions);
  } else {
    return _.merge({}, {
      queue: jobType.defaultQueue,
      maxRetries: jobType.maxRetries,
      backtrace: jobType.backtrace,
    }, userOptions || {});
  }
}
