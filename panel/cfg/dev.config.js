const Bunyan = require("bunyan");
const BunyanPrettyStream = require("bunyan-prettystream-circularsafe");

const { PanelConfig } = require("../dist");

// If this config were TypeScript, it'd be `Config<NoDeps>`; all jobs _should_
// (though, technically, do not have to) expect the same generic subtype of
// `IDependencies` and the `Config` class should use the same one. This is not
// checked at runtime, because we can't really do that, but it allows the
// TypeScript compiler to provide dependency resolution for your editor and
// help make sure that your jobs like up wih what theserver will provide.
const config = new PanelConfig();
config.redis = {
  options: {
    url: "redis://localhost:18377",
    prefix: "ex/"
  }
};

config.hostWebUI = false;

config.logger = Bunyan.createLogger({
  name: "taskbotjs-panel",
  level: "info",
  streams: [
    { // comfy development output
      type: 'raw',
      level: "debug",
      stream: (() => {
        const prettyStream = new BunyanPrettyStream();
        prettyStream.pipe(process.stderr);

        return prettyStream;
      })()
    },
    // { // this is what we recommend for production!
    //   stream: process.stderr,
    //   level: "info"
    // }
  ]
});

module.exports = config;
