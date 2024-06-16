#!/bin/bash

set +e

# Check if the platform_environment variable is provided
if [ -z "$1" ]; then
  echo "Error: platform_environment argument is missing."
  exit 1
fi

# Read the manifest.json file
manifest=$(cat cdktf.out/manifest.json | jq '{ stacks: (.stacks | with_entries(.value |= { dependencies })) }')

# Function to recursively get stack order
get_stack_order() {
    local stack=$1
    local dependencies=$(echo "$manifest" | jq -r ".stacks[\"$stack\"].dependencies[]")
    for dep in $dependencies; do
        get_stack_order "$dep"
    done
    echo "$stack"
}

# Get the list of stacks from the manifest using jq
stacks=$(echo "$manifest" | jq -r '.stacks | keys[]')

# Iterate over the stacks and get the deployment order
deployment_order=()
for stack in $stacks; do
    deployment_order+=($(get_stack_order "$stack"))
done

# Remove duplicates while preserving order using awk
final_order=($(echo "${deployment_order[@]}" | tr ' ' '\n' | awk '!visited[$0]++'))

# Filter the final order based on the platform_environment variable
platform_environment="$1"
filtered_order=()
for stack in "${final_order[@]}"; do
    if [[ "${stack,,}" == "${platform_environment,,}"* ]]; then
        terraform -chdir=cdktf.out/stacks/$stack init -input=false > /dev/null && \
        terraform -chdir=cdktf.out/stacks/$stack plan -detailed-exitcode -input=false -out=tfplan > /dev/null
        
        exitcode=$?
        if [ $exitcode -eq 2 ]; then
          echo "::group::PLAN $stack"
          terraform -chdir=cdktf.out/stacks/$stack show tfplan && rm cdktf.out/stacks/$stack/tfplan;
          echo "::endgroup::"
          filtered_order+=("$stack");
        elif [ $exitcode -eq 1 ]; then
          exit 1;
        fi
    fi
done

# Convert the filtered order to a space delimited string
output=$(IFS=' '; echo "${filtered_order[*]}")

# Print the final output as a JSON array of strings
echo "$output"

