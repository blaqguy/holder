#!/bin/bash

sudo yum install -y python36
sudo yum install -y libselinux-python3
sudo yum install -y openssh
sudo yum install -y unzip
sudo yum install -y curl
sudo yum install -y rsync
sudo yum install -y java-1.8.0-openjdk
sudo yum install -y jq
sudo yum install -y ed

sudo yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm
sudo yum install -y nmon

sudo yum install -y ksh

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
