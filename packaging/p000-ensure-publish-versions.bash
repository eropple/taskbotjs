#! /usr/bin/env bash

BUILD_ROOT=$(realpath $(dirname $0))
PRODUCT=taskbotjs
VERSION=$(jq -r .version "$BUILD_ROOT/../package.json")

TMPDIR=$(mktemp -d)

for package in $(ls -d $BUILD_ROOT/_artifacts/*.tgz); do
  package_filename=$(basename $package)
  package_name=$(basename -s '.tgz' $package)
  target_dir=$TMPDIR/$package_name

  mkdir $target_dir

  target_file=$target_dir/package.tgz
  cp $package $target_file

  cd $target_dir
  tar --strip-components=1 -xzf $target_file
  echo $target_file
done

# rm -rf $TMPDIR
