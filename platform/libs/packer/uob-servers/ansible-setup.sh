#!/bin/bash

sudo yum install -y ansible

python3 --version
ansible --version


sudo mkdir -p /data/ansible/playbooks

# Data is a filesystem
sudo mkdir -p /data