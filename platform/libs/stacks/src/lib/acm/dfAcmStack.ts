import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { RemoteStack, StackConfig } from '../stacks';
import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { AccountProviderConfig, Constants, Utils } from '@dragonfly/utils';
import { TerraformProvider } from 'cdktf';

interface DfAcmConfig {
  domainName: string;
  subjectAlternativeNames: string[];
  masterProviderAccountConfig: AccountProviderConfig;
}

/**
 *
 */
export class DfAcmStack extends RemoteStack {
  private acmCert: AcmCertificate;
  private masterProvider: TerraformProvider;

  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   * @param {DfAcmConfig} dfAcmConfig - Cloudfront config used in the stack
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    private dfAcmConfig: DfAcmConfig
  ) {
    super(stackName, stackConfig);

    this.masterProvider = this.createAwsProvider({
      supportedRegion: Constants.AWS_REGION_ALIASES.LEGACY,
      forAccount: dfAcmConfig.masterProviderAccountConfig,
    });
    this.createAcm(dfAcmConfig);
  }

  /**
   * Creates an ACM certificate and validates the ownership of the domain
   * @param {DfAcmConfig} dfAcmConfig - stack config
   */
  private createAcm(dfAcmConfig: DfAcmConfig) {
    // Master Provider
    const rootZone = new DataAwsRoute53Zone(this, 'RootDragonflyFtZone', {
      provider: this.masterProvider,
      name: 'dragonflyft.com',
    });

    this.acmCert = new AcmCertificate(
      this,
      Utils.createStackResourceId(this.stackUuid, 'AcmCert'),
      {
        domainName: dfAcmConfig.domainName,
        subjectAlternativeNames: dfAcmConfig.subjectAlternativeNames,
        validationMethod: 'DNS',
        tags: { Name: dfAcmConfig.domainName.replace('*', 'wildcard') }, // * is not a valid character for tags. .replace()
      }
    );

    new Route53Record(this, 'CaaRecord', {
      provider: this.masterProvider,
      zoneId: rootZone.id,
      name: '',
      type: 'CAA',
      ttl: 300,
      records: [
        '0 issue "amazon.com"',
        '0 issuewild "amazon.com"',
        '0 issue "amazontrust.com"',
        '0 issuewild "amazontrust.com"',
        '0 issue "awstrust.com"',
        '0 issuewild "awstrust.com"',
        '0 issue "amazonaws.com"',
        '0 issuewild "amazonaws.com"',
        '0 issue "sectigo.com"',
        '0 issuewild "sectigo.com"',
        '0 issue "trust-provider.com"',
        '0 issuewild "trust-provider.com"',
        '0 issue "usertrust.com"',
        '0 issuewild "usertrust.com"',
        '0 issue "pki.goog"',
      ],
    });

    const recordFqdnList: string[] = [];

    // Adding one to the total number of subjectAlternativeNames to include the domainName
    for (
      let index = 0;
      index < dfAcmConfig.subjectAlternativeNames.length + 1;
      index++
    ) {
      // Create domain name Route53 record in Master Provider
      const record = new Route53Record(
        this,
        Utils.createStackResourceId(
          this.stackUuid,
          `CertValidationRecord${index}`
        ),
        {
          provider: this.masterProvider,
          name: this.acmCert.domainValidationOptions.get(index)
            .resourceRecordName,
          type: this.acmCert.domainValidationOptions.get(index)
            .resourceRecordType,
          records: [
            this.acmCert.domainValidationOptions.get(index).resourceRecordValue,
          ],
          zoneId: rootZone.id,
          ttl: 60,
          allowOverwrite: true,
        }
      );
      recordFqdnList.push(record.fqdn);
    }

    // Create an ACM cert validation in Master Provider for the acm cert using all of the wildcar domains as validation records
    new AcmCertificateValidation(
      this,
      Utils.createStackResourceId(this.stackUuid, `CertValidation`),
      {
        certificateArn: this.acmCert.arn,
        validationRecordFqdns: recordFqdnList,
      }
    );
  }

  /**
   * Returns the Acm cert resource
   */
  public get acm() {
    return this.acmCert;
  }
}
