locals { timestamp = regex_replace(timestamp(), "[- TZ:]", "") }

source "amazon-ebs" "uob-server-foundation" {
  ami_name      = "uob-server-foundation-${local.timestamp}"
  instance_type = "t2.large"
  region        = "us-east-1"
  source_ami    = "ami-0f095f89ae15be883"
  ssh_username  = "ec2-user"
  vpc_id        = "vpc-080685433ce7e2909"
  subnet_id     = "subnet-0b750896d86fccd2f"
  ami_org_arns  = ["arn:aws:organizations::446554332519:organization/o-q4ohcirjpy"]
  tags =  {
    Name = "UOB Server Foundation"
  }

  assume_role {
        role_arn     =  "arn:aws:iam::207348267374:role/AWSControlTowerExecution"
        session_name =  "PackerBuild"
        external_id  =  "PackerBuild"
    }
}

source "amazon-ebs" "uob-ansible-controller" {
  ami_name      = "uob-ansible-controller-${local.timestamp}"
  instance_type = "t2.large"
  region        = "us-east-1"
  source_ami    = "ami-0f095f89ae15be883"
  ssh_username  = "ec2-user"
  vpc_id        = "vpc-080685433ce7e2909"
  subnet_id     = "subnet-0b750896d86fccd2f"
  ami_org_arns  = ["arn:aws:organizations::446554332519:organization/o-q4ohcirjpy"]
  tags =  {
    Name = "UOB Ansible Controller"
  }

  assume_role {
        role_arn     =  "arn:aws:iam::207348267374:role/AWSControlTowerExecution"
        session_name =  "PackerBuild"
        external_id  =  "PackerBuild"
    }
}

build {
  sources = [
    "source.amazon-ebs.uob-server-foundation",
    "source.amazon-ebs.uob-ansible-controller"
  ]

  provisioner "shell" {
    script = "./uob-servers/shared-packages.sh"
  }

  provisioner "shell" {
    script = "./uob-servers/base-setup.sh"
  }

  provisioner "shell" {
    script = "./uob-servers/datadog-setup.sh"
  }

  provisioner "shell" {
    only = ["amazon-ebs.uob-ansible-server"]
    script = "./uob-servers/ansible-setup.sh"
  }

  post-processors {
    post-processor "manifest" {
      output = "manifest.json"
    }
  }
}