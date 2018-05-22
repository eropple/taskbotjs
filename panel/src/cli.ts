import fs from "fs-extra-promise";
import path from "path";

import Bunyan from "bunyan";
import program from "commander";

import { PanelConfig } from "./PanelConfig";
import { runServer } from "./PanelServer";

const packageJson = fs.readJsonSync(`${__dirname}/../../package.json`);

export function start(args: string[]) {
  program
    .version(packageJson.version)
    .option("-c, --config-file <path>", "path to the JSJobs Panel config file")
    .parse(args);

  if (!program.configFile) {
    console.error("--config-file is required.");
    process.exit(1);
  }

  const config = require(path.resolve(program.configFile));

  if (!(config instanceof PanelConfig)) {
    console.error("The config file must export a PanelConfig object.");
    process.exit(1);
  } else {
    runServer(config);
  }
}
