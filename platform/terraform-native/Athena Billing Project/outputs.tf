# Module outputs

output "s3_bucket_name" {
  description = "Name of the S3 bucket used for storing Cost and Usage Report (CUR) data. This bucket may be provisioned by this module or not."
  value       = aws_s3_bucket.cur_s3_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket used for storing Cost and Usage Report (CUR) data."
  value       = aws_s3_bucket.cur_s3_bucket.arn
}

output "report_name" {
  description = "Name of the provisioned Cost and Usage Report."
  value       = aws_cur_report_definition.cost_and_usage_report.report_name
}

output "crawler_initializer_lambda_arn" {
  description = "ARN of the Lambda function responsible for triggering the Glue Crawler when new Cost and Usage Report (CUR) data is uploaded into the S3 bucket."
  value       = aws_lambda_function.cur_initializer.arn
}

output "crawler_initializer_lambda_name" {
  description = "Name of the Lambda function responsible for triggering the Glue Crawler when new Cost and Usage Report (CUR) data is uploaded into the S3 bucket."
  value       = aws_lambda_function.cur_initializer.function_name
}

output "crawler_arn" {
  description = "ARN of the Glue Crawler responsible for populating the Catalog Database with new Cost and Usage Report (CUR) data."
  value       = aws_glue_crawler.cost_and_usage_report_crawler.arn
}

output "crawler_role_arn" {
  description = "ARN of the IAM role used by the Glue Crawler responsible for populating the Catalog Database with new Cost and Usage Report (CUR) data."
  value       = aws_iam_role.crawler_role.arn
}

output "glue_catalog_database_name" {
  description = "Name of the Glue Catalog Database that is populated with Cost and Usage Report (CUR) data."
  value       = aws_glue_catalog_database.cost_and_usage_report_db.name
}