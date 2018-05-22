import Chance from "chance";
import { DateTime } from "luxon";
import { DateLike } from "../ClientBase";

const chance = new Chance();

// RetryFunctionTiming _must_ return an object that turns into a UTC millisecond timestamp.
// (If you use Luxon, like we do, that comes out of the box.)
export type RetryFunctionTimingFunction =
  (endsAtTimestamp: number, nextRetryCount: number) => DateLike;

export function exponentialBackoff(
  constantFactorInSeconds: number = 15,
  basePeriodInSeconds: number = 1,
  exponentialFactor: number = 4,
  randomJitterInSeconds: number = 30): RetryFunctionTimingFunction {
  return (endsAtTimestamp: number, nextRetryCount: number) => {
    const seconds =
      constantFactorInSeconds +
      Math.pow((nextRetryCount * basePeriodInSeconds), exponentialFactor) +
      (
        chance.integer({ min: 0, max: randomJitterInSeconds }) *
        (nextRetryCount + 1)
      );

    const a = DateTime.fromMillis(endsAtTimestamp, { zone: "UTC" });
    return a.plus({ seconds });
  };
}

export function linearBackoff(
  constantFactorInSeconds: number = 15,
  basePeriodInSeconds: number = 1,
  randomJitterInSeconds: number = 30
): RetryFunctionTimingFunction {
  return exponentialBackoff(constantFactorInSeconds, basePeriodInSeconds, 1, randomJitterInSeconds);
}

export function constantBackoff(seconds: number = 1) {
  return (endsAtTimestamp: number, _nextRetryCount: number) => {
    return DateTime.fromMillis(endsAtTimestamp, { zone: "UTC" }).plus({ seconds });
  };
}

export const defaultJobBackoff: RetryFunctionTimingFunction = exponentialBackoff();
