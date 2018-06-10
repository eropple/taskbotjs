import * as _ from "lodash";

import { Job, JobBase } from "./Job";
import { JobDescriptorOptions } from "../JobMetadata";
import { ConstructableJobBase } from "./ConstructableJob";

export { generateJobId, Job, JobBase } from "./Job";
export { ConstructableJob } from "./ConstructableJob";

export function optionsFor(jobType: ConstructableJobBase | string, userOptions?: JobDescriptorOptions): JobDescriptorOptions {
  if (typeof(jobType) === "string") {
    if (!userOptions) {
      throw new Error("Jobs specified by name must provide their own options.");
    }

    return userOptions;
  } else {
    return _.merge({}, {
      queue: jobType.defaultQueue,
      maxRetries: jobType.maxRetries,
      backtrace: jobType.backtrace,
    }, userOptions || {});
  }
}
