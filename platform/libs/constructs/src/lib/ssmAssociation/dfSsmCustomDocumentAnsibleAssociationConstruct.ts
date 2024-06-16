import { SsmAssociation } from '@cdktf/provider-aws/lib/ssm-association';
import { Construct } from 'constructs';
import {
  DfSsmAnsibleAssociationConfig,
  DfSsmAnsibleAssociationConstruct,
} from '../constructs';
import { SsmDocument } from '@cdktf/provider-aws/lib/ssm-document';

interface DfSsmCustomDocumentAnsibleAssociationConfig
  extends DfSsmAnsibleAssociationConfig {
  command: string[];
  ssmDocumentDescription: string;
}

/**
 * Dragonfly FT implementation of an SSM Association with a custom SSM Document
 */
export class DfSsmCustomDocumentAnsibleAssociationConstruct extends DfSsmAnsibleAssociationConstruct {
  protected readonly config: DfSsmCustomDocumentAnsibleAssociationConfig;
  /**
   *
   * @param {Constuct} scope
   * @param {string} id
   * @param {SsmAssociationConfig} config
   */
  constructor(
    scope: Construct,
    id: string,
    config: DfSsmCustomDocumentAnsibleAssociationConfig
  ) {
    super(scope, id, config);
  }

  override createAssociation(): SsmAssociation {
    const ssmDocument = new SsmDocument(this.scope, `${this.id}-ssm-document`, {
      provider: this.config.provider,
      name: this.config.associationName,
      documentType: 'Command',
      documentFormat: 'JSON',
      content: JSON.stringify({
        schemaVersion: '2.2',
        description: this.config.ssmDocumentDescription,
        mainSteps: [
          {
            action: 'aws:downloadContent',
            name: 'downloadContent',
            inputs: {
              SourceType: 'S3',
              SourceInfo: JSON.stringify({
                path: `https://${this.assetsBucket.bucketDomainName}/ansible.zip`,
              }),
            },
          },
          {
            action: 'aws:runShellScript',
            name: 'runShellScript',
            inputs: {
              timeoutSeconds: '1800',
              runCommand: this.config.command,
            },
          },
        ],
      }),
    });

    return new SsmAssociation(this.scope, `${this.id}-ssm-association`, {
      provider: this.config.provider,
      name: ssmDocument.name,
      associationName: this.config.associationName,
      targets: this.targets,
      outputLocation: {
        s3BucketName: this.assetsBucket.bucket,
        s3KeyPrefix: 'logs',
      },
      dependsOn: [this.assetsObject],
    });
  }
}
