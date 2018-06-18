import * as fs from "fs-extra-promise";
import * as path from "path";

import program from "commander";

import { Config } from "../Config";
import { Server } from "../Server";

const packageJson = fs.readJsonSync(`${__dirname}/../../package.json`);

export async function start(args: string[]): Promise<void> {
  // return program
  //   .version(packageJson.version)
  //   .description("The best job queue for NodeJS.")
  //   .action((args, options, logger) => {
  //     console.log(args);
  //     console.log(options);
  //     console.log(logger);
  //   })
  //   .parse(process.argv);

  program
    .version(packageJson.version)
    .option("-c, --config-file <path>", "path to the TaskBotJS config file")
    .parse(args);

  if (!program.configFile) {
    console.error("--config-file is required.");
    process.exit(1);
  }

  const config = require(path.resolve(program.configFile));

  if (!(config instanceof Config)) {
    console.error("The config file must export a Config object.");
    process.exit(1);
  } else {
    const server = new Server(config);
    await server.start();
  }
}
