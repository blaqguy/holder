FROM public.ecr.aws/amazonlinux/amazonlinux:2 as core

ENV NVM_DIR /usr/local/.nvm 
ENV NODE_VERSION  16.19.0
ENV NPM_VERSION  8.19.3
ENV TERRAFORM_VERSION 1.2.9
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN set -ex \
    && yum install -y \ 
    jq \
    make \
    python37 \
    tar \
    unzip \
    gzip \
    zip \
    && yum groupinstall -y "Development Tools" \
    && yum clean all -y

RUN set -ex \
    && curl https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip --output terraform.zip \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/ \
    && rm terraform.zip

RUN set -ex \
    && mkdir ${NVM_DIR} \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash \
    && chmod +x ${NVM_DIR}/nvm.sh \
    && [ -s "${NVM_DIR}/nvm.sh" ] \
    && . "${NVM_DIR}/nvm.sh" \
    && nvm install ${NODE_VERSION} \
    && nvm use ${NODE_VERSION} \
    && npm install -g npm@${NPM_VERSION}

RUN set -ex \
    && curl https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip \
    && unzip -q /tmp/awscliv2.zip -d /opt \
    && /opt/aws/install --update -i /usr/local/aws-cli -b /usr/local/bin \
    && rm /tmp/awscliv2.zip \
    && rm -rf /opt/aws \
    && aws --version

RUN npm install -g nx cdktf-cli

RUN pip3 install checkov

