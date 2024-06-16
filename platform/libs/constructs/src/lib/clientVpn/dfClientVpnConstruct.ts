import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { CertRequest } from '@cdktf/provider-tls/lib/cert-request';
import { LocallySignedCert } from '@cdktf/provider-tls/lib/locally-signed-cert';
import { PrivateKey } from '@cdktf/provider-tls/lib/private-key';
import { SelfSignedCert } from '@cdktf/provider-tls/lib/self-signed-cert';
import { TerraformAsset, AssetType, Fn } from 'cdktf';
import { Construct } from 'constructs';
import path from 'path';
import { IamSamlProvider } from '@cdktf/provider-aws/lib/iam-saml-provider';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { CloudwatchLogStream } from '@cdktf/provider-aws/lib/cloudwatch-log-stream';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { AccountDefinition, Constants, DfAccounts } from '@dragonfly/utils';
import { Ec2ClientVpnEndpoint } from '@cdktf/provider-aws/lib/ec2-client-vpn-endpoint';
import { Ec2ClientVpnAuthorizationRule } from '@cdktf/provider-aws/lib/ec2-client-vpn-authorization-rule';
import { Ec2ClientVpnNetworkAssociation } from '@cdktf/provider-aws/lib/ec2-client-vpn-network-association';
import { Ec2ClientVpnRoute } from '@cdktf/provider-aws/lib/ec2-client-vpn-route';
import { Route53HealthCheck } from '@cdktf/provider-aws/lib/route53-health-check';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { DfAliasedKeyConstruct } from '../constructs';
import { RegionConfig, RegionalConfig } from './helpers/types';

/**
 * Represents the configuration object for the ReDfClientVpnConstruct
 * @property {RegionalConfig} regionalConfig - The regional configuration object for the ReDfClientVpnConstruct
 * @property {string} federatedAccountId - The federated account ID to use for the creation of the ReDfClientVpnConstruct
 * @property {string} R53Cname - The CNAME to use for the creation of the ReDfClientVpnConstruct. Used for load balancing across regions.
 * @property {AwsProvider} masterAccountProvider - The master account provider to use for the creation of the ReDfClientVpnConstruct. Used for the creation of the Route53 records.
 * @property {AccountDefinition} account - The account definition object to use for the creation of the ReDfClientVpnConstruct
 */
export interface DfClientVpnConstructConfig {
  /**
   * The regional configuration object for the ReDfClientVpnConstruct
   */
  regionalConfig: RegionalConfig;
  /**
   * The federated account ID to use for the creation of the ReDfClientVpnConstruct
   */
  federatedAccountId: string;
  /**
   * The CNAME to use for the creation of the ReDfClientVpnConstruct. Used for load balancing across regions.
   */
  R53Cname: string;
  /**
   * The master account provider to use for the creation of the ReDfClientVpnConstruct. Used for the creation of the Route53 records.
   */
  masterAccountProvider: AwsProvider;
  /**
   * The account definition object to use for the creation of the ReDfClientVpnConstruct
   */
  account: AccountDefinition;

  authRuleCallback: (
    clientVpnId: string,
    region: RegionConfig<AwsProvider>,
    regionConstructIndex: number,
    nodeScope: Construct
  ) => void;
}

/**
 * * This construct creates the client vpn endpoint and all the dependant resources
 */
export class DfClientVpnConstruct extends Construct {
  private readonly clientVpnEndpoints: Ec2ClientVpnEndpoint[] = [];
  /**
   * @param {Construct} scope - The parent construct
   * @param {string} id - The construct ID
   * @param {DfClientVpnConstructConfig} config - The configuration object for the ReDfClientVpnConstruct
   */
  constructor(
    scope: Construct,
    id: string,
    config: DfClientVpnConstructConfig
  ) {
    super(scope, id);

    // * Get all providers and filter out falsey values
    const deploymentRegions = Object.values(config.regionalConfig);

    // * Get the sso config file for the client vpn
    const clientVpnXml = new TerraformAsset(this, 'clientVpnXml', {
      path: path.resolve(__dirname, 'files/AWSClientVPN.xml'),
      type: AssetType.FILE,
    });

    const samlProvider = new IamSamlProvider(this, 'clientVpnSamlProvider', {
      name:
        config.federatedAccountId ===
        DfAccounts.getProdSharedNetworkAccountDef().accountNumber
          ? 'client-vpn-saml-provider-prod'
          : 'clientVpnSamlProvider',
      samlMetadataDocument: Fn.file(clientVpnXml.path),
      tags: {
        Name:
          config.federatedAccountId ===
          DfAccounts.getProdSharedNetworkAccountDef().accountNumber
            ? 'client-vpn-saml-provider-prod'
            : 'client-vpn-saml-provider',
      },
    });

    // * Create Certificate for the Client VPN
    const privateCaKey = new PrivateKey(this, `${id}-clientVpnPrivateKeyCA`, {
      algorithm: 'RSA',
    });

    const caCert = new SelfSignedCert(this, `${id}-clientVpnSelfSignedCertCA`, {
      allowedUses: ['cert_signing', 'crl_signing'],
      privateKeyPem: privateCaKey.privateKeyPem,
      validityPeriodHours: 87600,
      isCaCertificate: true,
      subject: [
        {
          commonName: 'dragonflyft.vpn.ca',
          organization: 'Dragonfly Financial Technology',
        },
      ],
    });

    const privateServerKey = new PrivateKey(
      this,
      `${id}-clientVpnPrivateKeyServer`,
      {
        algorithm: 'RSA',
      }
    );

    const serverCertRequest = new CertRequest(
      this,
      `${id}-clientVpnCertRequestServer`,
      {
        privateKeyPem: privateServerKey.privateKeyPem,
        subject: [
          {
            commonName: 'dragonflyft.vpn.server',
            organization: 'DragonFly Financial Technology',
          },
        ],
      }
    );

    const serverCert = new LocallySignedCert(
      this,
      `${id}-clientVpnLocallySignedCertServer`,
      {
        caCertPem: caCert.certPem,
        caPrivateKeyPem: privateCaKey.privateKeyPem,
        certRequestPem: serverCertRequest.certRequestPem,
        validityPeriodHours: 87600,
        allowedUses: ['key_encipherment', 'digital_signature', 'server_auth'],
      }
    );

    let catchAllCvpnCnameCreated = false;

    deploymentRegions.forEach((region, index) => {
      const serverCertAcm = new AcmCertificate(
        this,
        `${id}-clientVpnServerAcmCertificate${index}`,
        {
          provider: region.provider,
          privateKey: privateServerKey.privateKeyPem,
          certificateBody: serverCert.certPem,
          certificateChain: caCert.certPem,
          tags: { Name: `${id}-client-vpn` },
        }
      );

      // * Create dependant resources for the Client VPN
      const regionName = new DataAwsRegion(this, `regionName-${index}`, {
        provider: region.provider,
      }).name;

      const clientVpnSg = new SecurityGroup(
        this,
        `${id}-clientVpnSecurityGroup-${index}`,
        {
          provider: region.provider,
          name: 'clientvpn',
          vpcId: region.vpc.vpcId,
          ingress: [
            {
              fromPort: 443,
              toPort: 443,
              protocol: 'tcp',
              cidrBlocks: ['0.0.0.0/0'],
              description: 'Allow incoming Client VPN connections',
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
            Name: 'clientvpn',
          },
        }
      );

      const cloudWatchKmsKey = new DfAliasedKeyConstruct(
        this,
        `kms-key-${index}`,
        {
          provider: region.provider,
          name: `cvpn-cloudwatch-${regionName}`,
          description: 'Client VPN CloudWatch Kms Key',
        }
      );
      cloudWatchKmsKey.key.addOverride(
        'policy',
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'Enable IAM User Permissions',
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${config.federatedAccountId}:root`,
              },
              Action: 'kms:*',
              Resource: '*',
            },
            {
              Sid: 'Allow CloudWatch',
              Effect: 'Allow',
              Principal: {
                Service: [`logs.${regionName}.amazonaws.com`],
              },
              Action: [
                'kms:Encrypt*',
                'kms:Decrypt*',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
                'kms:Describe*',
              ],
              Resource: '*',
            },
          ],
        })
      );

      const logGroup = new CloudwatchLogGroup(
        this,
        `${id}-clientVpnLogGroup-${index}`,
        {
          provider: region.provider,
          name: 'clientVpn',
          retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
            config.federatedAccountId
          )
            ? 365
            : 30,
          kmsKeyId: cloudWatchKmsKey.key.arn,
          tags: {
            Name: `cvpn-${regionName}`,
          },
        }
      );

      const logStream = new CloudwatchLogStream(
        this,
        `${id}-clientVpnLogStream-${index}`,
        {
          provider: region.provider,
          name: `cvpn-${regionName}`,
          logGroupName: logGroup.name,
        }
      );

      // * Create the Client VPN Endpoint
      const clientVpnEndpoint = new Ec2ClientVpnEndpoint(
        this,
        `${id}-Endpoint-${index}`,
        {
          provider: region.provider,
          description: 'Dragonfly Client VPN Endpoint',
          serverCertificateArn: serverCertAcm.arn,
          clientCidrBlock: region.vpnCidrBlock,
          splitTunnel: true,
          selfServicePortal: 'enabled',
          transportProtocol: 'tcp',
          vpnPort: 443,
          dnsServers: [Fn.cidrhost(region.vpc.vpcCidrBlock, 2)],
          authenticationOptions: [
            {
              type: 'federated-authentication',
              samlProviderArn: samlProvider.arn,
              selfServiceSamlProviderArn: samlProvider.arn,
            },
          ],
          connectionLogOptions: {
            enabled: true,
            cloudwatchLogGroup: logGroup.name,
            cloudwatchLogStream: logStream.name,
          },
          tags: {
            Name: `${id}-endpoint`,
          },
          sessionTimeoutHours: 12,
          securityGroupIds: [clientVpnSg.id],
        }
      );
      this.clientVpnEndpoints.push(clientVpnEndpoint);

      /**
       * If VPC is a gateway VPC, use CVPN subnets else use public subnets
       */
      region.vpc.cvpnSubnetIds.forEach((subnetId, i) => {
        new Ec2ClientVpnNetworkAssociation(
          this,
          `${id}-NetworkAssociation${index}-${i}`,
          {
            provider: region.provider,
            clientVpnEndpointId: clientVpnEndpoint.id,
            subnetId: subnetId,
          }
        );

        new Ec2ClientVpnRoute(this, `RouteToSpokes-subnet${index}-${i}`, {
          provider: region.provider,
          clientVpnEndpointId: clientVpnEndpoint.id,
          destinationCidrBlock: '10.0.0.0/8',
          targetVpcSubnetId: subnetId,
          timeouts: {
            create: '5m',
            delete: '5m',
          },
        });
      });

      // new Ec2ClientVpnAuthorizationRule(
      //   this,
      //   `${id}-AuthorizationRuleAllowAll-${index}`,
      //   {
      //     provider: region.provider,
      //     clientVpnEndpointId: clientVpnEndpoint.id,
      //     targetNetworkCidr: '10.0.0.0/8',
      //     authorizeAllGroups: true,
      //     description: `Allows access to all users on the VPN`,
      //   }
      // );

      config.authRuleCallback(clientVpnEndpoint.id, region, index, this);

      // * Create Authorization Rules to all 3 region's ingress vpcs
      deploymentRegions.forEach((r, i) => {
        new Ec2ClientVpnAuthorizationRule(
          this,
          `${id}-AuthorizationRuleAllIngressVpc-${index}-${i}`,
          {
            provider: region.provider,
            clientVpnEndpointId: clientVpnEndpoint.id,
            targetNetworkCidr: r.vpc.vpcCidrBlock,
            authorizeAllGroups: true,
            description: `Authorize access to Cross Region ${regionName} Ingress VPC resources for everyone`,
          }
        );

        if (r.gatewayVpcCidr !== region.gatewayVpcCidr) {
          /**
           * * If VPC is a gateway VPC, use CVPN subnets else use public subnets
           */
          region.vpc.cvpnSubnetIds.forEach((subnetId, I) => {
            new Ec2ClientVpnRoute(
              this,
              `RouteToCrossRegionVpcs${index}-${i}-${I}`,
              {
                provider: region.provider,
                clientVpnEndpointId: clientVpnEndpoint.id,
                destinationCidrBlock: r.vpc.vpcCidrBlock,
                targetVpcSubnetId: subnetId,
                timeouts: {
                  create: '5m',
                  delete: '5m',
                },
              }
            );
          });
        }
      });

      /**
       * * Enable R53 health checks and dns name for the Client VPN Endpoint
       * * https://aws.amazon.com/blogs/networking-and-content-delivery/building-multi-region-aws-client-vpn-with-microsoft-active-directory-and-amazon-route-53/
       */

      const cvpnHealthCheck = new Route53HealthCheck(
        this,
        `${id}-HealthCheck-${index}`,
        {
          provider: config.masterAccountProvider,
          fqdn: Fn.replace(clientVpnEndpoint.dnsName, '*', 'healthcheck'),
          type: 'TCP',
          port: 443,
          requestInterval: 30,
        }
      );

      const cvpnLatencyRecord = new Route53Record(
        this,
        `${id}-latency-record-${index}`,
        {
          provider: config.masterAccountProvider,
          name: config.R53Cname,
          type: 'CNAME',
          records: [clientVpnEndpoint.dnsName],
          zoneId: Constants.DRAGONFLYFT_PUBLIC_HOSTED_ZONE_ID,
          latencyRoutingPolicy: {
            region: regionName,
          },
          healthCheckId: cvpnHealthCheck.id,
          setIdentifier: `${regionName}-client-vpn`,
          ttl: 300,
        }
      );

      if (!catchAllCvpnCnameCreated) {
        new Route53Record(this, `${id}-simple-record-${index}`, {
          provider: config.masterAccountProvider,
          name: `*.${config.R53Cname}`,
          type: 'CNAME',
          records: [cvpnLatencyRecord.fqdn],
          zoneId: Constants.DRAGONFLYFT_PUBLIC_HOSTED_ZONE_ID,
          ttl: 300,
        });
        catchAllCvpnCnameCreated = true;
      }
    });

    deploymentRegions.forEach((region, index) => {
      Object.values(config.account.vpcCidrs.inspection).forEach(
        (cidr, cidrIndex) => {
          new Ec2ClientVpnAuthorizationRule(
            this,
            `${id}-AuthToInspection-${index}-${cidrIndex}`,
            {
              provider: region.provider,
              clientVpnEndpointId: this.clientVpnEndpoints[index].id,
              targetNetworkCidr: cidr,
              authorizeAllGroups: true,
              description: `Allows access to all users on the VPN`,
            }
          );

          region.vpc.cvpnSubnetIds.forEach((subnetId, subnetIndex) => {
            new Ec2ClientVpnRoute(
              this,
              `RouteToInspection${index}-${cidrIndex}-${subnetIndex}`,
              {
                provider: region.provider,
                clientVpnEndpointId: this.clientVpnEndpoints[index].id,
                destinationCidrBlock: cidr,
                targetVpcSubnetId: subnetId,
                timeouts: {
                  create: '5m',
                  delete: '5m',
                },
              }
            );
          });
        }
      );
    });
  }

  /**
   * @return {string[]} - The list of client vpn endpoint ids
   */
  public get clientVpnEndpointsId(): string[] {
    return this.clientVpnEndpoints.map((cvpn) => cvpn.id);
  }
}
