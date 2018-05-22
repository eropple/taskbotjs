import { IScalar } from "./IScalar";

export interface ICounter extends IScalar<number> {
  increment(): Promise<number>;
  decrement(): Promise<number>;
}
