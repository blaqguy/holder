import { RemoteStack, StackConfig } from '../stacks';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import path from 'path';
import {
  DfPrivateBucketConstruct,
} from '@dragonfly/constructs';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { S3Object } from '@cdktf/provider-aws/lib/s3-object';
import { DataArchiveFile } from '@cdktf/provider-archive/lib/data-archive-file';
import fs from 'fs';
import { copySync } from 'fs-extra';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { Constants, Utils } from '@dragonfly/utils';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

interface BasePlaybookVars {
  sub_domain: string;
  vpc_cidr: string;
  us_finame_pw: string;
  efs_name: string;
  key_pair_name: string;
  private_key_parameter_name: string;
  build_key_name?: string;
  mqm_pw: string;
  usrsvs_pw: string;
  usrrpt_pw: string;
  ihsadmin_pw: string;
  jenkins_secret: string;
  jenkins_url: string;
  datadog_api_key: string;
  s1_api_key: string;
  s1_site_token: string;
  region: string;
  ewb_uat_vpc_cidr?: string;
  stop_datadog_agent: boolean;
  upf_database_fqdns: string[];
}

interface PlaybookVars extends BasePlaybookVars {
  primary_ingress_vpc_cidr: string;
  recovery_ingress_vpc_cidr: string;
  legacy_ingress_vpc_cidr: string;
}

export interface TierConfig {
  tierName: string;
  targetInstanceIds: string[];
}

export interface DfAssociationConfig {
  fiName: string;
  clusterName: string;
  instanceRoles: IamRole[];
  tierConfigs: TierConfig[];
  ansibleTemplateVersion: 'aod' | 'qe' | 'platform';
}

/**
 * Creates infrastructure for applying Ansible playbooks stored
 * in S3 to target EC2 instances using SSM Associations
 */
export class DfConfigManagementStack extends RemoteStack {
  protected bucket: DfPrivateBucketConstruct;
  protected provider: AwsProvider;

  /**
   * @param {string} stackId - The environment that will own this stack
   * @param {StackConfig} stackConfig - stack config
   */
  constructor(
    protected readonly stackId: string,
    protected readonly stackConfig: StackConfig,
    protected readonly associationConfigs: DfAssociationConfig[],
    protected readonly basePlaybookVars: BasePlaybookVars,
    protected readonly regionAlias: Constants.AWS_REGION_ALIASES = Constants
      .AWS_REGION_ALIASES.LEGACY
  ) {
    super(stackId, stackConfig);

    // Retrieves the current provider based on the region passed in
    this.provider = this.getProviderForRegion(regionAlias);

    const playbookVars: PlaybookVars = this.setIngressVpcCidrs();

    // * Add the playbook variables to parameter store
    // Object.entries(this.basePlaybookVars).forEach(([key, value]) => {
    //   const isSecure = /pw|secret|api|token/i.test(key);
    //   new SsmParameter(this, `${key}-ssm-param`, {
    //     provider: this.provider,
    //     name: key,
    //     type: isSecure
    //       ? 'SecureString'
    //       : Array.isArray(value)
    //       ? 'StringList'
    //       : 'String',
    //     value: Array.isArray(value) ? value.join(',') : value,
    //   });
    // });

    associationConfigs.forEach((associationConfig) => {
      const bucketPrefix =
        `${this.stackConfig.envName}-dft-${associationConfig.clusterName}-ansible-assets`.toLowerCase();
      const bucketName =
        regionAlias === Constants.AWS_REGION_ALIASES.DF_RECOVERY
          ? `${bucketPrefix}-recovery`
          : bucketPrefix;
      this.bucket = new DfPrivateBucketConstruct(
        this,
        `${associationConfig.clusterName}-${this.stackId}`,
        {
          bucketName: bucketName,
          bucketConfigOverride: {
            provider: this.provider,
            bucket: bucketName,
            versioning: {
              enabled: true,
              mfaDelete: false,
            },
            serverSideEncryptionConfiguration: {
              rule: {
                applyServerSideEncryptionByDefault: {
                  sseAlgorithm: 'aws:kms',
                },
                bucketKeyEnabled: true,
              },
            },
            tags: {
              Name: bucketName,
            },
          },
          provider: this.provider,
        }
      );

      new S3BucketPolicy(
        this,
        `${associationConfig.clusterName}-ansible-assets-bucket-policy`,
        {
          provider: this.provider,
          bucket: this.bucket.bucket.bucket,
          policy: new DataAwsIamPolicyDocument(
            this,
            `${associationConfig.clusterName}-ansible-assets-bucket-policy-doc`,
            {
              provider: this.provider,
              version: '2012-10-17',
              statement: [
                {
                  effect: 'Allow',
                  principals: [
                    {
                      type: 'AWS',
                      identifiers: associationConfig.instanceRoles.map(
                        (role) => {
                          return role.arn;
                        }
                      ),
                    },
                  ],
                  actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject'],
                  resources: [
                    this.bucket.bucket.arn,
                    `${this.bucket.bucket.arn}/*`,
                  ],
                },
              ],
            }
          ).json,
        }
      );

      associationConfig.tierConfigs.forEach((config: TierConfig) => {
        /**
         * Copying template to cluster-specific dir so the original template files aren't overwritten
         */

        const templatePlaybookPath = path.resolve(
          __dirname,
          `ansibleAssets/ansible/playbooks/${associationConfig.ansibleTemplateVersion}/${config.tierName}.yml`
        );

        const renderedPlaybookPath = path.resolve(
          __dirname,
          `ansibleAssets/ansible/${associationConfig.clusterName}/playbooks/${associationConfig.ansibleTemplateVersion}/${config.tierName}.yml`
        );

        copySync(templatePlaybookPath, renderedPlaybookPath);

        /**
         * Copying roles into cluster-specific dir
         */
        const roleSrcDir = path.resolve(
          __dirname,
          'ansibleAssets/ansible/roles/'
        );

        const roleDestDir = path.resolve(
          __dirname,
          `ansibleAssets/ansible/${associationConfig.clusterName}/roles/`
        );

        copySync(roleSrcDir, roleDestDir);

        /**
         * If a template doesn't exist for the tier, skip it
         */
        if (!fs.existsSync(templatePlaybookPath)) {
          return;
        }

        const templateContent = fs.readFileSync(renderedPlaybookPath, 'utf-8');

        /**
         * Matches {{ value }} in playbook, looks up values in playbookVars,
         * then replaces matched value with values found in playbookVars
         *
         * fi_name is checked separated because the value comes from associationConfig, not playbookVars
         *
         * Returns the matched value if no matching key is found
         */
        const renderedContent = templateContent.replace(
          /{{\s*(\w+)\s*}}/g,
          (match, varName) => {
            if (match === '{{ fi_name }}') {
              return associationConfig.fiName;
            }

            if (match === '{{ env_name }}') {
              return this.stackConfig.envName.toLowerCase();
            }

            if (match === '{{ upf_database_fqdns }}') {
              return (
                '[' +
                playbookVars.upf_database_fqdns
                  .map((fqdn) => `"${fqdn}"`)
                  .join(', ') +
                ']'
              );
            }

            if (match === '{{ upf_dnat_refresh_command }}') {
              return `sudo ipset flush upfset && ${playbookVars.upf_database_fqdns
                .map((fqdn) => `sudo ipset add upfset ${fqdn}`)
                .join(' && ')}`;
            }

            const value = playbookVars[varName.trim()];
            return value !== undefined ? value : '';
          }
        );

        fs.writeFileSync(renderedPlaybookPath, renderedContent);
      });

      const archive = new DataArchiveFile(
        this,
        `${associationConfig.clusterName}-ansible-assets-archive`,
        {
          sourceDir: path.resolve(
            __dirname,
            `ansibleAssets/ansible/${associationConfig.clusterName}`
          ),
          outputPath: path.resolve(
            __dirname,
            `ansibleAssets/${associationConfig.clusterName}/ansible.zip`
          ),
          type: 'zip',
        }
      );

      const assetsObject = new S3Object(
        this,
        `${associationConfig.clusterName}-ansible-assets-object`,
        {
          provider: this.provider,
          key: 'ansible.zip',
          bucket: this.bucket.bucket.bucket,
          source: archive.outputPath,
          sourceHash: archive.outputMd5,
          tags: {
            Name: `${associationConfig.clusterName}-ansible-assets-object`,
          },
        }
      );

      associationConfig.tierConfigs.forEach((tierConfig: TierConfig) => {
        if (tierConfig.targetInstanceIds.length > 0) {
          new SsmAssociation(
            this,
            `${associationConfig.clusterName}-${tierConfig.tierName}-tier-association`,
            {
              provider: this.provider,
              name: 'AWS-ApplyAnsiblePlaybooks',
              associationName: `${associationConfig.clusterName}-${tierConfig.tierName}-tier-ansible-execution`,
              parameters: {
                SourceType: 'S3',
                SourceInfo: JSON.stringify({
                  path: `https://${this.bucket.bucket.bucketDomainName}/ansible.zip`,
                }),
                PlaybookFile: `./playbooks/${associationConfig.ansibleTemplateVersion}/${tierConfig.tierName}.yml`,
                InstallDependencies: 'True',
              },
              targets: [
                {
                  key: 'InstanceIds',
                  values: tierConfig.targetInstanceIds,
                },
              ],
              outputLocation: {
                s3BucketName: this.bucket.bucket.bucket,
                s3KeyPrefix: 'logs',
              },
              dependsOn: [assetsObject],
            }
          );
        }
      });
    });
  }

  /**
   * Determines whether the playbookvars should use the prod or nonprod sharedNetwork ingress VPC cidr blocks
   * @return {PlaybookVars}
   */
  public setIngressVpcCidrs(): PlaybookVars {
    const vpcIngressCidrs = Utils.getIngressCidrBlocksByNetworkType(
      this.stackConfig.accountDefinition
    );
    return {
      legacy_ingress_vpc_cidr: vpcIngressCidrs[0],
      primary_ingress_vpc_cidr: vpcIngressCidrs[1],
      recovery_ingress_vpc_cidr: vpcIngressCidrs[2],
      ...this.basePlaybookVars,
    };
  }
}
