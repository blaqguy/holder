#!/bin/bash

# Check RHEL version
if [ -f /etc/redhat-release ]; then
    VERSION=$(grep -oP '(?<=release )[0-9]+' /etc/redhat-release)
    
    if [ "$VERSION" == "7" ]; then
        # RHEL 7 installation steps
        sudo yum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm
        sudo systemctl start amazon-ssm-agent
        sudo systemctl enable amazon-ssm-agent

        sudo yum groupinstall -y "Development Tools"
        sudo yum install -y openssl-devel bzip2-devel libffi-devel
        sudo yum install wget
        cd /opt
        wget https://www.python.org/ftp/python/3.8.12/Python-3.8.15.tgz
        tar -xf Python-3.8.*.tgz
        cd Python-3.8.*/
        ./configure --enable-optimizations
        sudo make altinstall
        sudo ln -sf /usr/local/bin/python3.8 /usr/bin/python3
        python3 --version  # Verify Python version after installation
        python3 -m pip install --upgrade pip 
    elif [ "$VERSION" == "8" ]; then
        # RHEL 8 installation steps
        sudo dnf install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm
        sudo systemctl start amazon-ssm-agent
        sudo systemctl enable amazon-ssm-agent
    else
        echo "Unsupported RHEL version: $VERSION"
        exit 1
    fi
else
    echo "Cannot determine RHEL version. /etc/redhat-release not found."
    exit 1
fi
