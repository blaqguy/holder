#!/bin/bash

# Will run all the associations in a region that match "ansible-execution". 
# Export temp credentials from AWS SSO page for the environment you're trying to target.  
# --dry-run will just output the associations it would have triggered.

# Check for required argument
if [ $# -lt 1 ]; then
  echo "Usage: $0 <AWS_REGION> [--dry-run]"
  exit 1
fi

# Get AWS region from user argument
AWS_REGION=$1

# Check if dry run mode is enabled
DRY_RUN=false
if [ $# -eq 2 ] && [ "$2" == "--dry-run" ]; then
  DRY_RUN=true
fi

# Fetch list of SSM associations with "ansible-execution" in the AssociationName
associations=$(aws ssm list-associations \
  --region $AWS_REGION \
  --query "Associations[?contains(AssociationName, 'ansible-execution')].[AssociationId,AssociationName]" \
  --output json)

# Output the fetched association details
echo "SSM Associations with 'ansible-execution' in the AssociationName:"
echo "$associations" | jq -r '.[] | "\(.[1]) (Association ID: \(.[0]))"'

# Check if dry run mode is enabled
if $DRY_RUN; then
  echo "Dry run mode enabled. No associations will be initiated."
else
  # Extract association IDs for initiation
  association_ids=$(echo "$associations" | jq -r '.[][0]')
  
  if [ -n "$association_ids" ]; then
    echo "Initiating SSM associations..."
    
    # Convert space-separated IDs into an array
    id_array=($association_ids)
    
    # Initiate associations using start-associations-once
    batch_size=10
    current_batch=()
    
    for id in "${id_array[@]}"; do
      current_batch+=("$id")
      
      if [ ${#current_batch[@]} -eq $batch_size ]; then
        aws ssm start-associations-once \
          --region $AWS_REGION \
          --association-id "${current_batch[@]}"
        
        echo "Initiated associations for batch: ${current_batch[@]}"
        current_batch=()
      fi
    done
    
    # Initiate any remaining associations in the last batch
    if [ ${#current_batch[@]} -gt 0 ]; then
      aws ssm start-associations-once \
        --region $AWS_REGION \
        --association-id "${current_batch[@]}"
      
      echo "Initiated associations for remaining batch: ${current_batch[@]}"
    fi
    
  else
    echo "No associations found with 'ansible-execution' in the AssociationName."
  fi
fi
