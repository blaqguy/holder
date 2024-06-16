import { Constants } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { DfSsmCustomDocumentAnsibleAssociationConstruct } from '@dragonfly/constructs';

export class DfPlatformBaselineConfigManagementStack extends RemoteStack {
  constructor(id: string, stackConfig: StackConfig) {
    super(id, stackConfig);

    const props = [
      {
        provider: null,
        region: Constants.AWS_REGION_ALIASES.LEGACY,
      },
      {
        provider: this.primaryProvider,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      },
      {
        provider: this.recoveryProvider,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      },
    ];

    props.forEach(({ provider, region }) => {
      new DfSsmCustomDocumentAnsibleAssociationConstruct(
        this,
        `platform-baseline-ansible-${region.toLowerCase()}`,
        {
          provider: provider,
          associationName: 'platform-baseline-ansible-conda-venv',
          ssmDocumentDescription:
            'Custom document managed by DragonflyFT platform services team used to run Ansible playbooks in a virtual Python environment',
          playbookName: 'platform-baseline',
          targetType: 'tag',
          tagKey: 'ansible-playbook',
          tagValues: ['platform-baseline'],
          envName: this.stackConfig.envName,
          accountId: this.stackConfig.federatedAccountId,
          ansibleAssetsDir: 'platformBaselineCondaVenv',
          command: [
            '#!/bin/bash',
            'sudo yum -y install unzip wget',

            'echo "Checking if Conda is installed" ',
            'if [ ! -a ~/miniconda3/bin/conda ] ; then ',
            '    echo "Conda does not exist. Installing Conda now." ',
            '    mkdir -p ~/miniconda3 ',
            '    wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda3/miniconda.sh ',
            '    bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3 ',
            '    rm -rf ~/miniconda3/miniconda.sh ',
            '    ~/miniconda3/bin/conda init bash ',
            '    source ~/.bashrc ',
            'fi ',

            'echo "Checking if Conda virtual environment exists for Ansible" ',
            'if [ ! -d "~/miniconda3/envs/ansible" ] ; then ',
            '   echo "Conda virtual environment for Ansible does not exist. Creating it and installing dependencies now." ',
            '   conda create -n ansible python=3.12 -y ',
            '   ~/miniconda3/envs/ansible/bin/pip install ansible botocore boto3 ',
            'fi ',

            'echo "Activating Conda virtual environment for Ansible" ',
            'source ~/miniconda3/bin/activate ansible ',

            'echo "Clearing contents of ~/.ansible.cfg" ',
            '> ~/.ansible.cfg ',

            'echo "Adding interpreter_python variable to ~/.ansible.cfg" ',
            'echo "[defaults]" >> ~/.ansible.cfg ',
            'echo "interpreter_python = /root/miniconda3/envs/ansible/bin/python" >> ~/.ansible.cfg ',

            'echo "Installing Ansible Galaxy dependencies" ',
            'ansible-galaxy install newrelic.newrelic_install ',
            'unzip -o -q ansible.zip',
            'ansible-playbook -i "localhost," -c local -v ./playbooks/platform-baseline.yml',
          ],
        }
      );
    });
  }
}
