# Backup Policies Strategy and Implementation

There's several components that need to align before AWS Oraganizations will start managing backups in target accounts.

## DfBackupPolicyConstruct

This construct is used to create the AWS Organizations backup policies. It also attaches them to the specified organizational unit (OU) or account. Use this construct to create any new backup policies. The construct supports creating policies at the OU or account level by using the `targetType` property.

## DfBackupPoliciesStack

This stack is responsible for creating backup policies in the AWS Organizations management account using DfBackupPolicyConstruct. This is where all Backup policies are to be managed. Once they are created and attached to an OU or account, AWS Organizations will handle creating the backup plans in the target accounts.

## DfBackupResourcesStack

This stack is responsible for creating the resources AWS Organizations needs to exist in target accounts to manage backups. The resources are the Backup Vaults where the backups are placed and the IAM role used to create the backups. Backups will not be performed successfully is these resources do not exist.

## Adding new policies

To add a new policy, simply add another instantiation of DfBackupPolicyConstruct to DfBackupPoliciesStack, then deploy the stack to the master account. You need to add the correct tags to the resources you want to be managed by the backup policy.

## Adding tags

To map resources to a backup policy, add the `backup-policy` tag to the resource and set the value to the name of the backup policy. At the time of writing, the EC2, EFS, and RDS constructs support passing in a backup policy tag. The name of the policy is dynamically created based on the configuration of the policy.

## DfBackupServiceRole

A customer-managed role must be deployed to every account containing backups. Update the roles permissions as new requirements come up. As of writing, it has permissions to create backups of EC2, EFS, and RDS.

## Restoring from backup

Select `DfBackupServiceRole` for the restore role when restoring from a backup.

If you recieve an encoded error message during the restore, use the following command to decode it.
`aws sts decode-authorization-message --encoded-message (encoded error message) --query DecodedMessage --output text | jq '.'`
