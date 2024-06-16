import { Construct } from 'constructs';
import { DfPrivateBucketConstruct } from '../constructs';
import { DataArchiveFile } from '@cdktf/provider-archive/lib/data-archive-file';
import path from 'path';
import fs from 'fs';
import { copySync } from 'fs-extra';
import { S3Object } from '@cdktf/provider-aws/lib/s3-object';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import {
  DfSsmAssociationConfig,
  DfSsmAssociationConstruct,
} from './dfSsmAssociationConstruct';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';

export interface DfSsmAnsibleAssociationConfig extends DfSsmAssociationConfig {
  accountId: string;
  associationName: string;
  playbookName: string;
  dryRun?: 'True' | 'False';
  installDependencies?: 'True' | 'False';
  ansibleAssetsDir: string;
  envName: string;
  templatedVars?: { [key: string]: string };
  templatedPlaybook?: boolean;
}

/**
 * Dragonfly FT implementation of an SSM Association for executing Ansible playbooks
 */
export class DfSsmAnsibleAssociationConstruct extends DfSsmAssociationConstruct {
  protected readonly config: DfSsmAnsibleAssociationConfig;
  public readonly assetsBucket: S3Bucket;
  protected assetsArchive: DataArchiveFile;
  protected assetsObject: S3Object;
  protected _association: SsmAssociation;
  /**
   *
   * @param {Constuct} scope
   * @param {string} id
   * @param {SsmAssociationConfig} config
   */
  constructor(
    scope: Construct,
    id: string,
    config: DfSsmAnsibleAssociationConfig
  ) {
    super(scope, id, config);
    this.config = config;

    if (this.config.templatedPlaybook) {
      this.renderTemplate();
    }

    this.assetsBucket = new DfPrivateBucketConstruct(
      scope,
      `${id}-ansible-assets`,
      {
        bucketName:
          `${this.config.envName}-dft-${id}-ansible-assets`.toLowerCase(),
        bucketConfigOverride: {
          provider: this.config.provider,
          bucket:
            `${this.config.envName}-dft-${id}-ansible-assets`.toLowerCase(),
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
            Name: `${this.config.envName}-dft-${id}-ansible-assets`.toLowerCase(),
          },
        },
        provider: this.config.provider,
      }
    ).bucket;

    new S3BucketPolicy(scope, `${id}-ansible-assets-bucket-policy`, {
      provider: this.config.provider,
      bucket: this.assetsBucket.bucket,
      policy: new DataAwsIamPolicyDocument(
        scope,
        `${id}-ansible-assets-bucket-policy-doc`,
        {
          provider: this.config.provider,
          version: '2012-10-17',
          statement: [
            {
              effect: 'Allow',
              principals: [
                {
                  type: 'AWS',
                  identifiers: ['*'],
                },
              ],
              actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject'],
              resources: [this.assetsBucket.arn, `${this.assetsBucket.arn}/*`],
              condition: [
                {
                  test: 'StringEquals',
                  variable: 'aws:PrincipalAccount',
                  values: [this.config.accountId],
                },
              ],
            },
          ],
        }
      ).json,
    });

    this.assetsArchive = new DataArchiveFile(
      this.scope,
      `${this.id}-ansible-assets-archive`,
      {
        sourceDir: path.resolve(
          __dirname,
          `ansibleAssets/${this.config.ansibleAssetsDir}`
        ),
        outputPath: path.resolve(
          __dirname,
          `ansibleAssets/${this.config.ansibleAssetsDir}/ansible.zip`
        ),
        type: 'zip',
      }
    );

    this.assetsObject = new S3Object(
      this.scope,
      `${this.id}-ansible-assets-object`,
      {
        provider: this.config.provider,
        key: 'ansible.zip',
        bucket: this.assetsBucket.bucket,
        source: this.assetsArchive.outputPath,
        sourceHash: this.assetsArchive.outputMd5,
        tags: {
          Name: `${this.id}-ansible-assets-object`,
        },
      }
    );

    this.createAssociation();
  }

  protected createAssociation(): SsmAssociation {
    return new SsmAssociation(this.scope, `${this.id}-ansible-association`, {
      provider: this.config.provider,
      name: 'AWS-ApplyAnsiblePlaybooks',
      associationName: this.config.associationName,
      parameters: {
        SourceType: 'S3',
        SourceInfo: JSON.stringify({
          path: `https://${this.assetsBucket.bucketDomainName}/ansible.zip`,
        }),
        PlaybookFile: `./playbooks/${this.config.playbookName}.yml`,
        InstallDependencies: this.config.installDependencies ?? 'True',
        Check: this.config.dryRun ?? 'False',
      },
      targets: this.targets,
      outputLocation: {
        s3BucketName: this.assetsBucket.bucket,
        s3KeyPrefix: 'logs',
      },
      dependsOn: [this.assetsObject],
    });
  }

  private renderTemplate(): void {
    /**
     * Copying template to cluster-specific dir so the original template files aren't overwritten
     */
    const templatePlaybookPath = path.resolve(
      __dirname,
      `ansibleAssets/${this.config.ansibleAssetsDir}/playbooks/${this.config.playbookName}.yml`
    );

    const renderedPlaybookPath = path.resolve(
      __dirname,
      `ansibleAssets/${this.config.ansibleAssetsDir}/playbooks/${this.config.playbookName}.yml`
    );

    copySync(templatePlaybookPath, renderedPlaybookPath);

    /**
     * Copying roles into cluster-specific dir
     */
    const roleSrcDir = path.resolve(
      __dirname,
      `ansibleAssets/${this.config.ansibleAssetsDir}/roles/`
    );

    const roleDestDir = path.resolve(
      __dirname,
      `ansibleAssets/${this.config.ansibleAssetsDir}/roles/`
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
     */
    const renderedContent = templateContent.replace(
      /{{\s*(\w+)\s*}}/g,
      (match, varName) => {
        if (match === '{{ env_name }}') {
          return this.config.envName.toLowerCase();
        }

        const value = this.config.templatedVars[varName.trim()];
        return value !== undefined ? value : '';
      }
    );

    fs.writeFileSync(renderedPlaybookPath, renderedContent);
  }
}
