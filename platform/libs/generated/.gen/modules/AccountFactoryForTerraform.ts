// generated by cdktf get
// aws-ia/control_tower_account_factory/aws
import { TerraformModule, TerraformModuleUserConfig } from 'cdktf';
import { Construct } from 'constructs';
export interface AccountFactoryForTerraformConfig extends TerraformModuleUserConfig {
  /**
   * Branch to source account customizations repo from
   * @default main
   */
  readonly accountCustomizationsRepoBranch?: string;
  /**
   * Repository name for the account customizations files. For non-CodeCommit repos, name should be in the format of Org/Repo
   * @default aft-account-customizations
   */
  readonly accountCustomizationsRepoName?: string;
  /**
   * Branch to source account provisioning customization files
   * @default main
   */
  readonly accountProvisioningCustomizationsRepoBranch?: string;
  /**
   * Repository name for the account provisioning customizations files. For non-CodeCommit repos, name should be in the format of Org/Repo
   * @default aft-account-provisioning-customizations
   */
  readonly accountProvisioningCustomizationsRepoName?: string;
  /**
   * Branch to source account request repo from
   * @default main
   */
  readonly accountRequestRepoBranch?: string;
  /**
   * Repository name for the account request files. For non-CodeCommit repos, name should be in the format of Org/Repo
   * @default aft-account-request
   */
  readonly accountRequestRepoName?: string;
  /**
   * Feature flag toggling CloudTrail data events on/off
   */
  readonly aftFeatureCloudtrailDataEvents?: boolean;
  /**
   * Feature flag toggling deletion of default VPCs on/off
   */
  readonly aftFeatureDeleteDefaultVpcsEnabled?: boolean;
  /**
   * Feature flag toggling Enterprise Support enrollment on/off
   */
  readonly aftFeatureEnterpriseSupport?: boolean;
  /**
   * Git branch from which the AFT framework should be sourced from
   */
  readonly aftFrameworkRepoGitRef?: string;
  /**
   * Git repo URL where the AFT framework should be sourced from
   * @default https://github.com/aws-ia/terraform-aws-control_tower_account_factory.git
   */
  readonly aftFrameworkRepoUrl?: string;
  /**
   * AFT Management Account ID
   */
  readonly aftManagementAccountId: string;
  /**
   * Flag toggling reporting of operational metrics
   * @default true
   */
  readonly aftMetricsReporting?: boolean;
  /**
   * CIDR Block to allocate to the AFT VPC
   * @default 192.168.0.0/22
   */
  readonly aftVpcCidr?: string;
  /**
   * Flag turning VPC endpoints on/off for AFT VPC
   * @default true
   */
  readonly aftVpcEndpoints?: boolean;
  /**
   * CIDR Block to allocate to the Private Subnet 01
   * @default 192.168.0.0/24
   */
  readonly aftVpcPrivateSubnet01Cidr?: string;
  /**
   * CIDR Block to allocate to the Private Subnet 02
   * @default 192.168.1.0/24
   */
  readonly aftVpcPrivateSubnet02Cidr?: string;
  /**
   * CIDR Block to allocate to the Public Subnet 01
   * @default 192.168.2.0/25
   */
  readonly aftVpcPublicSubnet01Cidr?: string;
  /**
   * CIDR Block to allocate to the Public Subnet 02
   * @default 192.168.2.128/25
   */
  readonly aftVpcPublicSubnet02Cidr?: string;
  /**
   * Audit Account Id
   */
  readonly auditAccountId: string;
  /**
   * Amount of days to keep CloudWatch Log Groups for Lambda functions. 0 = Never Expire
   * @default 0
   */
  readonly cloudwatchLogGroupRetention?: string;
  /**
   * The region from which this module will be executed. This MUST be the same region as Control Tower is deployed.
   */
  readonly ctHomeRegion: string;
  /**
   * Control Tower Management Account Id
   */
  readonly ctManagementAccountId: string;
  /**
   * GitHub enterprise URL, if GitHub Enterprise is being used
   * @default null
   */
  readonly githubEnterpriseUrl?: string;
  /**
   * Codebuild build timeout
   * @default 60
   */
  readonly globalCodebuildTimeout?: number;
  /**
   * Branch to source global customizations repo from
   * @default main
   */
  readonly globalCustomizationsRepoBranch?: string;
  /**
   * Repository name for the global customization files. For non-CodeCommit repos, name should be in the format of Org/Repo
   * @default aft-global-customizations
   */
  readonly globalCustomizationsRepoName?: string;
  /**
   * Log Archive Account Id
   */
  readonly logArchiveAccountId: string;
  /**
   * Maximum number of customizations/pipelines to run at once
   * @default 5
   */
  readonly maximumConcurrentCustomizations?: number;
  /**
   * API Endpoint for Terraform. Must be in the format of https://xxx.xxx.
   * @default https://app.terraform.io/api/v2/
   */
  readonly terraformApiEndpoint?: string;
  /**
   * Terraform distribution being used for AFT - valid values are oss, tfc, or tfe
   * @default oss
   */
  readonly terraformDistribution?: string;
  /**
   * Organization name for Terraform Cloud or Enterprise
   * @default null
   */
  readonly terraformOrgName?: string;
  /**
   * Terraform token for Cloud or Enterprise
   * @default null
   */
  readonly terraformToken?: string;
  /**
   * Terraform version being used for AFT
   * @default 0.15.5
   */
  readonly terraformVersion?: string;
  /**
   * AFT creates a backend for state tracking for its own state as well as OSS cases. The backend's primary region is the same as the AFT region, but this defines the secondary region to replicate to.
   */
  readonly tfBackendSecondaryRegion: string;
  /**
   * Customer VCS Provider - valid inputs are codecommit, bitbucket, github, or githubenterprise
   * @default codecommit
   */
  readonly vcsProvider?: string;
}
export class AccountFactoryForTerraform extends TerraformModule {
  private readonly inputs: { [name: string]: any } = { }
  public constructor(scope: Construct, id: string, config: AccountFactoryForTerraformConfig) {
    super(scope, id, {
      ...config,
      source: 'aws-ia/control_tower_account_factory/aws',
      version: '1.6.4',
    });
    this.accountCustomizationsRepoBranch = config.accountCustomizationsRepoBranch;
    this.accountCustomizationsRepoName = config.accountCustomizationsRepoName;
    this.accountProvisioningCustomizationsRepoBranch = config.accountProvisioningCustomizationsRepoBranch;
    this.accountProvisioningCustomizationsRepoName = config.accountProvisioningCustomizationsRepoName;
    this.accountRequestRepoBranch = config.accountRequestRepoBranch;
    this.accountRequestRepoName = config.accountRequestRepoName;
    this.aftFeatureCloudtrailDataEvents = config.aftFeatureCloudtrailDataEvents;
    this.aftFeatureDeleteDefaultVpcsEnabled = config.aftFeatureDeleteDefaultVpcsEnabled;
    this.aftFeatureEnterpriseSupport = config.aftFeatureEnterpriseSupport;
    this.aftFrameworkRepoGitRef = config.aftFrameworkRepoGitRef;
    this.aftFrameworkRepoUrl = config.aftFrameworkRepoUrl;
    this.aftManagementAccountId = config.aftManagementAccountId;
    this.aftMetricsReporting = config.aftMetricsReporting;
    this.aftVpcCidr = config.aftVpcCidr;
    this.aftVpcEndpoints = config.aftVpcEndpoints;
    this.aftVpcPrivateSubnet01Cidr = config.aftVpcPrivateSubnet01Cidr;
    this.aftVpcPrivateSubnet02Cidr = config.aftVpcPrivateSubnet02Cidr;
    this.aftVpcPublicSubnet01Cidr = config.aftVpcPublicSubnet01Cidr;
    this.aftVpcPublicSubnet02Cidr = config.aftVpcPublicSubnet02Cidr;
    this.auditAccountId = config.auditAccountId;
    this.cloudwatchLogGroupRetention = config.cloudwatchLogGroupRetention;
    this.ctHomeRegion = config.ctHomeRegion;
    this.ctManagementAccountId = config.ctManagementAccountId;
    this.githubEnterpriseUrl = config.githubEnterpriseUrl;
    this.globalCodebuildTimeout = config.globalCodebuildTimeout;
    this.globalCustomizationsRepoBranch = config.globalCustomizationsRepoBranch;
    this.globalCustomizationsRepoName = config.globalCustomizationsRepoName;
    this.logArchiveAccountId = config.logArchiveAccountId;
    this.maximumConcurrentCustomizations = config.maximumConcurrentCustomizations;
    this.terraformApiEndpoint = config.terraformApiEndpoint;
    this.terraformDistribution = config.terraformDistribution;
    this.terraformOrgName = config.terraformOrgName;
    this.terraformToken = config.terraformToken;
    this.terraformVersion = config.terraformVersion;
    this.tfBackendSecondaryRegion = config.tfBackendSecondaryRegion;
    this.vcsProvider = config.vcsProvider;
  }
  public get accountCustomizationsRepoBranch(): string | undefined {
    return this.inputs['account_customizations_repo_branch'] as string | undefined;
  }
  public set accountCustomizationsRepoBranch(value: string | undefined) {
    this.inputs['account_customizations_repo_branch'] = value;
  }
  public get accountCustomizationsRepoName(): string | undefined {
    return this.inputs['account_customizations_repo_name'] as string | undefined;
  }
  public set accountCustomizationsRepoName(value: string | undefined) {
    this.inputs['account_customizations_repo_name'] = value;
  }
  public get accountProvisioningCustomizationsRepoBranch(): string | undefined {
    return this.inputs['account_provisioning_customizations_repo_branch'] as string | undefined;
  }
  public set accountProvisioningCustomizationsRepoBranch(value: string | undefined) {
    this.inputs['account_provisioning_customizations_repo_branch'] = value;
  }
  public get accountProvisioningCustomizationsRepoName(): string | undefined {
    return this.inputs['account_provisioning_customizations_repo_name'] as string | undefined;
  }
  public set accountProvisioningCustomizationsRepoName(value: string | undefined) {
    this.inputs['account_provisioning_customizations_repo_name'] = value;
  }
  public get accountRequestRepoBranch(): string | undefined {
    return this.inputs['account_request_repo_branch'] as string | undefined;
  }
  public set accountRequestRepoBranch(value: string | undefined) {
    this.inputs['account_request_repo_branch'] = value;
  }
  public get accountRequestRepoName(): string | undefined {
    return this.inputs['account_request_repo_name'] as string | undefined;
  }
  public set accountRequestRepoName(value: string | undefined) {
    this.inputs['account_request_repo_name'] = value;
  }
  public get aftFeatureCloudtrailDataEvents(): boolean | undefined {
    return this.inputs['aft_feature_cloudtrail_data_events'] as boolean | undefined;
  }
  public set aftFeatureCloudtrailDataEvents(value: boolean | undefined) {
    this.inputs['aft_feature_cloudtrail_data_events'] = value;
  }
  public get aftFeatureDeleteDefaultVpcsEnabled(): boolean | undefined {
    return this.inputs['aft_feature_delete_default_vpcs_enabled'] as boolean | undefined;
  }
  public set aftFeatureDeleteDefaultVpcsEnabled(value: boolean | undefined) {
    this.inputs['aft_feature_delete_default_vpcs_enabled'] = value;
  }
  public get aftFeatureEnterpriseSupport(): boolean | undefined {
    return this.inputs['aft_feature_enterprise_support'] as boolean | undefined;
  }
  public set aftFeatureEnterpriseSupport(value: boolean | undefined) {
    this.inputs['aft_feature_enterprise_support'] = value;
  }
  public get aftFrameworkRepoGitRef(): string | undefined {
    return this.inputs['aft_framework_repo_git_ref'] as string | undefined;
  }
  public set aftFrameworkRepoGitRef(value: string | undefined) {
    this.inputs['aft_framework_repo_git_ref'] = value;
  }
  public get aftFrameworkRepoUrl(): string | undefined {
    return this.inputs['aft_framework_repo_url'] as string | undefined;
  }
  public set aftFrameworkRepoUrl(value: string | undefined) {
    this.inputs['aft_framework_repo_url'] = value;
  }
  public get aftManagementAccountId(): string {
    return this.inputs['aft_management_account_id'] as string;
  }
  public set aftManagementAccountId(value: string) {
    this.inputs['aft_management_account_id'] = value;
  }
  public get aftMetricsReporting(): boolean | undefined {
    return this.inputs['aft_metrics_reporting'] as boolean | undefined;
  }
  public set aftMetricsReporting(value: boolean | undefined) {
    this.inputs['aft_metrics_reporting'] = value;
  }
  public get aftVpcCidr(): string | undefined {
    return this.inputs['aft_vpc_cidr'] as string | undefined;
  }
  public set aftVpcCidr(value: string | undefined) {
    this.inputs['aft_vpc_cidr'] = value;
  }
  public get aftVpcEndpoints(): boolean | undefined {
    return this.inputs['aft_vpc_endpoints'] as boolean | undefined;
  }
  public set aftVpcEndpoints(value: boolean | undefined) {
    this.inputs['aft_vpc_endpoints'] = value;
  }
  public get aftVpcPrivateSubnet01Cidr(): string | undefined {
    return this.inputs['aft_vpc_private_subnet_01_cidr'] as string | undefined;
  }
  public set aftVpcPrivateSubnet01Cidr(value: string | undefined) {
    this.inputs['aft_vpc_private_subnet_01_cidr'] = value;
  }
  public get aftVpcPrivateSubnet02Cidr(): string | undefined {
    return this.inputs['aft_vpc_private_subnet_02_cidr'] as string | undefined;
  }
  public set aftVpcPrivateSubnet02Cidr(value: string | undefined) {
    this.inputs['aft_vpc_private_subnet_02_cidr'] = value;
  }
  public get aftVpcPublicSubnet01Cidr(): string | undefined {
    return this.inputs['aft_vpc_public_subnet_01_cidr'] as string | undefined;
  }
  public set aftVpcPublicSubnet01Cidr(value: string | undefined) {
    this.inputs['aft_vpc_public_subnet_01_cidr'] = value;
  }
  public get aftVpcPublicSubnet02Cidr(): string | undefined {
    return this.inputs['aft_vpc_public_subnet_02_cidr'] as string | undefined;
  }
  public set aftVpcPublicSubnet02Cidr(value: string | undefined) {
    this.inputs['aft_vpc_public_subnet_02_cidr'] = value;
  }
  public get auditAccountId(): string {
    return this.inputs['audit_account_id'] as string;
  }
  public set auditAccountId(value: string) {
    this.inputs['audit_account_id'] = value;
  }
  public get cloudwatchLogGroupRetention(): string | undefined {
    return this.inputs['cloudwatch_log_group_retention'] as string | undefined;
  }
  public set cloudwatchLogGroupRetention(value: string | undefined) {
    this.inputs['cloudwatch_log_group_retention'] = value;
  }
  public get ctHomeRegion(): string {
    return this.inputs['ct_home_region'] as string;
  }
  public set ctHomeRegion(value: string) {
    this.inputs['ct_home_region'] = value;
  }
  public get ctManagementAccountId(): string {
    return this.inputs['ct_management_account_id'] as string;
  }
  public set ctManagementAccountId(value: string) {
    this.inputs['ct_management_account_id'] = value;
  }
  public get githubEnterpriseUrl(): string | undefined {
    return this.inputs['github_enterprise_url'] as string | undefined;
  }
  public set githubEnterpriseUrl(value: string | undefined) {
    this.inputs['github_enterprise_url'] = value;
  }
  public get globalCodebuildTimeout(): number | undefined {
    return this.inputs['global_codebuild_timeout'] as number | undefined;
  }
  public set globalCodebuildTimeout(value: number | undefined) {
    this.inputs['global_codebuild_timeout'] = value;
  }
  public get globalCustomizationsRepoBranch(): string | undefined {
    return this.inputs['global_customizations_repo_branch'] as string | undefined;
  }
  public set globalCustomizationsRepoBranch(value: string | undefined) {
    this.inputs['global_customizations_repo_branch'] = value;
  }
  public get globalCustomizationsRepoName(): string | undefined {
    return this.inputs['global_customizations_repo_name'] as string | undefined;
  }
  public set globalCustomizationsRepoName(value: string | undefined) {
    this.inputs['global_customizations_repo_name'] = value;
  }
  public get logArchiveAccountId(): string {
    return this.inputs['log_archive_account_id'] as string;
  }
  public set logArchiveAccountId(value: string) {
    this.inputs['log_archive_account_id'] = value;
  }
  public get maximumConcurrentCustomizations(): number | undefined {
    return this.inputs['maximum_concurrent_customizations'] as number | undefined;
  }
  public set maximumConcurrentCustomizations(value: number | undefined) {
    this.inputs['maximum_concurrent_customizations'] = value;
  }
  public get terraformApiEndpoint(): string | undefined {
    return this.inputs['terraform_api_endpoint'] as string | undefined;
  }
  public set terraformApiEndpoint(value: string | undefined) {
    this.inputs['terraform_api_endpoint'] = value;
  }
  public get terraformDistribution(): string | undefined {
    return this.inputs['terraform_distribution'] as string | undefined;
  }
  public set terraformDistribution(value: string | undefined) {
    this.inputs['terraform_distribution'] = value;
  }
  public get terraformOrgName(): string | undefined {
    return this.inputs['terraform_org_name'] as string | undefined;
  }
  public set terraformOrgName(value: string | undefined) {
    this.inputs['terraform_org_name'] = value;
  }
  public get terraformToken(): string | undefined {
    return this.inputs['terraform_token'] as string | undefined;
  }
  public set terraformToken(value: string | undefined) {
    this.inputs['terraform_token'] = value;
  }
  public get terraformVersion(): string | undefined {
    return this.inputs['terraform_version'] as string | undefined;
  }
  public set terraformVersion(value: string | undefined) {
    this.inputs['terraform_version'] = value;
  }
  public get tfBackendSecondaryRegion(): string {
    return this.inputs['tf_backend_secondary_region'] as string;
  }
  public set tfBackendSecondaryRegion(value: string) {
    this.inputs['tf_backend_secondary_region'] = value;
  }
  public get vcsProvider(): string | undefined {
    return this.inputs['vcs_provider'] as string | undefined;
  }
  public set vcsProvider(value: string | undefined) {
    this.inputs['vcs_provider'] = value;
  }
  public get accountCustomizationsRepoBranchOutput() {
    return this.getString('account_customizations_repo_branch')
  }
  public get accountCustomizationsRepoNameOutput() {
    return this.getString('account_customizations_repo_name')
  }
  public get accountProvisioningCustomizationsRepoBranchOutput() {
    return this.getString('account_provisioning_customizations_repo_branch')
  }
  public get accountProvisioningCustomizationsRepoNameOutput() {
    return this.getString('account_provisioning_customizations_repo_name')
  }
  public get accountRequestRepoBranchOutput() {
    return this.getString('account_request_repo_branch')
  }
  public get accountRequestRepoNameOutput() {
    return this.getString('account_request_repo_name')
  }
  public get aftFeatureCloudtrailDataEventsOutput() {
    return this.getString('aft_feature_cloudtrail_data_events')
  }
  public get aftFeatureDeleteDefaultVpcsEnabledOutput() {
    return this.getString('aft_feature_delete_default_vpcs_enabled')
  }
  public get aftFeatureEnterpriseSupportOutput() {
    return this.getString('aft_feature_enterprise_support')
  }
  public get aftManagementAccountIdOutput() {
    return this.getString('aft_management_account_id')
  }
  public get aftVpcCidrOutput() {
    return this.getString('aft_vpc_cidr')
  }
  public get aftVpcPrivateSubnet01CidrOutput() {
    return this.getString('aft_vpc_private_subnet_01_cidr')
  }
  public get aftVpcPrivateSubnet02CidrOutput() {
    return this.getString('aft_vpc_private_subnet_02_cidr')
  }
  public get aftVpcPublicSubnet01CidrOutput() {
    return this.getString('aft_vpc_public_subnet_01_cidr')
  }
  public get aftVpcPublicSubnet02CidrOutput() {
    return this.getString('aft_vpc_public_subnet_02_cidr')
  }
  public get auditAccountIdOutput() {
    return this.getString('audit_account_id')
  }
  public get cloudwatchLogGroupRetentionOutput() {
    return this.getString('cloudwatch_log_group_retention')
  }
  public get ctHomeRegionOutput() {
    return this.getString('ct_home_region')
  }
  public get ctManagementAccountIdOutput() {
    return this.getString('ct_management_account_id')
  }
  public get githubEnterpriseUrlOutput() {
    return this.getString('github_enterprise_url')
  }
  public get globalCustomizationsRepoBranchOutput() {
    return this.getString('global_customizations_repo_branch')
  }
  public get globalCustomizationsRepoNameOutput() {
    return this.getString('global_customizations_repo_name')
  }
  public get logArchiveAccountIdOutput() {
    return this.getString('log_archive_account_id')
  }
  public get maximumConcurrentCustomizationsOutput() {
    return this.getString('maximum_concurrent_customizations')
  }
  public get terraformApiEndpointOutput() {
    return this.getString('terraform_api_endpoint')
  }
  public get terraformDistributionOutput() {
    return this.getString('terraform_distribution')
  }
  public get terraformOrgNameOutput() {
    return this.getString('terraform_org_name')
  }
  public get terraformVersionOutput() {
    return this.getString('terraform_version')
  }
  public get tfBackendSecondaryRegionOutput() {
    return this.getString('tf_backend_secondary_region')
  }
  public get vcsProviderOutput() {
    return this.getString('vcs_provider')
  }
  protected synthesizeAttributes() {
    return this.inputs;
  }
}
