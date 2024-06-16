import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import {
  DfPrivateInstanceConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { DfEfsConstruct } from '@dragonfly/constructs';
import { Utils } from '@dragonfly/utils';
import { Fn } from 'cdktf';

export interface DfNexusWorkStationStackConfig {
  spokeVpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  instanceType: string;
  keyPairName: string;
  nexusEfsConstruct: DfEfsConstruct;
}

/**
 *
 */
export class DfNexusWorkStationStack extends RemoteStack {
  private userData: string;

  /**
   *
   * @param {string} stackName
   * @param {StackConfig} stackConfig
   * @param {DfNexusWorkStationStackConfig} nexusConfig
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private nexusConfig: DfNexusWorkStationStackConfig
  ) {
    super(stackName, stackConfig);
    this.createWorkStation(stackName, nexusConfig);
  }

  /**
   * @param {string} stackName
   * @param {DfNexusWorkStationStackConfig} nexusConfig
   */
  private createWorkStation(
    stackName: string,
    nexusConfig: DfNexusWorkStationStackConfig
  ) {
    const cidrBlocksDupsRemoved = Fn.distinct([
      ...Utils.getIngressCidrBlocksByNetworkType(
        this.stackConfig.accountDefinition
      ),
      nexusConfig.spokeVpc.vpcCidrBlock,
    ]);
    const ec2SecurityGroup = new SecurityGroup(
      this,
      `${stackName}-EC2-SecurityGroup`,
      {
        name: stackName,
        description: `Security Group for ${stackName}`,
        vpcId: nexusConfig.spokeVpc.vpcId,
        ingress: [
          {
            fromPort: 22,
            toPort: 22,
            protocol: 'tcp',
            cidrBlocks: cidrBlocksDupsRemoved,
            description: `Allow SSH access for ${stackName}`,
          },
        ],
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow all outbound traffic',
          },
        ],
        tags: {
          Name: stackName,
        },
      }
    );

    const efsUserData = `#!/bin/bash
    sudo yum update -y

    #Install and mount for EFS
    sudo yum install -y amazon-efs-utils
    sudo mkdir /mnt/efs
    sudo mount -t efs -o tls ${nexusConfig.nexusEfsConstruct.efsId}:/ /mnt/efs
    
    #Install and start for amazon ssm agent
    sudo dnf install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm 
    systemctl start amazon-ssm-agent 
    systemctl enable amazon-ssm-agent`;

    DfPrivateInstanceConstruct.linuxInstanceFactory({
      scope: this,
      name: `${stackName}-instance`,
      constructProps: {
        vpc: nexusConfig.spokeVpc,
        accountDefinition: this.stackConfig.accountDefinition,
        instanceResourceConfig: {
          instanceType: nexusConfig.instanceType,
          keyName: nexusConfig.keyPairName,
          rootBlockDevice: {
            volumeSize: 250,
          },
          userData: efsUserData,
          tags: {
            hostname: stackName,
            'ansible-managed': 'true',
            application: stackName,
          }
        },
        options: {
          createKeyPair: true,
          securityGroup: {
            resource: ec2SecurityGroup,
          },
        },
      },
    });
  }
}
