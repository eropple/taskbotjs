import * as _ from "lodash";
import Bunyan from "bunyan";

import { ConfigBase, IntakeConfig } from "../../Config";

import { Intake, IIntake } from "./Intake";

import { weightedIntakes } from "./WeightedQueueIntake";
import { IDependencies, ClientPool } from "@taskbotjs/client";

export { Intake, IIntake } from "./Intake";

export type IntakeFactory = (config: ConfigBase, baseLogger: Bunyan) => IIntake | null;

export function buildIntake(config: ConfigBase, clientPool: ClientPool, baseLogger: Bunyan): IIntake {
  for (let factory of [weightedIntakes]) {
    const intake = factory(config, clientPool, baseLogger);

    if (intake) {
      return intake;
    }
  }

  throw new Error("No intakes configured.");
}
