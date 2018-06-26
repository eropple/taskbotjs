#! /usr/bin/env bash

set -eo pipefail

cd _artifacts
npm publish client.tgz --access public
npm publish service.tgz --access public
npm publish webapi.tgz --access public
npm publish panel.tgz --access public
npm publish example.tgz --access public
