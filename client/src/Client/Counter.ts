import { AsyncRedis } from "../redis";

import { ICounter } from "../ClientBase/ICounter";
import { ScalarBase } from "./ScalarBase";


export class Counter extends ScalarBase<number> implements ICounter {
  async increment(): Promise<number> {
    return this.asyncRedis.incr(this.key);
  }
  async decrement(): Promise<number> {
    return this.asyncRedis.decr(this.key);
  }
  async delete(): Promise<boolean> {
    return (await this.asyncRedis.del(this.key)) === 1;
  }

  async get(): Promise<number> {
    const v = await this.asyncRedis.get(this.key);

    if (v) {
      return parseInt(v, 10);
    } else {
      return 0;
    }
  }

  async set(value: number): Promise<number> {
    return parseInt(await this.asyncRedis.set(this.key, value.toString()), 10);
  }
}
