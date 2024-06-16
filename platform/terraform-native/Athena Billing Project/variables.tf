# Variables

variable "cur_report_name" {
  description = "The name of the AWS Cost and Usage Report (CUR) to be generated."
}

variable "time_unit" {
  description = "The time granularity for which the CUR report is generated. Valid values are: DAILY, MONTHLY, or HOURLY."
}

variable "cur_s3_bucket_name_prefix" {
  description = "The prefix name for the S3 bucket where the CUR report will be stored."
  default     = "cur-report"
}

variable "cur_s3_bucket_prefix" {
  description = "The folder name within the S3 bucket where the CUR report will be stored."
}

variable "crawler_lambda_name" {
  description = "The name of the Lambda function responsible for triggering the crawler on S3 bucket updates."
  default     = "cur-crawler-initializer"
}