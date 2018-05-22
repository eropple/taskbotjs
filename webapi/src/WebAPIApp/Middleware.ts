import Bunyan from "bunyan";
import express, { Request, Response, NextFunction } from "express";

import { APIError } from "./APIError";

export function buildLogRequestsMiddleware(logger: Bunyan) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
    logger.info({ method: req.method, path: req.path, query: req.query, status: res.statusCode}, "HTTP request.");
  };
}

// Attached to all routes, but intended to provide sane query behavior to
// functions that require it.
export function paginationMiddleware(req: Request, res: Response, next: NextFunction) {
  const limit = Math.max(0, Math.min(10, parseInt(req.query.limit || "10", 10)));
  const offset = Math.max(0, parseInt(req.query.offset || "0", 10));

  req.query.limit = limit;
  req.query.offset = offset;

  next();
}

export function buildErrorLoggingMiddleware(logger: Bunyan) {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    let stack = [];
    if (err.stack) {
      stack = err.stack.split("\n").map((s: string) => s.trim());
    }
    logger.error({ method: req.method, path: req.path, query: req.query, error: err, stack: stack }, "An error occurred.")

    if (err instanceof APIError) {
      res.status(err.code).json({ error: true, errorName: err.name, errorMessage: err.message });
    } else if (err instanceof Error) {
      res.status(500).json({ error: true, errorName: err.name, errorMessage: err.message });
    } else {
      logger.error("This error isn't of type Error! I don't know what to do.");
      res.status(500).json({ error: true, errorMessage: "Internal error. Check your logs." });
    }

    next();
  };
}
