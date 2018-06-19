#! /bin/bash
# builds the base docker image used by service aspects.

set -eo pipefail

BUILD_ROOT=$(realpath $(dirname $0))
PRODUCT=taskbotjs
VERSION=$(jq -r .version "$BUILD_ROOT/../package.json")

docker build \
  --tag "$PRODUCT:$VERSION" \
  --tag "$PRODUCT:latest" \
  --file "$BUILD_ROOT/base.Dockerfile" \
  .
