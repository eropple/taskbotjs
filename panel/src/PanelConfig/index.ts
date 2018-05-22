import Bunyan from "bunyan";

import path from "path";

import {
  RedisClientOptions,
  PoolOptions,
  ClientPool,
  Client
} from "@jsjobs/client";

export interface RedisOptions {
  options: RedisClientOptions;
  pool: PoolOptions;
}

export class PanelConfig {
  /**
   * The Bunyan logger that should be used by the entire application.
   */
  logger: Bunyan = Bunyan.createLogger({ name: "jsjobs-panel" });

  /**
   * The HTTP port to listen on.
   */
  port: number = 14008;

  /**
   * The externally-accessible host for this service. For example, if the
   * service is behind a load balancer, you'd want to set these values to
   * whatever host/port/virtual domain would route to the service.
   */
  externalHttpBase: string = "http://localhost:14008";

  /**
   * Options for the Redis client powering the client connector.
   */
  redis?: RedisOptions;

  /**
   * If false, the webui will not be served. Most useful in development
   * mode, where create-react-app will serve the app on its own port, but
   * when the app needs an API against which it can query.
   */
  hostWebUI: boolean = true;

  /**
   * Path to the compiled HTML/JS bundle that acts as this application. Added
   * to the project during an external prerelease build step.
   */
  webUIPath: string = path.resolve(path.join(__dirname, "..", "..", "webui_files"));

  buildClientPool(): ClientPool {
    if (this.redis) {
      const min = 4;
      const max = 10;
      return Client.withRedisOptions(this.logger, this.redis.options, this.redis.pool, { min, max });
    } else {
      throw new Error("No client configuration found.");
    }
  }
}
