import {
  ClientMiddlewareFunction,
  ClientMiddlewarePhase
} from "@taskbotjs/client";

/**
 * This middleware is an example of how one can write a middleware
 * that filters jobs in TaskBotJS. What this middleware effectively
 * does is count the number of times the job writes out an update to
 * the job; writes increment the "x.writeCount" field on the job
 * descriptor.
 */
export const exampleClientMiddleware: ClientMiddlewareFunction =
  async (phase, jd, logger, client) => {
    switch (phase) {
      case ClientMiddlewarePhase.READ:
        jd.x.writeCount = jd.x.writeCount || 1;
        logger.trace({ jobId: jd.id, jobWriteCount: jd.x.writeCount }, "I'm reading a job!");
      break;
      case ClientMiddlewarePhase.WRITE:
        jd.x.writeCount = (jd.x.writeCount || 0) + 1;
        logger.trace({ jobId: jd.id, jobWriteCount: jd.x.writeCount }, "I'm writing a job!");
      break;
    }

    return true;
  };
