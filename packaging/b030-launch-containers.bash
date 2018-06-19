#! /bin/bash
# builds the base docker image used by service aspects.

set -eo pipefail

BUILD_ROOT=$(realpath $(dirname $0))
cd $BUILD_ROOT

docker-compose up -d
sleep 1
