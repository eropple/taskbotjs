#! /usr/bin/env node

// Simple script for bumping versions. All our packages are _always_ kept in
// sync, i.e. a bug in the client implies a bump in server version as well just
// to offer a really simple story for upgrades; "keep the client version at or
// behind the service's version". Because of this guarantee, we can thus just
// walk from the workspace root on up, changing versions, and updating the
// versions of packages in the monorepo to the new version.

const _ = require("lodash");

const path = require("path");
const fsx = require("fs-extra");

const program = require("commander");
const { format } = require("prettier-package-json");

const buildRoot = path.resolve(__dirname);
const root = path.resolve(path.dirname(buildRoot));

program
  .option("--dry-run", "prints out any changes that would be made")
  .option("--set-version <version>", "the version to set")
  .parse(process.argv);

if (!program.setVersion) {
  console.error("!!! --set-version is required.");
  process.exit(1);
}

const newVersion = program.setVersion;

const dryRun = !!(program.dryRun);
if (dryRun) {
  console.log("- Dry run enabled.");
}

console.log(`- root: ${root}`);

const workspacePackagePath = `${root}/package.json`;
const workspacePackage = require(workspacePackagePath);
console.log(`- current workspace version: ${workspacePackage.version}`);

workspacePackage.version = newVersion;
console.log(`- workspace: set version to ${workspacePackage.version}`);
if (!dryRun) {
  fsx.writeFileSync(workspacePackagePath, format(workspacePackage));
}

const childDirectories = _.concat(workspacePackage.workspaces, workspacePackage.workspacesAdjacent);
const childPackageNames = childDirectories.map((cd) => fsx.readJSONSync(`${root}/${cd}/package.json`).name);

childDirectories.forEach((cd) => {
  const childRoot = `${root}/${cd}`;
  console.log(`- entering ${cd}: ${childRoot}`);

  const childPackagePath = `${childRoot}/package.json`;
  const childPackage = fsx.readJSONSync(childPackagePath);
  childPackage.version = newVersion;
  console.log(`- ${cd}: set version to ${childPackage.version}`);

  childPackageNames.forEach((cp) => {
    if (childPackage.dependencies[cp]) {
      childPackage.dependencies[cp] = newVersion;
      console.log(`- ${cd}: updated sibling ${cp} to ${newVersion}`);
    }
  });

  if (!dryRun) {
    fsx.writeFileSync(childPackagePath, format(childPackage))
  }

  console.log(`- exiting ${cd}`);
});

