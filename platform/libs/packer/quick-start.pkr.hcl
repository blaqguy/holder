locals { timestamp = regex_replace(timestamp(), "[- TZ:]", "") }


source "amazon-ebs" "quick-start" {
  ami_name      = "packer-example ${local.timestamp}"
  instance_type = "t2.micro"
  region        = "us-east-1"
  source_ami    = "ami-af22d9b9"
  ssh_username  = "ubuntu"
  vpc_id = "vpc-053ff4af053e9cd1d"
  subnet_id = "subnet-0bb12279658182b73"
  assume_role {
        role_arn     =  "arn:aws:iam::207348267374:role/AWSControlTowerExecution"
        session_name =  "PackerBuild"
        external_id  =  "PackerBuild"
    }
}
build {
  sources = ["source.amazon-ebs.quick-start"]
}