import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { CloudwatchLogStream } from '@cdktf/provider-aws/lib/cloudwatch-log-stream';
import { DataAwsCallerIdentity } from '@cdktf/provider-aws/lib/data-aws-caller-identity';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { Ec2ClientVpnNetworkAssociation } from '@cdktf/provider-aws/lib/ec2-client-vpn-network-association';
import { Ec2ClientVpnRoute } from '@cdktf/provider-aws/lib/ec2-client-vpn-route';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { CertRequest } from '@cdktf/provider-tls/lib/cert-request';
import { LocallySignedCert } from '@cdktf/provider-tls/lib/locally-signed-cert';
import { PrivateKey } from '@cdktf/provider-tls/lib/private-key';
import { SelfSignedCert } from '@cdktf/provider-tls/lib/self-signed-cert';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfClientVpnConstruct, DfGatewayVpcConstruct } from '../constructs';
import { Constants, DfAccounts } from '@dragonfly/utils';

describe('Client VPN Construct', () => {
  it('\r\nShould create a Dragonfly Service KMS Key along with a Cloudwatch Log group\r\nand a cloudwatch log stream.  In addition create a \r\nprivate key/self signed cert pair and a \r\nprivate key/cert request/locally signed cert/acm cert pair\r\nthen the ec2clientvpnendpoint, associations to each subnet\r\nand finally the clientvpnroute', () => {
    const ingressId = 'dfIngressVpcConstructId';
    const id = 'dfClientvpnConstructId';
    const synthedMockStack = Testing.synthScope((mockStack) => {
      // Create some object that is synth'able
      const gateway = new DfGatewayVpcConstruct(mockStack, ingressId, {
        vpcCidr: '10.0.0.0/8',
        provider: null,
        federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
        gatewayVpcCidrs:
          DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway
            .legacy,
        region: Constants.AWS_REGION_ALIASES.LEGACY,
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
        externalCustomers: DfAccounts.getCustomersByTypes(['uob', 'eb']),
        deployHybridNetworking: false,
      });
      new DfClientVpnConstruct(mockStack, id, {
        regionalConfig: {
          legacy: {
            provider: null,
            vpc: gateway,
            gatewayVpcCidr: '10.0.0.0/8',
            vpnCidrBlock: '10.1.0.0/16',
          },
          primary: {
            provider: null,
            vpc: gateway,
            gatewayVpcCidr: '10.0.0.0/8',
            vpnCidrBlock: '10.1.0.0/16',
          },
          recovery: {
            provider: null,
            vpc: gateway,
            gatewayVpcCidr: '10.0.0.0/8',
            vpnCidrBlock: '10.1.0.0/16',
          },
        },
        federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
        R53Cname: 'test',
        account: DfAccounts.getNonProdSharedNetworkAccountDef(),
        masterAccountProvider: null,
        authRuleCallback: (id, region) => {
          return;
        },
      });
    });
    const parsedJson = JSON.parse(synthedMockStack);
    const parsedJsonResource = parsedJson['resource'];
    const keyJson = parsedJsonResource['aws_kms_key'];
    // We do this line because the token of the resource is appended to the key in the JSON so we don't know that
    console.log(keyJson);

    const keyPolicy = Object.keys(keyJson)[0];
    const policyJson = JSON.parse(keyJson[keyPolicy]['policy']);

    // vpnEndpoint
    const vpnEndpointParsedJson =
      parsedJsonResource['aws_ec2_client_vpn_endpoint'];
    const keyVpnEndpoint = Object.keys(vpnEndpointParsedJson)[0];
    const vpnEndpointJson = vpnEndpointParsedJson[keyVpnEndpoint];

    expect(synthedMockStack).toHaveDataSource(DataAwsRegion);
    expect(synthedMockStack).toHaveDataSource(DataAwsCallerIdentity);

    expect(synthedMockStack).toHaveResourceWithProperties(SecurityGroup, {
      name: 'clientvpn',
      ingress: [
        {
          cidr_blocks: ['0.0.0.0/0'],
          from_port: 443,
          to_port: 443,
          protocol: 'tcp',
          description: 'Allow incoming Client VPN connections',
          /* need to add these explicitly in the test case*/
          ipv6_cidr_blocks: null,
          prefix_list_ids: null,
          security_groups: null,
          self: null,
        },
      ],
      egress: [
        {
          from_port: 0,
          to_port: 0,
          protocol: '-1',
          cidr_blocks: ['0.0.0.0/0'],
          description: 'Allow all outbound traffic',
          /* need to add these explicitly in the test case*/
          ipv6_cidr_blocks: null,
          prefix_list_ids: null,
          security_groups: null,
          self: null,
        },
      ],
      tags: {
        Name: `clientvpn`,
      },
    });

    expect(policyJson).toMatchObject({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Enable IAM User Permissions',
          Effect: 'Allow',
          Principal: {
            // AWS: `arn:aws:iam::${currentAccountId}:root`,
          },
          Action: 'kms:*',
          Resource: '*',
        },
        {
          Sid: 'Allow CloudWatch',
          Effect: 'Allow',
          Principal: {
            // Service: [`logs.${regionName}.amazonaws.com`],
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
    });

    expect(synthedMockStack).toHaveResourceWithProperties(CloudwatchLogGroup, {
      name: 'clientVpn',
      retention_in_days: 365,
    });

    expect(synthedMockStack).toHaveResource(CloudwatchLogStream);

    expect(synthedMockStack).toHaveResourceWithProperties(PrivateKey, {
      algorithm: 'RSA',
    });

    expect(synthedMockStack).toHaveResourceWithProperties(SelfSignedCert, {
      subject: [
        {
          common_name: 'dragonflyft.vpn.ca',
          organization: 'Dragonfly Financial Technology',
        },
      ],
      validity_period_hours: 87600,
      is_ca_certificate: true,
      allowed_uses: ['cert_signing', 'crl_signing'],
    });

    expect(synthedMockStack).toHaveResourceWithProperties(CertRequest, {
      subject: [
        {
          common_name: 'dragonflyft.vpn.server',
          organization: 'DragonFly Financial Technology',
        },
      ],
    });

    expect(synthedMockStack).toHaveResourceWithProperties(LocallySignedCert, {
      validity_period_hours: 87600,
      allowed_uses: ['key_encipherment', 'digital_signature', 'server_auth'],
    });

    expect(synthedMockStack).toHaveResource(AcmCertificate);

    expect(vpnEndpointJson).toMatchObject({
      split_tunnel: true,
      self_service_portal: 'enabled',
      transport_protocol: 'tcp',
      vpn_port: 443,
      authentication_options: [
        {
          type: 'federated-authentication',
        },
      ],
      connection_log_options: {
        enabled: true,
      },
    });

    /*
     *  How to test vpn association? Is this good enough or should
     * it be more thorough?
     */
    expect(synthedMockStack).toHaveResource(Ec2ClientVpnNetworkAssociation);

    expect(synthedMockStack).toHaveResourceWithProperties(Ec2ClientVpnRoute, {
      destination_cidr_block: '10.0.0.0/8',
      timeouts: {
        create: '5m',
        delete: '5m',
      },
    });
  });
});
