
/******************************************************************************
* Data
*/

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_partition" "current" {}

data "aws_iam_policy_document" "crawler_assume_permission" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["glue.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "crawler_iam_policy" {
  statement {
    sid = "S3DecryptPermission"

    effect = "Allow"

    actions = [
      "kms:Decrypt"
    ]
    resources = [
      "*"
    ]
  }

  statement {
    sid = "GluePermission"

    effect = "Allow"

    actions = [
      "glue:ImportCatalogToGlue",
      "glue:GetDatabase",
      "glue:UpdateDatabase",
      "glue:CreateTable",
      "glue:UpdateTable",
      "glue:UpdatePartition"
    ]

    resources = [
      aws_glue_catalog_database.cost_and_usage_report_db.arn,
      "arn:${data.aws_partition.current.partition}:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:catalog",
      "arn:${data.aws_partition.current.partition}:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${aws_glue_catalog_database.cost_and_usage_report_db.name}/*",
    ]
  }

  statement {
    sid = "CloudWatchPermission"

    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:CreateLogGroup",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:${data.aws_partition.current.partition}:logs:*:*:*"
    ]
  }

  statement {
    sid = "S3Permission"

    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]

    resources = [
      "${aws_s3_bucket.cur_s3_bucket.arn}",
      "${aws_s3_bucket.cur_s3_bucket.arn}/*",
    ]
  }
}

data "aws_iam_policy" "glue_service_role_policy" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

data "archive_file" "cur_initializer_lambda_code" {
  type        = "zip"
  source_dir  = "${path.module}/source"
  output_path = "${var.crawler_lambda_name}.zip"
}

data "aws_iam_policy_document" "crawler_lambda_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "crawler_lambda_policy" {
  statement {
    sid    = "CloudWatch"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:CreateLogGroup",
    ]
    resources = ["${aws_cloudwatch_log_group.default.arn}:*"]
  }

  statement {
    sid    = "Glue"
    effect = "Allow"
    actions = [
      "glue:StartCrawler",
    ]
    resources = ["*"]
  }
}

/******************************************************************************
* Resources
*/

resource "aws_s3_bucket" "cur_s3_bucket" {
  bucket        = local.cur_s3_bucket_name
  force_destroy = true
}

resource "aws_s3_bucket_policy" "cur_s3_bucket_policy" {
  bucket = aws_s3_bucket.cur_s3_bucket.id

  policy = jsonencode(
    {
      "Version" : "2008-10-17",
      "Id" : "CurBucketPolicy",
      "Statement" : [
        {
          "Sid" : "get",
          "Effect" : "Allow",
          "Principal" : {
            "Service" : "billingreports.amazonaws.com"
          },
          "Action" : [
            "s3:GetBucketAcl",
            "s3:GetBucketPolicy"
          ],
          "Resource" : "${aws_s3_bucket.cur_s3_bucket.arn}"
        },
        {
          "Sid" : "put",
          "Effect" : "Allow",
          "Principal" : {
            "Service" : "billingreports.amazonaws.com"
          },
          "Action" : "s3:PutObject",
          "Resource" : "${aws_s3_bucket.cur_s3_bucket.arn}/*"
        }
      ]
    }
  )
}

// resource "aws_cur_report_definition" "cost_and_usage_report" {
//   provider                   = aws.us-east-1
//   report_name                = var.cur_report_name
//   time_unit                  = var.time_unit
//   format                     = "Parquet"
//   compression                = "Parquet"
//   additional_schema_elements = ["RESOURCES"]
//   s3_bucket                  = aws_s3_bucket.cur_s3_bucket.id
//   s3_region                  = data.aws_region.current.name
//   additional_artifacts       = ["ATHENA"]
//   s3_prefix                  = var.cur_s3_bucket_prefix
//   report_versioning          = "OVERWRITE_REPORT"
// }

resource "aws_cur_report_definition" "cost_and_usage_report" {
  report_name                = var.cur_report_name
  time_unit                  = var.time_unit
  format                     = "Parquet"
  compression                = "Parquet"
  additional_schema_elements = ["RESOURCES"]
  s3_bucket                  = aws_s3_bucket.cur_s3_bucket.id
  s3_region                  = data.aws_region.current.name
  additional_artifacts       = ["ATHENA"]
  s3_prefix                  = var.cur_s3_bucket_prefix
  report_versioning          = "OVERWRITE_REPORT"
}

resource "aws_glue_crawler" "cost_and_usage_report_crawler" {
  name          = "${var.cur_report_name}-crawler"
  database_name = aws_glue_catalog_database.cost_and_usage_report_db.name
  role          = aws_iam_role.crawler_role.name

  s3_target {
    path = "s3://${aws_s3_bucket.cur_s3_bucket.id}/${var.cur_s3_bucket_prefix}/${var.cur_report_name}/${var.cur_report_name}"
    exclusions = [
      "**.json",
      "**.yml",
      "**.sql",
      "**.csv",
      "**.gz",
      "**.zip",
    ]
  }
  schema_change_policy {
    delete_behavior = "DELETE_FROM_DATABASE"
    update_behavior = "UPDATE_IN_DATABASE"
  }
}

resource "aws_iam_role" "crawler_role" {
  name               = "${var.cur_report_name}-crawler-role"
  assume_role_policy = data.aws_iam_policy_document.crawler_assume_permission.json
}

resource "aws_iam_role_policy_attachment" "glue_service_role_policy_attach" {
  policy_arn = data.aws_iam_policy.glue_service_role_policy.arn
  role       = aws_iam_role.crawler_role.name
}

resource "aws_iam_role_policy" "crawler" {
  name   = "${var.cur_report_name}-crawler-policy"
  role   = aws_iam_role.crawler_role.name
  policy = data.aws_iam_policy_document.crawler_iam_policy.json
}

resource "aws_glue_catalog_database" "cost_and_usage_report_db" {
  name        = lower("${var.cur_report_name}-db")
  description = "Contains CUR data based on contents from the S3 bucket '${local.cur_s3_bucket_name}'"
}

resource "aws_glue_catalog_table" "cur_report_status_table" {
  name          = "cost_and_usage_data_status"
  database_name = aws_glue_catalog_database.cost_and_usage_report_db.name
  table_type    = "EXTERNAL_TABLE"

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.cur_s3_bucket.id}/${var.cur_s3_bucket_prefix}/${var.cur_report_name}/cost_and_usage_data_status/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
    columns {
      name = "status"
      type = "string"
    }
  }
  depends_on = [aws_glue_catalog_database.cost_and_usage_report_db]
  lifecycle {
    ignore_changes = [
      parameters,
    ]
  }
}

resource "aws_cloudwatch_log_group" "default" {
  name              = "/aws/lambda/${var.crawler_lambda_name}"
  retention_in_days = 90
}

resource "aws_lambda_permission" "allow_s3_bucket" {
  statement_id   = "AllowS3ToInvokeLambda"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.cur_initializer.function_name
  source_account = data.aws_caller_identity.current.account_id
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.cur_s3_bucket.arn
}

resource "aws_iam_role" "cur_initializer_lambda_executor" {
  name               = "${var.cur_report_name}-lambda-executor"
  assume_role_policy = data.aws_iam_policy_document.crawler_lambda_assume.json
}

resource "aws_iam_role_policy" "crawler_policy" {
  name   = "${var.cur_report_name}-lambda-executor-policy"
  role   = aws_iam_role.cur_initializer_lambda_executor.name
  policy = data.aws_iam_policy_document.crawler_lambda_policy.json
}

resource "aws_lambda_function" "cur_initializer" {
  function_name                  = var.crawler_lambda_name
  filename                       = "${var.crawler_lambda_name}.zip"
  handler                        = "${var.crawler_lambda_name}.lambda_handler"
  runtime                        = "python3.9"
  reserved_concurrent_executions = 1
  role                           = aws_iam_role.cur_initializer_lambda_executor.arn
  timeout                        = 30
  source_code_hash               = data.archive_file.cur_initializer_lambda_code.output_base64sha256
  environment {
    variables = {
      CRAWLER_NAME = "${aws_glue_crawler.cost_and_usage_report_crawler.name}"
    }
  }
  depends_on = [aws_cloudwatch_log_group.default]
}

resource "aws_s3_bucket_notification" "cur_initializer_lambda_trigger" {
  bucket = aws_s3_bucket.cur_s3_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.cur_initializer.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "${var.cur_s3_bucket_prefix}/${var.cur_report_name}/"
    filter_suffix       = ".parquet"
  }

  depends_on = [
    aws_lambda_permission.allow_s3_bucket,
    aws_s3_bucket_policy.cur_s3_bucket_policy,
  ]
}