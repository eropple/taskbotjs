#! /usr/bin/env bash

BUILD_ROOT=$(realpath $(dirname $0))
PRODUCT=taskbotjs
VERSION=$(jq -r .version "$BUILD_ROOT/../package.json")

echo $VERSION | grep -- "-wip"
if [[ $? -eq 0 ]]; then
  echo "!!! Can't publish -wip versions ($VERSION)."
  exit 2
fi

TMPDIR=$(mktemp -d)

# returns as error code
RET=0

for package in $(ls -d $BUILD_ROOT/_artifacts/*.tgz); do
  package_filename=$(basename $package)
  package_name=$(basename -s '.tgz' $package)
  target_dir=$TMPDIR/$package_name

  mkdir $target_dir

  target_file=$target_dir/package.tgz
  cp $package $target_file

  cd $target_dir
  tar --strip-components=1 -xzf $target_file

  JS_PACKAGE_NAME=$(jq -r .name "$target_dir/package.json")
  JS_PACKAGE_VERSION=$(jq -r .version "$target_dir/package.json")

  if [[ $JS_PACKAGE_NAME != $PRODUCT ]]; then
    echo "!!! ${package_name}: bad JS_PACKAGE_NAME"
    RET=1
  fi

  if [[ $JS_PACKAGE_VERSION != $VERSION ]]; then
    echo "!!! ${package_name}: bad JS_PACKAGE_VERSION"
    RET=1
  fi
done

if [[ $RET -eq 0 ]]; then
  rm -rf $TMPDIR
fi


