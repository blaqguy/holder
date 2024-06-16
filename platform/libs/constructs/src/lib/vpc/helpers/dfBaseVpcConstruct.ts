import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { FlowLog } from '@cdktf/provider-aws/lib/flow-log';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { NetworkAcl } from '@cdktf/provider-aws/lib/network-acl';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DragonflyVpc, DragonflyServiceKmsKey } from '@dragonfly/components';
import { Constants, DfAccounts } from '@dragonfly/utils';
import { Fn, AssetType, TerraformAsset } from 'cdktf';
import { Construct } from 'constructs';
import path = require('path');
import { DfBaseVpcConstructConfig } from './interfaces';

/**
 * Base VPC
 */
export class DfBaseVpcConstruct extends Construct {
  protected readonly vpc: DragonflyVpc;
  protected readonly privateNacl: NetworkAcl;
  protected readonly flowLogRole: IamRole;
  protected flowLogKms: DragonflyServiceKmsKey;
  protected flowLogGroup: CloudwatchLogGroup;

  /**
   * @param {Construct} scope - The scope the resource is created in
   * @param {string} id - The id for the terraform resource
   * @param {DfBaseVpcConstructConfig} baseVpcConfig - The configuration properties for the Base VPC
   */
  constructor(
    scope: Construct,
    id: string,
    public baseVpcConfig: DfBaseVpcConstructConfig
  ) {
    super(scope, id);

    const regionName = new DataAwsRegion(this, 'region', {
      provider: baseVpcConfig.provider,
    }).name;

    const accountId = new DataAwsCallerIdentity(this, 'account', {
      provider: baseVpcConfig.provider,
    }).accountId;

    const baseVpcAssets = new TerraformAsset(this, `${id}-baseVpcAssets`, {
      path: path.resolve(__dirname, 'templates'),
      type: AssetType.DIRECTORY,
    });

    // * Create the VPC
    this.vpc = new DragonflyVpc(this, `${id}-Vpc`, {
      provider: baseVpcConfig.provider,
      cidrBlock: baseVpcConfig.vpcCidr,
      tags: {
        Name: id,
      },
    });

    // Architecture Sandbox ID for this resource is over 64 characters limit
    // The thing is empty, can we just redeploy it with a shorter id?
    // * Enable VPC Flow Logs
    this.flowLogRole = new IamRole(
      this,
      baseVpcConfig.federatedAccountId ===
      DfAccounts.getArchitectureSandboxAccountDef().accountNumber
        ? `${id}`
        : `${id}flowLogRole`,
      {
        provider: baseVpcConfig.provider,
        name:
          baseVpcConfig.federatedAccountId ===
          DfAccounts.getArchitectureSandboxAccountDef().accountNumber
            ? `${id}`
            : `${id}-flowLogRole`,
        assumeRolePolicy: Fn.file(
          `${baseVpcAssets.path}/flowLogAssumeRolePolicy.json`
        ),
        tags: { Name: `${id}flowLogRole` },
      }
    );

    new IamRolePolicy(this, `${id}flowLogRolePolicy`, {
      provider: baseVpcConfig.provider,
      name: `${id}-flowLogRolePolicy`,
      role: this.flowLogRole.id,
      policy: Fn.file(`${baseVpcAssets.path}/flowLogRolePolicy.json`),
    });

    this.flowLogKms = new DragonflyServiceKmsKey(
      this,
      `${id}-flowLogsLogGroupKms`,
      {
        provider: baseVpcConfig.provider,
        policy: Fn.templatefile(
          `${baseVpcAssets.path}/flowLogsLogGroupKmsPolicy.json.tftpl`,
          {
            regionName: regionName,
            accountId: accountId,
          }
        ),
        tags: { Name: `${id}-flowLogLogGroupKms` },
      }
    );

    /*
     *INFORMATIONAL: Sometimes this gets recreated by something....
     *double check after destroy actions
     */
    this.flowLogGroup = new CloudwatchLogGroup(this, `${id}-flowLogGroup`, {
      provider: baseVpcConfig.provider,
      name: `${id}-flowLogGroup`,
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        baseVpcConfig.federatedAccountId
      )
        ? 365
        : 30,
      kmsKeyId: this.flowLogKms.arn,
      tags: { Name: `${id}-flow-logs` },
    });

    this.createFlowLog(
      `${id}-flowLog`,
      baseVpcConfig.provider,
      'cloud-watch-logs',
      this.flowLogGroup.arn
    );
  }

  /**
   * @param {string} constructId - The id for the terraform resource
   * @param {AwsProvider} provider - The provider
   * @param {string} logDestinationType - The type of log destination
   * @param {string} logDestination - The log destination
   * @return {FlowLog} - The Flow Log resource
   */
  private createFlowLog(
    constructId: string,
    provider: AwsProvider,
    logDestinationType: 'cloud-watch-logs' | 's3',
    logDestination: string
  ): FlowLog {
    return new FlowLog(this, constructId, {
      provider: provider,
      iamRoleArn:
        logDestinationType === 's3' ? undefined : this.flowLogRole.arn,
      logDestination: logDestination,
      logDestinationType: logDestinationType,
      trafficType: 'ALL',
      vpcId: this.vpc.id,
      tags: { Name: constructId },
    });
  }

  /**
   * @return {string} VpcID - The ID of the VPC
   */
  public get vpcId(): string {
    return this.vpc.id;
  }

  /**
   * @return {string} - The Flow Log Role ARN
   */
  public get flowLogRoleArn(): string {
    return this.flowLogRole.arn;
  }

  /**
   * @return {string} - The Flow Log's KMS Key ARN
   */
  public get flowLogKmsArn(): string {
    return this.flowLogKms.arn;
  }

  /**
   * @return {string} - The CIDR of the VPC
   */
  public get vpcCidrBlock(): string {
    return this.vpc.cidrBlock;
  }

  /**
   * @return {string} - The CIDR of the VPC
   */
  public get untokenizedVpcCidrBlock(): string {
    return this.baseVpcConfig.vpcCidr;
  }

  /**
   * @return {string}
   */
  public get vpcName(): string {
    return this.vpc.tags.Name;
  }

  /**
   * @return {CloudwatchLogGroup}
   */
  public get flowLogGroupResource(): CloudwatchLogGroup {
    return this.flowLogGroup;
  }
}
