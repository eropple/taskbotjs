import Chance from "chance";

const chance = new Chance();

export function floatWithinInterval(interval: number = 1, splay: number = 0.1): number {
  return chance.floating({ min: interval - splay, max: interval + splay });
}
