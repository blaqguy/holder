FROM ubuntu:20.04

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  tzdata \
  git \
  unzip \
  curl \
  jq \
  gnupg \
  software-properties-common \ 
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --yes --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

RUN echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/hashicorp.list > /dev/null

# python, g++, and make are for building node binaries from source is no pre-built binary is available
RUN apt update && apt-get install -y terraform=1.8.2-* python3 g++ make python3-pip

RUN (type -p wget >/dev/null || (apt update && apt-get install wget -y)) \
  && mkdir -p -m 755 /etc/apt/keyrings \
  && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt update \
  && apt install gh -y

RUN mkdir /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 22.2.0

RUN curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash \
  && . $NVM_DIR/nvm.sh \
  && nvm install $NODE_VERSION \
  && nvm alias default $NODE_VERSION \
  && nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN npm install -g npm@10.7.0 nx@17 cdktf-cli@0.20.7

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
  && unzip awscliv2.zip \
  && ./aws/install

RUN addgroup runner && \
  adduser \
  --system \
  --disabled-password \
  --home /home/runner \
  --ingroup runner \
  runner

WORKDIR /home/runner

RUN GITHUB_RUNNER_VERSION=${GITHUB_RUNNER_VERSION:-$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/v//g')} \
  && curl -sSLO https://github.com/actions/runner/releases/download/v${GITHUB_RUNNER_VERSION}/actions-runner-linux-x64-${GITHUB_RUNNER_VERSION}.tar.gz \
  && tar -zxvf actions-runner-linux-x64-${GITHUB_RUNNER_VERSION}.tar.gz \
  && rm -f actions-runner-linux-x64-${GITHUB_RUNNER_VERSION}.tar.gz \
  && ./bin/installdependencies.sh \
  && chown -R runner:runner /home/runner

COPY entrypoint.sh entrypoint.sh

RUN ["chmod", "+x", "entrypoint.sh"]

USER runner

ENTRYPOINT ["./entrypoint.sh"]