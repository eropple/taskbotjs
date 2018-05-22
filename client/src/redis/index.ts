import {
  IHandyRedis,
  createHandyClient
} from "handy-redis";

import { ClientOpts as RedisClientOptions } from "redis";
export {
  ClientOpts as RedisClientOptions,
  RedisClient as SyncRedis
} from "redis";

export { IHandyRedis as AsyncRedis } from "handy-redis";

export { buildRedisPool, RedisPool, PoolOptions } from "./pool";

export function buildRedis(redisConfig: RedisClientOptions): IHandyRedis {
  return createHandyClient(redisConfig);
}

export function duplicateRedis(asyncRedis: IHandyRedis): IHandyRedis {
  const redis = asyncRedis.redis.duplicate();
  return createHandyClient(redis);
}
