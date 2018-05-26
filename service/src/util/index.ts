import sleepAsync from "sleep-promise";

import { TimeInterval } from "../Config";
import { intervalSplayDuration } from "./random";

export async function sleepFor(p: TimeInterval): Promise<void> {
  return sleepAsync(intervalSplayDuration(p.interval, p.splay).shiftTo("seconds").seconds);
}

export async function yieldExecution(): Promise<void> {
  // Occasionally we just need to yield the application loop and get out
  // of the way so that other loops, etc. can do their thing. This seems
  // safe. (You'd wish this acted kind of like `sleep(0)` in other languages,
  // but not so much.)
  //
  // TODO: reimplement with `setImmediate`?
  return sleepAsync(1);
}
