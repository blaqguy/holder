#!/bin/bash

sudo DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=PREINSTALL DD_INSTALL_ONLY=true DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"