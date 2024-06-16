#!/bin/bash
# builds the platform project with all configs one at a time and runs `cdktf synth` on each

configs=($(cat apps/platform/project.json | jq -c '.targets.build.configurations|keys' | sed 's/,/ /g' | sed 's/[[]//g' | sed 's/[]]//g'))

echo "----------------------------------------------------------------------"
echo "Found the following nx configs in apps/platform/project.json:"
echo ${configs[@]}
echo "----------------------------------------------------------------------"

for config in ${configs[@]}; do
  echo
  echo "----------------------------------------------------------------------"
  echo "Beginning nx build and cdkft synth with $config config"
  echo "----------------------------------------------------------------------"
  echo

  nx run platform:build:$config
  exitCodes+=($?)

# Adding and setting this RETURN_DUMMY_SECRETS_DATA to true to pass fake SOPS secrets to the synth stage
  RETURN_DUMMY_SECRETS_DATA=true cdktf synth 
  exitCodes+=($?)

  echo
  echo "----------------------------------------------------------------------"
  echo "Completed nx build and cdkft synth with $config config"
  echo "----------------------------------------------------------------------"
  echo
done

for code in ${exitCodes[@]}; do
  if (("$code" > "0")); then
    echo
    echo "----------------------------------------------------------------------"
    echo "One or more commands exited with non-zero code. See output for details."
    echo "----------------------------------------------------------------------"
    echo
    exit 1
  fi
done

echo
echo "----------------------------------------------------------------------"
echo "All configurations built and synthed successfully."
echo "----------------------------------------------------------------------"
echo