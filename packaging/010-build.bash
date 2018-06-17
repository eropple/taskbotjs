#! /bin/bash
# Builds all packages for TaskBotJS and then places them in a folder to be used by later steps of the process.

BUILD_ROOT=$(realpath $(dirname $0))
ROOT=$(realpath $(dirname "$BUILD_ROOT"))
ARTIFACT_DIR="$BUILD_ROOT/_artifacts"

mkdir -p "$ARTIFACT_DIR"

cd "$ROOT"
yarn install

cd "$ROOT/webui"
yarn install

for package in client service webapi panel example; do
  cd "$ROOT/$package"
  yarn pack -f "$ARTIFACT_DIR/${package}.tgz"
done
