#!/bin/bash
set -x

# Create status files here so all stacks in all envs exist in file output
cd plan-outputs
touch envScanStatus.json

# $1 = Prisma Access Key | $2 = Prisma Secret Key
for envDir in */; 
do 
  echo $envDir >> envScanStatus.json;
  cd $envDir
  pwd
  ls
  for planJsonFile in *; 
  do 
    echo $planJsonFile >> ../envScanStatus.json;
    # Check of HIGH will only check HIGH and CRITICAL, output will be shown in cli and stored as JSON format in scan_results.json
    checkov -f $planJsonFile -c HIGH -o cli -o json --output-file-path console,scan_results.json --bc-api-key $1::$2
    # Taking the summary section and URL and appending to final envScanStatus,json file
    jq '.summary' scan_results.json >> ../envScanStatus.json;
    jq '.url' scan_results.json >> ../envScanStatus.json;
  done;
  cd ..
done;

cat envScanStatus.json;