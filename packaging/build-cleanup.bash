#! /usr/bin/env bash
BUILD_ROOT=$(dirname $0)
PRODUCT=taskbotjs
VERSION=$(jq -r .version "$BUILD_ROOT/../package.json")

echo "- cleaning up"

docker-compose kill
docker-compose rm --force

docker rmi ${PRODUCT}:latest || true
docker rmi ${PRODUCT}:${VERSION} || true
