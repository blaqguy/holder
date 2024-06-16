#!/bin/bash
set -x

exitCodes+=0
for fn in `cat builds.txt`; 
do 

  echo "ENVIRONMENT: $fn" >> $1
  # Create final package for clarity
  mkdir finalPackages-$fn;

  environmentVersion=$(jq ".$fn" environmentVersions.json | tr -d '"');

  npm install @dragonfly-pst/$fn@$environmentVersion;

  cd node_modules/@dragonfly-pst/$fn;
  ls -ltr;

  # Runs our list
  cdktf list;
  exitCodes+=($?);

  # This file is used in sub bash script to know the stack names to iterate over
  cdktf deploy '*' --auto-approve;
  exitCodes+=($?);

  for code in ${exitCodes[@]}; do
    if (("$code" > "0")); then
      exit 1;
    fi
  done

  # Revert setup for next environment
  cd ../../..;
  mv node_modules/ finalPackages-$fn/node_modules_$fn; 

  ls -ltr;

done