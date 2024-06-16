packer {
  required_plugins {
    amazon = {
      version = " >=1.0.0"
      source = "github.com/hashicorp/amazon"
    }
  }
}

data "amazon-parameterstore" "svn-ps" {
  name = "svnPassword"
  with_decryption = true
  assume_role {
      role_arn     =  "arn:aws:iam::207348267374:role/AWSControlTowerExecution"
      session_name =  "PackerBuild"
      external_id  =  "PackerBuild"
  }
}

locals {
  value   = data.amazon-parameterstore.svn-ps.value
}

source "amazon-ebs" "svn-platform-sandbox" {
  # Tightly coupled with name in the constants file
  ami_name = "svn-master-image"
  source_ami = "ami-0928cc4c76d523f42"
  instance_type = "t2.micro"
  region = "us-east-1"
  ssh_username = "ec2-user"
  vpc_id        = "vpc-080685433ce7e2909"
  subnet_id     = "subnet-0b750896d86fccd2f"
  ami_org_arns  = ["arn:aws:organizations::446554332519:organization/o-q4ohcirjpy"]
  tags =  {
    Name = "SVN Master Image"
  }

  assume_role {
      role_arn     =  "arn:aws:iam::207348267374:role/AWSControlTowerExecution"
      session_name =  "PackerBuild"
      external_id  =  "PackerBuild"
  }

}

build {
  sources = [
    "source.amazon-ebs.svn-platform-sandbox"
  ] 

  provisioner "shell" {
    script = "./svn-base-setup.sh"
    environment_vars = [
      "initialPassword=${local.value}"
    ]
    execute_command = "{{.Vars}} bash '{{.Path}}'"
  }
}