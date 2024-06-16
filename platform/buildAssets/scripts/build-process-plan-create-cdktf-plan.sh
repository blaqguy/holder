#!/bin/bash
set -x

# Create status files here so all stacks in all envs exist in file output
mkdir plan-outputs;
planOutputsPath=$(pwd)/plan-outputs

for env in `cat builds.txt`; 
do 
  # Create final package for clarity
  mkdir finalPackages-$env;
  mkdir $planOutputsPath/$env;
  ls -ltr;

  environmentVersion=$(jq ".$env" environmentVersions.json | tr -d '"');

  npm install @dragonfly-pst/$env@$environmentVersion;

  cd node_modules/@dragonfly-pst/$env;
  ls -ltr;

  # Runs our list
  cdktf list;
  cdktf list > $env-cdktf-list-output.txt; 

  # This file is used in sub bash script to know the stack names to iterate over
  ls cdktf.out/stacks > $env-stackNames.txt; 
  cat $env-stackNames.txt;
  for stackName in `cat $env-stackNames.txt`; 
  do 
    # Running cdktf plan
    cdktf plan $stackName > $stackName-plan.txt; 
    cat $stackName-plan.txt;

    # Creating Plan json output
    cd cdktf.out/stacks/$stackName
    terraform plan -out=tfplan.binary;
    terraform show -json tfplan.binary > $env-$stackName-tf-plan.json;
    mv $env-$stackName-tf-plan.json $planOutputsPath/$env/

    cd ../../..
    # Move output file to final package
    mv $stackName-plan.txt finalPackages-$env;
  done;
  
  # Revert setup for next environment
  cd ../../..;
  ls -ltr
  mv node_modules/ finalPackages-$env/node_modules_$env; 
done