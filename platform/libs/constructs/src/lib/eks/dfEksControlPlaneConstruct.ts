import { Construct } from 'constructs';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { Constants, Utils } from '@dragonfly/utils';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { EksNodeGroup } from '@cdktf/provider-aws/lib/eks-node-group';
import { DfSpokeVpcConstruct } from '../vpc';
import { EksCluster } from '@cdktf/provider-aws/lib/eks-cluster';

export interface EksControlPlaneConfig {
  vpc: DfSpokeVpcConstruct;
  clusterName: string;
  nodeGroupName: string;
}

/**
 * EKS Controle Plane Stack
 */
export class DfEksControlPlaneConstruct extends Construct {
  protected eksClusterTrustPolicyDoc: DataAwsIamPolicyDocument;
  protected eksNodeGroupTrustPolicyDoc: DataAwsIamPolicyDocument;
  protected eksClusterRole: IamRole;
  protected eksNodeGroupRole: IamRole;
  protected vpc: DfSpokeVpcConstruct;

  /**
   * @param {Construct} scope - Root CDK app
   * @param {EksControlPlaneConfig} config - The EKS config
   */
  constructor(scope: Construct, config: EksControlPlaneConfig) {
    super(scope, `eks-${config.clusterName}-${config.nodeGroupName}`);

    // Creates the EKS Cluster Policies and Roles
    this.eksClusterTrustPolicyDoc = Utils.createTrustPolicyDocument(
      this,
      Utils.createConstructResourceId('eks-cluster-trust-policy-doc'),
      ['eks.amazonaws.com']
    );

    this.eksClusterRole = new IamRole(this, 'eks-cluster-role', {
      name: Utils.createConstructResourceId(`eks-${config.clusterName}-role`),
      assumeRolePolicy: this.eksClusterTrustPolicyDoc.json,
    });

    new IamRolePolicyAttachment(
      this,
      Utils.createConstructResourceId('eks-role-policy-attachment'),
      {
        role: this.eksClusterRole.id,
        policyArn: Constants.INTEGRATION_ARN_AMAZON_EKS_CLUSTER_POLICY,
      }
    );

    // Creates the EKS Node Group Policies and Roles
    this.eksNodeGroupTrustPolicyDoc = Utils.createTrustPolicyDocument(
      this,
      Utils.createConstructResourceId('eks-node-group-trust-policy-doc'),
      ['ec2.amazonaws.com']
    );

    this.eksNodeGroupRole = new IamRole(this, 'eks-node-group-role', {
      name: Utils.createConstructResourceId(`eks-${config.nodeGroupName}-role`),
      assumeRolePolicy: this.eksNodeGroupTrustPolicyDoc.json,
    });

    const policiesToAttach: string[] = [
      Constants.INTEGRATION_ARN_AMAZON_EKS_WORKER_CLUSTER_POLICY,
      Constants.INTEGRATION_ARN_AMAZON_EC2_CONTAINER_REGISTRY_READ_ONLY,
      Constants.INTEGRATION_ARN_AMAZON_EKS_CNI_POLICY,
    ];

    policiesToAttach.forEach((policy) => {
      new IamRolePolicyAttachment(
        this,
        Utils.createConstructResourceId(
          `${policy.split('/')[1]}-policy-attachment`
        ),
        {
          role: this.eksNodeGroupRole.id,
          policyArn: policy,
        }
      );
    });

    new EksCluster(this, Utils.createConstructResourceId('eks-cluster'), {
      name: `${config.clusterName}`,
      roleArn: this.eksClusterRole.arn,
      vpcConfig: {
        subnetIds: config.vpc.appSubnetIds,
        endpointPublicAccess: false,
        endpointPrivateAccess: true,
      },
    });

    // Create EKS Node Group
    new EksNodeGroup(this, Utils.createConstructResourceId('eks-node-group'), {
      clusterName: `${config.clusterName}`,
      nodeGroupName: `${config.nodeGroupName}`,
      nodeRoleArn: this.eksNodeGroupRole.arn,
      subnetIds: config.vpc.appSubnetIds,
      scalingConfig: {
        desiredSize: 3,
        maxSize: 5,
        minSize: 3,
      },
    });
  }
}
