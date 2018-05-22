import * as _ from "lodash";
import GenericPool from "generic-pool";

import { RedisClientOptions, AsyncRedis } from ".";
import { createHandyClient, IHandyRedis } from "handy-redis";

export type PoolOptions = GenericPool.Options;
export type RedisPool = GenericPool.Pool<AsyncRedis>

export function buildRedisPool(redisOptions: RedisClientOptions, poolOptions?: PoolOptions): GenericPool.Pool<AsyncRedis> {
  const factory: GenericPool.Factory<AsyncRedis> = {
    create: async () => createHandyClient(redisOptions),
    destroy: async (asyncRedis: AsyncRedis): Promise<any> => asyncRedis.redis.end(true)
  };

  const finishedPoolOptions: PoolOptions = _.merge({}, { min: 1, max: 10 }, poolOptions || {});

  return GenericPool.createPool<AsyncRedis>(factory, finishedPoolOptions);
}
