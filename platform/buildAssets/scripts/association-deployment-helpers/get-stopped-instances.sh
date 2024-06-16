#!/bin/bash

# Check if the region is provided as a parameter
if [ -z "$1" ]; then
  echo "Usage: $0 <aws_region>"
  exit 1
fi

# Specify the output file path
output_file="stopped_instance_ids.txt"

# Use the AWS CLI to describe instances and filter by state
aws ec2 describe-instances --query 'Reservations[*].Instances[?State.Name==`stopped`].[InstanceId]' --region $1 --output text > "$output_file"

echo "Stopped EC2 Instance IDs have been written to $output_file"

