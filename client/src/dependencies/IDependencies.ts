import Bunyan from "bunyan";
import { ClientRoot } from "..";

export interface IDependencies {
  readonly baseLogger: Bunyan;
  readonly taskbot: ClientRoot;
}
