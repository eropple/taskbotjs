import { Server as HttpServer } from "http";

import Bunyan from "bunyan";
import { DateTime } from "luxon";
import express, { Response, Request } from "express";
import asyncHandler from "express-async-handler";
import {
  ClientPool,
  ClientRoot,
  WorkerInfo,
  MetricDayRange,
  LUXON_YMD,
  JobDescriptor,
  QueueInfo
} from "@jsjobs/client";

import { APIError, NotFoundError } from "./APIError";
import * as Middleware from "./Middleware";
import { PingResponse } from "./Responses";

export class WebAPIApp {
  readonly expressApp: express.Express;
  readonly logger: Bunyan;

  constructor(baseLogger: Bunyan, private readonly clientPool: ClientPool, logRequests: boolean = true) {
    this.logger = baseLogger.child({ component: "WebAPIApp" });
    this.expressApp = this.buildExpress(logRequests);
  }

  private buildExpress(logRequests: boolean = true): express.Express {
    const logger = this.logger.child({ component: "Express" });

    const app = express();
    if (logRequests) {
      app.use(Middleware.buildLogRequestsMiddleware(logger));
    }
    app.use(Middleware.paginationMiddleware);

    app.get("/ping", (req, res) => {
      const resp: PingResponse = { pong: true };
      res.json(resp);
    });

    app.get("/workers", asyncHandler(async (req, res) => {
      const resp: Array<WorkerInfo> = await this.clientPool.use((jsjobs) =>  jsjobs.getWorkerInfo());
      res.json(resp);
    }));

    app.post("/workers/cleanup", asyncHandler(async (req, res) => {
      await this.clientPool.use((jsjobs) => jsjobs.cleanUpDeadWorkers());
      res.json({ ok: true });
    }));

    app.get("/queues", asyncHandler(async (req, res) => {
      const resp: Array<QueueInfo> = await this.clientPool.use((jsjobs) => jsjobs.getQueueInfo());
      res.json(resp);
    }));

    app.get("/queues/:queueName", asyncHandler(async (req, res) => {
      const queueName = req.params.queueName;
      const limit = req.query.limit;
      const offset = req.query.offset;

      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withQueue(
            queueName,
            (queue) => queue.peek(limit, offset)
          )
        );

      res.json(resp);
    }));

    app.get("/queues/:queueName/:jobId", asyncHandler(async (req, res) => {
      const queueName = req.params.queueName;
      const jobId = req.params.jobId;

      const resp: JobDescriptor | null =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withQueue(
            queueName,
            (queue) => queue.byId(jobId)
          )
        );

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found in queue. It may have already been dequeued.`);
      }

      res.json(resp);
    }));

    app.delete("/queues/:queueName/:jobId", asyncHandler(async (req, res) => {
      const queueName = req.params.queueName;
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withQueue(
          queueName,
          (queue) => queue.removeById(jobId)
        )
      );

      res.json({ ok: true });
    }));

    app.post("/queues/:queueName/:jobId/launch", asyncHandler(async (req, res) => {
      const queueName = req.params.queueName;
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withQueue(
          queueName,
          async (queue) => {
            if (!await queue.launchById(jobId)) {
              throw new NotFoundError(`Job '${jobId}' not pushed to head. It may have already been processed.`);
            }
          }
        )
      );

      res.json({ ok: true });
    }));

    app.get("/metrics/basic", asyncHandler(async (req, res) => {
      res.json(await this.clientPool.use(async (jsjobs) => jsjobs.getBasicMetrics()));
    }));

    app.get("/metrics/dated", asyncHandler(async (req, res) => {
      const now = DateTime.utc();
      let start = now;
      let end = now;

      if (req.query.start) {
        start = DateTime.fromFormat(req.query.start, LUXON_YMD, { zone: "UTC" });
      }

      if (req.query.end) {
        end = DateTime.fromFormat(req.query.end, LUXON_YMD, { zone: "UTC" });
      }

      const resp: MetricDayRange = await this.clientPool.use(async (jsjobs) => jsjobs.getDatedMetrics(start, end));
      res.json(resp);
    }));

    app.get("/metrics/storage", asyncHandler(async (req, res) => {
      const resp = await this.clientPool.use(async (jsjobs) => jsjobs.getStorageMetrics());
      res.json(resp);
    }));

    app.get("/scheduled", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withScheduledSet(
            (scheduledSet) => scheduledSet.peek(req.query.limit, req.query.offset)
          )
        );
      res.json(resp);
    }));

    app.get("/scheduled/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withScheduledSet(
            (scheduledSet) => scheduledSet.byId(jobId)
          )
        )

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.post("/scheduled/:jobId/launch", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withScheduledSet(
          async (scheduledSet) => {
            const ret = await scheduledSet.launchById(jobId);

            if (!ret) {
              throw new NotFoundError(`Job '${jobId}' not found. Possibly already out of the set.`);
            }

            return ret;
          }
        )
      )

      res.json({ ok: true });
    }));

    app.delete("/scheduled/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withScheduledSet(
          async (scheduledSet) => {
            const jd = await scheduledSet.byId(jobId);

            if (jd) {
              await scheduledSet.remove(jd);
            }
          }
        )
      );
      res.json({ ok: true });
    }));

    app.get("/retry", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withRetrySet(
            (retrySet) => retrySet.peek(req.query.limit, req.query.offset)
          )
        );
      res.json(resp);
    }));

    app.get("/retry/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withRetrySet(
            (retrySet) => retrySet.byId(jobId)
          )
        )

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.post("/retry/:jobId/launch", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withRetrySet(
          async (retrySet) => {
            const ret = await retrySet.retryById(jobId);

            if (!ret) {
              throw new NotFoundError(`Job '${jobId}' not found. Possibly already out of the set.`);
            }

            return ret;
          }
        )
      )

      res.json({ ok: true });
    }));

    app.delete("/retry/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withRetrySet(
          async (retrySet) => {
            const jd = await retrySet.byId(jobId);

            if (jd) {
              await retrySet.remove(jd);
            }
          }
        )
      );
      res.json({ ok: true });
    }));

    app.get("/dead", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withDeadSet(
            (deadSet) => deadSet.peek(req.query.limit, req.query.offset)
          )
        );
      res.json(resp);
    }));

    app.get("/dead/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp =
        await this.clientPool.use(
          (jsjobs) => jsjobs.withDeadSet(
            (deadSet) => deadSet.byId(jobId)
          )
        )

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.post("/dead/:jobId/launch", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withDeadSet(
          async (deadSet) => {
            const ret = await deadSet.resurrectById(jobId);

            if (!ret) {
              throw new NotFoundError(`Job '${jobId}' not found. Possibly already out of the set.`);
            }

            return ret;
          }
        )
      )

      res.json({ ok: true });
    }));

    app.delete("/dead/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (jsjobs) => jsjobs.withDeadSet(
          async (deadSet) => {
            const jd = await deadSet.byId(jobId);

            if (jd) {
              await deadSet.remove(jd);
            }
          }
        )
      );
      res.json({ ok: true });
    }));

    if (logRequests) {
      app.use(Middleware.buildErrorLoggingMiddleware(logger));
    }

    return app;
  }
}
