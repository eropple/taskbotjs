import Bunyan from "bunyan";
import { ClientPool } from "../ClientBase";

export interface IDependencies {
  readonly baseLogger: Bunyan;
  readonly clientPool: ClientPool;
}
