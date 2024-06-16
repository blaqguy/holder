terraform {
  backend "s3" {
    bucket       = "dragonflyft-tf-state"
    external_id  = "state-admin"
    key          = "athena-billing-project/state"
    region       = "us-east-1" # Replace with your desired region
    role_arn     = "arn:aws:iam::446554332519:role/dragonflyft-state-admin"
    session_name = "terraformer-stating"
  }
}
