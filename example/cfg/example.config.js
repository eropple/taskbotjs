const Bunyan = require("bunyan");
const BunyanPrettyStream = require("bunyan-prettystream-circularsafe");

const { Config } = require("@taskbotjs/service");
const { NoDeps } = require("../dist/NoDeps");

const { PingJob } = require("../dist/jobs/PingJob");
const { PongJob } = require("../dist/jobs/PongJob");
const { FailJob } = require("../dist/jobs/FailJob");
const { FutureJob } = require("../dist/jobs/FutureJob");
const { ArgJob } = require("../dist/jobs/ArgJob");
const { LongJob } = require("../dist/jobs/LongJob");

// If this config were TypeScript, it'd be `Config<NoDeps>`; all jobs _should_
// (though, technically, do not have to) expect the same generic subtype of
// `IDependencies` and the `Config` class should use the same one. This is not
// checked at runtime, because we can't really do that, but it allows the
// TypeScript compiler to provide dependency resolution for your editor and
// help make sure that your jobs like up wih what theserver will provide.
const config = new Config();
config.redis = {
  options: {
    url: "redis://oss.dev.bot:6379",
    prefix: "ex/"
  }
};
config.intake = {
  type: "weighted",
  timeoutSeconds: 1,
  queues: [
    { name: "critical", weight: 5 },
    { name: "default", weight: 3 },
    { name: "low", weight: 2 }
  ]
};

config.dependencies = (baseLogger) => new NoDeps(baseLogger);

config.logger = Bunyan.createLogger({
  name: "consumer",
  // level: "trace", // everything you didn't actually want to know
  level: "debug", // less spam, includes implementation details
  // level: "info", // minimal what-you-need-to-know level
  streams: [
    // { // comfy development output
    //   type: 'raw',
    //   level: "debug",
    //   stream: (() => {
    //     const prettyStream = new BunyanPrettyStream();
    //     prettyStream.pipe(process.stderr);

    //     return prettyStream;
    //   })()
    // },
    { // this is what we recommend for production!
      stream: process.stderr,
      level: "info"
    }
  ]
});

config.register(PingJob, PongJob, FailJob, FutureJob, ArgJob, LongJob);

module.exports = config;
