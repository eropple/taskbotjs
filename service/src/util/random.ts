import Chance from "chance";
import { Duration } from "luxon";

import { DurationFields } from "../Config/Config";

const chance = new Chance();

export function floatWithinInterval(interval: number = 1, splay: number = 0.1): number {
  return chance.floating({ min: interval - splay, max: interval + splay });
}

export function intervalSplayDuration(interval: Duration | DurationFields, splay: Duration | DurationFields): Duration {
  const ms = intervalSplayMilliseconds(interval, splay);

  return Duration.fromObject({ milliseconds: ms }).normalize();
}

export function intervalSplayMilliseconds(interval: Duration | DurationFields, splay: Duration | DurationFields): number {
  let i: Duration;
  let s: Duration;

  if (!(interval instanceof Duration)) {
    i = Duration.fromObject(interval);
  } else {
    i = interval;
  }

  if (!(splay instanceof Duration)) {
    s = Duration.fromObject(splay);
  } else {
    s = splay;
  }

  const intervalMs = i.shiftTo("milliseconds").milliseconds;
  const splayMs = i.shiftTo("milliseconds").milliseconds;

  return chance.floating({ min: intervalMs - splayMs, max: intervalMs + splayMs });
}
