# Locals

locals {
  cur_s3_bucket_name = "${var.cur_s3_bucket_name_prefix}-${data.aws_region.current.name}-${data.aws_caller_identity.current.account_id}"
}