import path from "path";
import fs from "fs";

import express from "express";
import cors from "cors";
import { WebAPIApp, Middleware } from "@jsjobs/webapi";

import { PanelConfig } from "./PanelConfig";

/**
 * `@jsjobs/panel` mostly exists to weld together `@jsjobs/webapi` and
 * `@jsjobs/webui` into a single distributable. A very simple Express
 * server serves both the API and the static resources of the webui,
 * while also handling configuration details for the API so it knows
 * how to find the data store.
 */
export function runServer(config: PanelConfig) {
  const logger = config.logger.child({ component: "Panel" });

  const clientPool = config.buildClientPool();
  const webapi = new WebAPIApp(config.logger, clientPool);
  const webuiConfig = {
    apiBase: `${config.externalHttpBase}/api`
  };

  const server = express();
  logger.debug("Attaching request log middleware.");
  server.use(Middleware.buildLogRequestsMiddleware(logger));
  server.use(cors());

  logger.debug("Mounting API.");
  server.use("/api", webapi.expressApp);

  logger.debug("Mounting synthetic config.json.");
  server.get("/config.json", (_req, res) => {
    res.json(webuiConfig);
  });

  if (config.hostWebUI) {
    if (!fs.existsSync(config.webUIPath)) {
      const msg = "Could not find web UI file path.";
      logger.fatal({ missingPath: config.webUIPath }, );
      throw new Error(msg + " (" + config.webUIPath + ")");
    }

    logger.debug("Mounting static files for webui.");
    server.use("/", express.static(path.resolve(config.webUIPath)));
  }

  logger.debug("Attaching error middleware.");
  server.use(Middleware.buildErrorLoggingMiddleware(logger));

  logger.debug({ port: config.port }, `Listening on port ${config.port}.`);
  server.listen(config.port);
}
