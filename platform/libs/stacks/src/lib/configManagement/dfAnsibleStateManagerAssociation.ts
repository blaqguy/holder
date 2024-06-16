import path from 'path';
import { DataArchiveFile } from '@cdktf/provider-archive/lib/data-archive-file';
import { S3Object } from '@cdktf/provider-aws/lib/s3-object';
import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { RemoteStack } from '../stacks';
import {
  DfPrivateBucketConstruct,
  DfSsmRunShellScriptAssociationConstruct,
} from '@dragonfly/constructs';
import { DfAnsibleStateManagerAssociationConfig } from './helpers/interfaces';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import { createAnsibleAssociationLambdas } from './helpers/ansibleAssociationLambdas';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';

export class DfAnsibleStateManagerAssociation extends RemoteStack {
  constructor(config: DfAnsibleStateManagerAssociationConfig) {
    super(config.stackName, config.stackConfig);

    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);

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

    const ansibleAssetsZip = new DataArchiveFile(this, 'ansible-assets-zip', {
      sourceDir: path.resolve(__dirname, 'ansibleAssets/platformBaseline'),
      outputPath: path.resolve(
        __dirname,
        `ansibleAssets/platformBaseline/ansible.zip`
      ),
      type: 'zip',
    });

    /**
     * * Build the lambda assets
     * * Placing outside the loop to avoid multiple builds
     */
    Utils.buildLambdaAsssets({
      lambdaAssetDir: path.resolve(
        __dirname,
        'lambdaAssets/runAnsibleAssociation'
      ),
      lambdaAssetBundleDir: path.resolve(
        __dirname,
        'lambdaAssets/runAnsibleAssociation/dist'
      ),
    });

    Utils.buildLambdaAsssets({
      lambdaAssetDir: path.resolve(
        __dirname,
        'lambdaAssets/associationFailureNotification'
      ),
      lambdaAssetBundleDir: path.resolve(
        __dirname,
        'lambdaAssets/associationFailureNotification/dist'
      ),
    });

    Utils.buildLambdaAsssets({
      lambdaAssetDir: path.resolve(__dirname, 'lambdaAssets/stopInstances'),
      lambdaAssetBundleDir: path.resolve(
        __dirname,
        'lambdaAssets/stopInstances/dist'
      ),
    });

    props.forEach(({ provider, region }, index) => {
      // * Upload ansible runtime variables to parameter store
      const baselineVars = {
        sub_domain: `${this.stackConfig.envSubdomain}.dragonflyft.com`,
        s1_api_key: sopsData.SENTINEL_ONE.api_key,
        s1_site_token: sopsData.SENTINEL_ONE.site_token,
        newrelic_license_key: sopsData.NEW_RELIC_LICENSE_KEY,
        newrelic_disable: config.disableNewRelic || 'false',
      };

      Object.entries(baselineVars).forEach(([key, value]) => {
        const isSecure = /license_key|api_key|site_token/i.test(key);
        new SsmParameter(this, `${key}-ssm-param-${region}`, {
          provider,
          name: key,
          type: isSecure ? 'SecureString' : 'String',
          value: value,
        });
      });

      // * Config Management resources
      const bucket = new DfPrivateBucketConstruct(
        this,
        `ansible-association-bucket-${index}`,
        {
          bucketName:
            `${this.stackConfig.envName}dft-ansible-assets-${region}`.toLowerCase(),
          s3ManagedEncryption: true,
          enableVersioning: false,
          provider,
        }
      );

      new S3BucketPolicy(this, `ansible-association-bucket-${region}-policy`, {
        provider: provider,
        bucket: bucket.bucket.bucket,
        policy: new DataAwsIamPolicyDocument(
          this,
          `ansible-association-bucket-${region}-policy-doc`,
          {
            provider: provider,
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
                resources: [bucket.bucket.arn, `${bucket.bucket.arn}/*`],
                condition: [
                  {
                    test: 'StringEquals',
                    variable: 'aws:PrincipalAccount',
                    values: [config.stackConfig.federatedAccountId],
                  },
                ],
              },
            ],
          }
        ).json,
      });

      new S3Object(this, `ansible-asset-s3-object-${index}`, {
        provider,
        key: 'ansible.zip',
        bucket: bucket.bucketId,
        source: ansibleAssetsZip.outputPath,
        sourceHash: ansibleAssetsZip.outputBase64Sha256, // https://stackoverflow.com/questions/54330751/terraform-s3-bucket-objects-etag-keeps-updating-on-each-apply
      });

      const ansibleAssociation = new SsmAssociation(
        this,
        `ansible-ssm-association-${index}`,
        {
          provider,
          name: 'AWS-ApplyAnsiblePlaybooks',
          associationName: 'platform-service-config-mangement',
          parameters: {
            SourceType: 'S3',
            SourceInfo: JSON.stringify({
              path: `https://${bucket.bucket.bucketDomainName}/ansible.zip`,
            }),
            PlaybookFile: './playbooks/platform-baseline.yml',
            InstallDependencies: 'True',
            Check: 'False',
          },
          targets: [
            {
              key: 'tag:ansible-managed',
              values: ['true'],
            },
          ],
          outputLocation: {
            s3BucketName: bucket.bucketId,
            s3KeyPrefix: 'logs',
          },
          maxConcurrency: '15', // To address rate limiting issues especially in QE
        }
      );

      createAnsibleAssociationLambdas({
        scope: this,
        dftRegion: region,
        provider,
        webhookUrl: sopsData.TEAMS_INCOMING_WEBBOOK,
        associationId: ansibleAssociation.id,
        associationName: ansibleAssociation.associationName,
        ansibleAssetS3BucketArn: bucket.bucket.arn,
        ansibleAssetS3BucketId: bucket.bucketId,
        stackconfig: this.stackConfig,
      });

      /**
       * The RHEL 8.9 CIS-hardened AMI added a 2G restriction on /tmp by adding an /etc/fstab entry.
       * This association runs a script to remove entries for /tmp in /etc/fstab.
       * https://dragonflyft.atlassian.net/browse/AE-857
       *
       */
      new DfSsmRunShellScriptAssociationConstruct(
        this,
        `remove-tmp-entry-from-fstab-${region}`,
        {
          provider: provider,
          targetType: 'tag',
          tagKey: 'os',
          tagValues: ['linux'],
          command: `
        #!/bin/bash
        set -e

        if [ "$(findmnt --fstab --types tmpfs --mount /tmp)" ]; then

          echo "Original /etc/fstab contents:"
          cat /etc/fstab

          backupFileName=/etc/fstab.$(date +%m_%d_%y_%H_%M_%N).bak

          echo "Creating backup file: $backupFileName"
          echo "# This backup was created by the AWS SSM association called remove-tmp-entry-from-fstab-shell-script" > $backupFileName
          cat /etc/fstab >> $backupFileName

          # Remove the line containing "tmpfs /tmp"
          sed -i '\\|^tmpfs /tmp|d' /etc/fstab

          echo "Reloading systemd to load changes to /etc/fstab"

          sudo systemctl daemon-reload

          echo "Entry for /tmp removed and systemd reloaded successfully."

        else

          echo "No entry for /tmp found in /etc/fstab."

        fi

        echo "Checking if /tmp is still mounted with size set to 2G"

        tmpSize=$(findmnt --types tmpfs --mount /tmp --df --noheadings --json | grep -o '"size": "[^"]*"' | cut -d '"' -f4)

        if [ $tmpSize = "2G" ]; then
          echo "/tmp is still sized at 2G. /tmp may have been busy during the last run, so the changes were never applied."

          echo "Attempting to restart tmp.mount to apply changes to fstab..."
          sudo systemctl restart tmp.mount

        else

          echo "/tmp is not sized to 2G. No additional action was taken. Exiting..."

        fi
        `,
        }
      );
    });
  }
}
