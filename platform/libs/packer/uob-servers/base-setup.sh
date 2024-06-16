#!/bin/bash

# How to genericize this for any FIName?
sudo useradd usmod
sudo useradd acmod
sudo useradd ihsadmin
sudo useradd mqm

sudo useradd ansiusr

sudo groupadd gpmod
sudo groupadd ihsgroup

sudo usermod -aG wheel usmod
sudo usermod -aG wheel ansiusr

sudo usermod -aG gpmod usmod
sudo usermod -aG gpmod acmod

sudo usermod -aG ihsgroup ihsadmin

# These are probably mounted filesystems
sudo mkdir /depot
sudo mkdir -p /data/fimod
sudo mkdir -p /platform/fimod
sudo mkdir -p /shares/fimod

sudo mkdir -p /platform/svcs/microservices
sudo mkdir -p /platform/fimod/ansible/scripts