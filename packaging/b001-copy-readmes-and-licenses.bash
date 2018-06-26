#! /usr/bin/env bash

BUILD_ROOT=$(realpath $(dirname $0))
ROOT=$(dirname $BUILD_ROOT)

for package in client service webapi panel example; do
  for file in LICENSE.md CODE-OF-CONDUCT.md README.md RELEASE_NOTES.md; do
    cp "$ROOT/$file" "$ROOT/$package"
  done
done
