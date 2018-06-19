// This producer simulates (at a very crude level) a service that spins off jobs
// for a TaskBotJS consumer to handle.

import Bunyan from "bunyan";
import Chance from "chance";
import sleepAsync from "sleep-promise";

import {
  Client,
  ClientMiddleware
} from "@taskbotjs/client";

import { exampleClientMiddleware } from "../exampleClientMiddleware";

import { PingJob } from "../jobs/PingJob";
import { PongJob } from "../jobs/PongJob";
import { FailJob } from "../jobs/FailJob";
import { DateTime } from "luxon";
import { FutureJob } from "../jobs/FutureJob";
import { ArgJob } from "../jobs/ArgJob";
import { LongJob } from "../jobs/LongJob";


const BunyanPrettyStream = require("bunyan-prettystream-circularsafe");

const chance = new Chance();
const logger = Bunyan.createLogger({
  name: "producer",
  // level: "trace", // everything you didn't actually want to know
  // level: "debug", // less spam, includes implementation details
  level: "info", // minimal what-you-need-to-know level
  streams: [
    {
      type: 'raw',
      stream: (() => {
        const prettyStream = new BunyanPrettyStream();
        prettyStream.pipe(process.stderr);

        return prettyStream;
      })()
    }
  ]
});

const clientMiddleware = new ClientMiddleware();
clientMiddleware.register(logger, exampleClientMiddleware);

const clientPool = Client.withRedisOptions(logger, {
  url: process.env.TASKBOT_REDIS_URL || "redis://localhost:18377",
  prefix: "ex/"
}, clientMiddleware);

(async () => {
  while (true) {
    if (chance.integer({ min: 0, max: 100 }) < 20) {
      for (let i = 0; i < chance.integer({ min: 1, max: 20 }); ++i) {
        logger.info("Queueing ping job.");
        await clientPool.use(async (taskbot) => taskbot.performAsync(PingJob));
      }
    }

    if (chance.integer({ min: 0, max: 100 }) < 20) {
      for (let i = 0; i < chance.integer({ min: 1, max: 20 }); ++i) {
        logger.info("Queueing arg job.");
        await clientPool.use(async (taskbot) => taskbot.performAsync(ArgJob, chance.integer({ min: 1, max: 100 })));
      }
    }

    if (chance.integer({ min: 0, max: 100 }) < 5) {
      logger.info("Queueing fail job.");
      await clientPool.use(async (taskbot) => taskbot.performAsync(FailJob));
    }

    if (chance.integer({ min: 0, max: 100 }) < 5) {
      logger.info("Queueing long job.");
      await clientPool.use(async (taskbot) => taskbot.performAsync(LongJob));
    }

    if (chance.integer({ min: 0, max: 100 }) < 15) {
      const t = DateTime.utc().plus({ seconds: 15 });
      for (let i = 0; i < chance.integer({ min: 1, max: 3 }); ++i) {
        logger.info("Queueing a job to be fired in 15 seconds.");
        await clientPool.use(async (taskbot) => taskbot.performAt(t, FutureJob));
      }
    }

    const sleepTime = Math.max(1, chance.normal({ mean: 100, dev: 99 }));
    logger.trace({ sleepTime }, "sleeping.");
    await sleepAsync(sleepTime);
  }
})();
