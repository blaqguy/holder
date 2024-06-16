import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import {
  DfIamRoleConstruct,
  DfPrivateBucketConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
} from '@dragonfly/constructs';
import { Constants, Utils } from '@dragonfly/utils';
import { RemoteStack, StackConfig } from '../stacks';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { DataTerraformRemoteStateS3, S3BackendConfig, Token } from 'cdktf';
import { DmsReplicationInstance } from '@cdktf/provider-aws/lib/dms-replication-instance';
import { DmsReplicationSubnetGroup } from '@cdktf/provider-aws/lib/dms-replication-subnet-group';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';

export interface DmsConfig {
  instanceConfig: InstanceConfig[];
  transitInstanceConfig: InstanceConfig[];
  vpc: DfToolsVpcConstruct | DfSpokeVpcConstruct;
  networkInstanceS3BackendProps?: S3BackendConfig;
}

export interface InstanceConfig {
  instanceType: string;
  rootBlockVolumeSize: number;
}

/** */
export class DfDms extends RemoteStack {
  private static readonly STACK_NAME = 'DmsRolesStack';
  private definedAssumptionDocument: DataAwsIamPolicyDocument;
  private vpcRole: DfIamRoleConstruct;
  private cloudwatchRole: DfIamRoleConstruct;
  private dmsBucket: DfPrivateBucketConstruct;
  private premigrationRole: DfIamRoleConstruct;
  private replicationInstances: DmsReplicationInstance[];
  private dmsConfig: DmsConfig;

  /**
   *
   * @param {StackConfig} stackConfig
   * @param {DmsConfig} dmsConfig
   */
  constructor(protected stackConfig: StackConfig, dmsConfig: DmsConfig) {
    super(DfDms.STACK_NAME, stackConfig);
    this.dmsConfig = dmsConfig;
    this.replicationInstances = [];

    this.dmsBucket = new DfPrivateBucketConstruct(
      this,
      'dms-bucket-premigration-task',
      {
        bucketName: 'dms-bucket-premigration-task',
        keyProps: {
          name: 'dms-bucket-premigration-task-key',
          description: 'dms-bucket-premigration-task-key',
        },
      }
    );

    this.vpcRole = this.createVpcRole();
    this.cloudwatchRole = this.createCloudwatchRole();
    this.premigrationRole = this.createDmsPremigrationRole();
    this.createDmsInstances();
  }

  /**
   *
   */
  private createDmsInstances() {
    const dmsAccessForEndpoint = new IamRole(this, 'dms-access-for-endpoint', {
      assumeRolePolicy: Token.asString(this.dmsAssumptionDocument.json),
      name: 'dms-access-for-endpoint',
    });
    const dmsAccessForEndpointAmazonDmsRedshiftS3Role =
      new IamRolePolicyAttachment(
        this,
        'dms-access-for-endpoint-AmazonDMSRedshiftS3Role',
        {
          provider: this.primaryProvider,
          policyArn:
            'arn:aws:iam::aws:policy/service-role/AmazonDMSRedshiftS3Role',
          role: dmsAccessForEndpoint.name,
        }
      );

    // Creates DMS instances in the app subnet
    const replicationSubnetGroup = new DmsReplicationSubnetGroup(
      this,
      'dms-replication-subnet-group',
      {
        provider: this.primaryProvider,
        replicationSubnetGroupDescription:
          'Replication subnet group for subnet IDs',
        replicationSubnetGroupId: 'dms-replication-subnet-group-id',
        subnetIds: this.dmsConfig.vpc.appSubnetIds,
      }
    );

    this.dmsConfig.instanceConfig.forEach((instanceConfig, index) => {
      const replicationInstance = new DmsReplicationInstance(
        this,
        `replication-instance-${index}`,
        {
          provider: this.primaryProvider,
          allocatedStorage: instanceConfig.rootBlockVolumeSize,
          applyImmediately: true,
          autoMinorVersionUpgrade: true,
          dependsOn: [
            dmsAccessForEndpointAmazonDmsRedshiftS3Role,
            this.cloudwatchRole.role,
            this.vpcRole.role,
          ],
          multiAz: false,
          publiclyAccessible: false,
          replicationInstanceClass: instanceConfig.instanceType,
          replicationInstanceId: `dms-replication-instance-${index}`,
          replicationSubnetGroupId: replicationSubnetGroup.id,
        }
      );
      this.replicationInstances.push(replicationInstance);
    });

    // Creates DMS instances in the prod primary shared network transit subnet if the shared network backend is passed in
    if (this.dmsConfig.networkInstanceS3BackendProps) {
      const remoteStateSharedNetworkStack = new DataTerraformRemoteStateS3(
        this,
        `${DfDms.STACK_NAME}-remote-state-shared-network`,
        this.dmsConfig.networkInstanceS3BackendProps
      );

      const dmsSg = new SecurityGroup(this, 'dms-transit-replication-sg', {
        provider: this.primaryProvider,
        name: 'dms-transit-replication-sg',
        vpcId: remoteStateSharedNetworkStack.getString(
          Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_ID
        ),
        description: 'Security group for the prod primary transit subnet DMS',
        ingress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
          },
        ],
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
          },
        ],
      });
      const replicationTransitSubnetGroup = new DmsReplicationSubnetGroup(
        this,
        'dms-replication-transit-subnet-group',
        {
          provider: this.primaryProvider,
          replicationSubnetGroupDescription:
            'Replication subnet group for transit subnet IDs',
          replicationSubnetGroupId: 'dms-replication-transit-subnet-group-id',
          subnetIds: remoteStateSharedNetworkStack.getList(
            Constants.CROSS_STACK_OUTPUT_GATEWAY_VPC_CUSTOMER_EDGE_SUBNET_IDS
          ),
        }
      );

      this.dmsConfig.transitInstanceConfig.forEach((instanceConfig, index) => {
        new DmsReplicationInstance(
          this,
          `replication-transit-subnet-instance-${index}`,
          {
            provider: this.primaryProvider,
            allocatedStorage: instanceConfig.rootBlockVolumeSize,
            applyImmediately: true,
            autoMinorVersionUpgrade: true,
            dependsOn: [
              dmsAccessForEndpointAmazonDmsRedshiftS3Role,
              this.cloudwatchRole.role,
              this.vpcRole.role,
            ],
            multiAz: false,
            publiclyAccessible: false,
            replicationInstanceClass: instanceConfig.instanceType,
            replicationInstanceId: `dms-replication-transit-subnet-instance-${index}`,
            replicationSubnetGroupId: replicationTransitSubnetGroup.id,
            vpcSecurityGroupIds: [dmsSg.id],
          }
        );
      });
    }
  }

  /**
   *
   * @return {DfIamRoleConstruct}
   */
  private createVpcRole() {
    return new DfIamRoleConstruct(this, {
      roleName: 'dms-vpc-role',
      assumptionDocument: this.dmsAssumptionDocument,
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(
          this,
          Utils.createStackResourceId(
            this.stackUuid,
            'dms-vpc-role-permissions-doc'
          ),
          {
            statement: [
              {
                effect: 'Allow',
                actions: [
                  'ec2:CreateNetworkInterface',
                  'ec2:DescribeAvailabilityZones',
                  'ec2:DescribeInternetGateways',
                  'ec2:DescribeSecurityGroups',
                  'ec2:DescribeSubnets',
                  'ec2:DescribeVpcs',
                  'ec2:DeleteNetworkInterface',
                  'ec2:ModifyNetworkInterfaceAttribute',
                ],
                resources: ['*'],
              },
            ],
          }
        ),
      ],
    });
  }

  /**
   *
   * @return {DfIamRoleConstruct}
   */
  private createCloudwatchRole() {
    return new DfIamRoleConstruct(this, {
      roleName: 'dms-cloudwatch-logs-role',
      assumptionDocument: this.dmsAssumptionDocument,
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(
          this,
          Utils.createStackResourceId(
            this.stackUuid,
            'dms-cloudwatch-logs-role-permissions-doc'
          ),
          {
            statement: [
              {
                effect: 'Allow',
                actions: ['logs:DescribeLogGroups'],
                resources: ['*'],
              },
              {
                effect: 'Allow',
                actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
                resources: ['arn:aws:logs:*:*:log-group:dms-tasks-*'],
              },
              {
                effect: 'Allow',
                actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                resources: [
                  'arn:aws:logs:*:*:log-group:dms-tasks-*:log-stream:dms-task-*',
                ],
              },
            ],
          }
        ),
      ],
    });
  }

  /**
   *
   * @return {DfIamRoleConstruct}
   */
  private createDmsPremigrationRole() {
    return new DfIamRoleConstruct(this, {
      roleName: 'dms-pre-migration-role',
      assumptionDocument: this.dmsAssumptionDocument,
      permissionsDocuments: [
        new DataAwsIamPolicyDocument(
          this,
          Utils.createStackResourceId(
            this.stackUuid,
            'dms-pre-migration-permissions-doc'
          ),
          {
            statement: [
              {
                effect: 'Allow',
                actions: [
                  's3:PutObject',
                  's3:DeleteObject',
                  's3:GetObject',
                  's3:PutObjectTagging',
                ],
                resources: [`${this.dmsBucket.bucket.arn}/*`],
              },
              {
                effect: 'Allow',
                actions: [
                  'kms:Decrypt',
                  'kms:Encrypt',
                  'kms:ReEncryptTo',
                  'kms:GenerateDataKey',
                  'kms:DescribeKey',
                  'kms:ReEncryptFrom',
                ],
                resources: [`${this.dmsBucket.bucketKeyConstruct.key.arn}`],
              },
              {
                effect: 'Allow',
                actions: ['s3:ListBucket', 's3:GetBucketLocation'],
                resources: [`${this.dmsBucket.bucket.arn}`],
              },
            ],
          }
        ),
      ],
    });
  }

  /**
   * @return {DataAwsIamPolicyDocument}
   */
  private get dmsAssumptionDocument() {
    return (
      this.definedAssumptionDocument ||
      (this.definedAssumptionDocument = new DataAwsIamPolicyDocument(
        this,
        Utils.createStackResourceId(this.stackUuid, 'dms-assumption-document'),
        {
          statement: [
            {
              effect: 'Allow',
              principals: [
                {
                  type: 'Service',
                  identifiers: ['dms.amazonaws.com'],
                },
              ],
              actions: ['sts:AssumeRole'],
            },
          ],
        }
      ))
    );
  }
}
