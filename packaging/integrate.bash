#! /usr/bin/env bash
RET=0

BUILD_ROOT=$(dirname $0)
cd $BUILD_ROOT

for f in $(ls 0*.{js,bash}); do
  ./${f}
  SCRIPT_CODE=$?
  if [[ $SCRIPT_CODE -ne 0 ]]; then
    echo " - ${f}"
    echo "!! ${f} failed."

    RET=$SCRIPT_CODE
    break
  fi
done

if [[ $NO_CLEANUP -ne 1 ]]; then
  ./cleanup.bash
fi

exit $RET
