#! /usr/bin/env node

/**
 * @jsjobs/panel exists to wrap up @jsjobs/webapi and @jsjobs/webui into a
 * single deployable that can be served straight out of NPM.
 *
 * webapi is a direct dependency, and so typescript handles packing that into
 * the release. However, webui is a React app and is just built into the
 * release, so we need to generate a build and stash it in the correct place
 * before we go any further.
 */

const path = require("path");
const childProcess = require("child_process");
const fs = require("fs");
const shelljs = require("shelljs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WEBUI_ROOT = path.resolve(path.dirname(PROJECT_ROOT), "webui");
console.log(`Building for ${PROJECT_ROOT} (${WEBUI_ROOT})`);

process.chdir(WEBUI_ROOT);
console.log("- yarn build");
childProcess.execSync("yarn build");

process.chdir(PROJECT_ROOT);
shelljs.mv(`${WEBUI_ROOT}/build`, `${PROJECT_ROOT}/webui_files`);
