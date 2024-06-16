provider "aws" {
  assume_role {
      external_id = "provisioning"
      role_arn = "arn:aws:iam::446554332519:role/provision-role"
      session_name = "terraformer-terraforming"
    }
  region = "us-east-1"
}
