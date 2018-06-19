#! /usr/bin/env bash
RET=0

BUILD_ROOT=$(dirname $0)
cd $BUILD_ROOT

for f in $(ls p???-*.{js,bash}); do
  ./${f}
  SCRIPT_CODE=$?
  if [[ $SCRIPT_CODE -ne 0 ]]; then
    echo " - ${f}"
    echo "!! ${f} failed."

    RET=$SCRIPT_CODE
    break
  fi
done

exit $RET
