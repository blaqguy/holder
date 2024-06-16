#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <aws_region>"
    exit 1
fi

# Specify the file containing stopped instance IDs
input_file="stopped_instance_ids.txt"

# Check if the file exists
if [ ! -f "$input_file" ]; then
  echo "File $input_file not found."
  exit 1
fi

# Read instance IDs from the file and stop each instance
while IFS= read -r instance_id; do
  if [ -n "$instance_id" ]; then
    aws ec2 stop-instances --instance-ids "$instance_id" --region $1
    echo "Stopping EC2 instance: $instance_id"
  fi
done < "$input_file"

echo "Instances from $input_file have been stopped."

