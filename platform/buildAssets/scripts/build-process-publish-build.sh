#!/bin/bash
set -x

mkdir platform
cp cdktf.json platform/
cp package.json platform/
cp package-lock.json platform/

for fn in `cat builds.txt`; 
do 

  nx build platform -c $fn; 
  mv dist/ platform/

  cd platform
  npm pkg set name=@dragonfly-pst/$fn
  npm pkg delete private
  version=$(jq ".$fn" ../finalPackages/environmentVersions.json | tr -d '"')
  npm version $version
  npm publish
  cd ..

  rm -rf platform/dist

done