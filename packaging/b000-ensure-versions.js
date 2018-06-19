#! /usr/bin/env node

const packages = [
  "client",
  "service",
  "webapi",
  "webui",
  "example",
  "panel"
];

const workspaceVersion = require("../package.json").version;
const unmatchedVersions = packages.filter((package) =>
  require(`../${package}/package.json`).version !== workspaceVersion);

if (unmatchedVersions.length > 0) {
  console.log("!!! version mismatches with workspace root:");

  unmatchedVersions.forEach((package) => console.log(`- ${package}`));
  process.exit(1);
}

process.exit(0);
