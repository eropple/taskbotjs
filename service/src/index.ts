export {
  Config
} from "./Config";

export {
  Server
} from "./Server";

export {
  ConstructableServerPlugin,
  ServerPlugin
} from "./Server/ServerPlugin";

export {
  ServerPoller
} from "./Server/ServerPoller";

export const FLAVOR = "oss";
export const VERSION = require("../package.json").version;
