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
} from "@taskbotjs/client";

import { APIError, NotFoundError } from "./APIError";
import * as Middleware from "./Middleware";
import { PingResponse } from "./Responses";
import { runInThisContext } from "vm";

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
      const resp: Array<WorkerInfo> = await this.clientPool.use((taskbot) =>  taskbot.getWorkerInfo());
      res.json(resp);
    }));

    app.post("/workers/cleanup", asyncHandler(async (req, res) => {
      await this.clientPool.use((taskbot) => taskbot.cleanUpDeadWorkers());
      res.json({ ok: true });
    }));

    app.get("/queues", asyncHandler(async (req, res) => {
      const resp: Array<QueueInfo> = await this.clientPool.use((taskbot) => taskbot.getQueueInfo());
      res.json(resp);
    }));

    app.get("/queues/:queueName", asyncHandler(async (req, res) => {
      const queueName = req.params.queueName;
      const limit = req.query.limit;
      const offset = req.query.offset;

      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (taskbot) => taskbot.withQueue(
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
          async (taskbot) => {
            const queue = taskbot.queue(queueName);
            return queue.find((jd) => jd.id === jobId);
          }
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
        (taskbot) => taskbot.withQueue(
          queueName,
          (queue) => queue.remove(jobId)
        )
      );

      res.json({ ok: true });
    }));

    app.post("/queues/:queueName/:jobId/launch", asyncHandler(async (req, res) => {
      const queueName = req.params.queueName;
      const jobId = req.params.jobId;

      await this.clientPool.use(
        (taskbot) => taskbot.withQueue(
          queueName,
          async (queue) => {
            if (!await queue.launch(jobId)) {
              throw new NotFoundError(`Job '${jobId}' not pushed to head. It may have already been processed.`);
            }
          }
        )
      );

      res.json({ ok: true });
    }));

    app.get("/metrics/basic", asyncHandler(async (req, res) => {
      res.json(await this.clientPool.use(async (taskbot) => taskbot.getBasicMetrics()));
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

      const resp: MetricDayRange = await this.clientPool.use(async (taskbot) => taskbot.getDatedMetrics(start, end));
      res.json(resp);
    }));

    app.get("/metrics/storage", asyncHandler(async (req, res) => {
      const resp = await this.clientPool.use(async (taskbot) => taskbot.getStorageMetrics());
      res.json(resp);
    }));

    app.get("/scheduled", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (taskbot) => taskbot.scheduleSet.peek(req.query.limit, req.query.offset));
      res.json(resp);
    }));

    app.get("/scheduled/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp: JobDescriptor | null =
        await this.clientPool.use(
          async (taskbot) => {
            if (await taskbot.scheduleSet.contains(jobId)) {
              return taskbot.readJob(jobId);
            }

            return null;
          });

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.post("/scheduled/:jobId/launch", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      const ret = await this.clientPool.use(
        (taskbot) => taskbot.scheduleSet.launch(jobId));

      if (!ret) {
        throw new NotFoundError(`Job '${jobId}' not found. Possibly already out of the set.`);
      }

      res.json({ ok: true });
    }));

    app.delete("/scheduled/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        async (taskbot) => {
          await taskbot.scheduleSet.remove(jobId);
          await taskbot.unsafeDeleteJob(jobId);
        });

      res.json({ ok: true });
    }));

    app.get("/retry", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (taskbot) => taskbot.retrySet.peek(req.query.limit, req.query.offset));

      res.json(resp);
    }));

    app.get("/retry/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp: JobDescriptor | null =
        await this.clientPool.use(
          async (taskbot) => {
            if (await taskbot.retrySet.contains(jobId)) {
              return taskbot.readJob(jobId);
            }

            return null;
          });

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.post("/retry/:jobId/launch", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      const ret = await this.clientPool.use(
        (taskbot) => taskbot.retrySet.retry(jobId));

      if (!ret) {
        throw new NotFoundError(`Job '${jobId}' not found. Possibly already out of the set.`);
      }

      res.json({ ok: true });
    }));

    app.delete("/retry/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        async (taskbot) => {
          await taskbot.retrySet.remove(jobId);
          await taskbot.unsafeDeleteJob(jobId);
        });

      res.json({ ok: true });
    }));

    app.get("/dead", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (taskbot) => taskbot.deadSet.peek(req.query.limit, req.query.offset));
      res.json(resp);
    }));

    app.post("/dead/clean", asyncHandler(async (req, res) => {
      const count = await this.clientPool.use((taskbot) => taskbot.deadSet.cleanAll());

      res.json({ ok: true, count });
    }));

    app.get("/dead/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp: JobDescriptor | null =
        await this.clientPool.use(
          async (taskbot) => {
            if (await taskbot.deadSet.contains(jobId)) {
              return taskbot.readJob(jobId);
            }

            return null;
          });

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.post("/dead/:jobId/launch", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      const ret = await this.clientPool.use(
        (taskbot) => taskbot.deadSet.resurrect(jobId));

      if (!ret) {
        throw new NotFoundError(`Job '${jobId}' not found. Possibly already out of the set.`);
      }

      res.json({ ok: true });
    }));

    app.delete("/dead/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        async (taskbot) => {
          await taskbot.deadSet.remove(jobId);
          await taskbot.unsafeDeleteJob(jobId);
        });

      res.json({ ok: true });
    }));

    app.get("/done", asyncHandler(async (req, res) => {
      const resp: Array<JobDescriptor> =
        await this.clientPool.use(
          (taskbot) => taskbot.doneSet.peek(req.query.limit, req.query.offset));
      res.json(resp);
    }));

    app.post("/done/clean", asyncHandler(async (req, res) => {
      const count = await this.clientPool.use((taskbot) => taskbot.doneSet.cleanAll());

      res.json({ ok: true, count });
    }));

    app.get("/done/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;
      const resp: JobDescriptor | null =
        await this.clientPool.use(
          async (taskbot) => {
            if (await taskbot.doneSet.contains(jobId)) {
              return taskbot.readJob(jobId);
            }

            return null;
          });

      if (!resp) {
        throw new NotFoundError(`Job '${jobId}' not found.`);
      } else {
        res.json(resp);
      }
    }));

    app.delete("/done/:jobId", asyncHandler(async (req, res) => {
      const jobId = req.params.jobId;

      await this.clientPool.use(
        async (taskbot) => {
          await taskbot.doneSet.remove(jobId);
          await taskbot.unsafeDeleteJob(jobId);
        });

      res.json({ ok: true });
    }));

    if (logRequests) {
      app.use(Middleware.buildErrorLoggingMiddleware(logger));
    }

    return app;
  }
}
