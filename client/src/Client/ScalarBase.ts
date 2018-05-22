import { IScalar } from "..";
import { AsyncRedis } from "../redis";

export abstract class ScalarBase<TType> implements IScalar<TType> {
  constructor(protected readonly asyncRedis: AsyncRedis, readonly key: string) {}

  abstract async get(): Promise<TType| null>;
  abstract async set(value: TType): Promise<TType>;

  async delete(): Promise<boolean> {
    return (await this.asyncRedis.del(this.key)) === 1;
  }
}
