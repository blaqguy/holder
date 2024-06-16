import {
  DataAwsIamPolicyDocument,
  DataAwsIamPolicyDocumentStatement,
} from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { Construct, IConstruct } from 'constructs';
import { PlatformSecrets } from './secrets';
import { Constants } from './constants';
import {
  Aspects,
  Fn,
  S3BackendConfig,
  TerraformProvider,
  TerraformStack,
} from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DfCustomTagsAspect } from './tagging';
import { AccountDefinition, CustomerDefinition, DfAccounts } from './accounts';
import { execSync } from 'child_process';
import { buildSync } from 'esbuild';
import path from 'path';

export type AwsNode = IConstruct & {
  provider?: TerraformProvider;
};

export interface AccountProviderConfig {
  accountName: string;
  accountId: string;
  accountProvisionRole: string;
}

export interface AuthorizedGroupConfig {
  authorizedGroupName: string;
  authorizedGroupId: string;
  authroizedGroupDescription: string;
  authorizedCidr?: string;
}

interface buildLambdaAsssetsConfig {
  lambdaAssetDir: string;
  lambdaAssetBundleDir: string;
}

/**
 *
 */
export class Utils {
  /**
   * @param {string} stackUuid - Takes in the stackUuid
   * @param {string} suffix - Suffix to use for the resource
   * @param {number} index - (Optional) Used if there is more than one resource of the same type with the same suffix
   * @return {string} - `${stackConfig.envName}-${stackUuid}-${suffix}${endSuffix}`
   */
  static createStackResourceId(
    stackUuid: string,
    suffix: string,
    index: number = undefined
  ): string {
    return [stackUuid, suffix, index].filter((x) => x != null).join('-');
  }

  /**
   * DOES NOT TAKE IN STACK NAME
   * @param {string} suffix - Suffix to use for the resource
   * @param {number} index - (Optional) Used if there is more than one resource of the same type with the same suffix
   * @return {string} - `${stackConfig.envName}-${stackUuid}-${suffix}${endSuffix}`
   */
  static createConstructResourceId(
    suffix: string,
    index: number = undefined
  ): string {
    return [suffix, index].filter((x) => x != null).join('-');
  }

  /**
   *
   * @param {Construct} scope - Scope for this policy document
   * @param {string} id - Id for this trust policy document
   * @param {string[]} services - List of services that are allowed to assumeRole
   * @param {AwsProvider} provider - (Optional) Provider to use for this policy document
   * @return {DataAwsIamPolicyDocument} - Returns the new trust policy document
   * Purpose of this method is to create a trust policy document
   */
  static createTrustPolicyDocument(
    scope: Construct,
    id: string,
    services: string[],
    provider?: AwsProvider
  ): DataAwsIamPolicyDocument {
    return new DataAwsIamPolicyDocument(scope, id, {
      provider: provider,
      version: '2012-10-17',
      statement: [
        {
          effect: 'Allow',
          principals: [
            {
              type: 'Service',
              identifiers: services,
            },
          ],
          actions: ['sts:AssumeRole'],
        },
      ],
    });
  }

  /**
   *
   * @param {AccountDefinition} accountDefinition
   * @return {string[]}
   * ! Update these to pull Gateway Cidrs
   */
  static getIngressCidrBlocksByNetworkType(
    accountDefinition: AccountDefinition
  ): string[] {
    const cidrsToReturn: string[] = [];

    if (
      accountDefinition.networkType === 'prod' ||
      accountDefinition.name === 'SharedTools'
    ) {
      cidrsToReturn.push(
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr
      );
      cidrsToReturn.push(
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr
      );
      cidrsToReturn.push(
        DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr
      );
      /**
       * ! Removing this because this util causes for new SGs to be created
       * ! See the SG logic in uob tier
       */
      // DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.primary.additionalCidrs.forEach((cidr) => {
      //   cidrsToReturn.push(cidr);
      // });
      // DfAccounts.getProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery.additionalCidrs.forEach((cidr) => {
      //   cidrsToReturn.push(cidr);
      // });
    }

    if (
      accountDefinition.networkType === 'nonProd' ||
      accountDefinition.name === 'SharedTools'
    ) {
      cidrsToReturn.push(
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.legacy
          .gatewayVpcCidr
      );
      cidrsToReturn.push(
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.primary
          .gatewayVpcCidr
      );
      cidrsToReturn.push(
        DfAccounts.getNonProdSharedNetworkAccountDef().vpcCidrs.gateway.recovery
          .gatewayVpcCidr
      );
    }

    return cidrsToReturn;
  }

  /**
   *
   * @param {Construct} scope - Scope for this policy document
   * @param {string} id - Id for this policy document
   * @param {string[]} actions - List of actions
   * @param {string[]} resources - List of resources
   * @param {DataAwsIamPolicyDocumentStatement[]} additionalStatements - List of additional statements to add onto the policy
   * @param {AwsProvider} provider - (Optional) Provider to use for this policy document
   * @return {DataAwsIamPolicyDocument} - Returns the new policy document
   * Purpose of this method is to create a policy document
   */
  static createPolicyDocument(
    scope: Construct,
    id: string,
    actions: string[],
    resources: string[],
    additionalStatements?: DataAwsIamPolicyDocumentStatement[],
    provider?: AwsProvider
  ): DataAwsIamPolicyDocument {
    return new DataAwsIamPolicyDocument(scope, id, {
      provider: provider,
      version: '2012-10-17',
      statement: [
        {
          effect: 'Allow',
          actions: actions,
          resources: resources,
        },
        ...(additionalStatements ? additionalStatements : []),
      ],
    });
  }

  /**
   * @param {Construct.node} node - Takes in the stackUuid
   * @return {PlatformSecrets} - Structured json data with stored secrets found in secret.sops.json file
   * Retrieve sops data from node context that contains secret credentials
   */
  static getSecretsForNode(node: Construct['node']): PlatformSecrets {
    return node.tryGetContext('sopsData');
  }

  /**
   *
   * @param {string} alias
   * @param {'LEGACY' | 'DF_PRIMARY' | 'DF_RECOVERY'} supportedRegion - The region that the provider should be created for
   * @return {string}
   */
  static awsProviderAliasHelper(
    alias: string,
    supportedRegion: Constants.AWS_REGION_ALIASES
  ) {
    if (supportedRegion === 'LEGACY') {
      return `${alias}FederatedProvider`;
    } else {
      return `${alias}FederatedProvider${supportedRegion}`;
    }
  }

  /**
   *
   * @param {TerraformStack} stack
   * @param {string} alias
   * @param {Constants.AWS_REGION_ALIASES} supportedRegion
   * @return {AwsProvider}
   */
  static getAwsProvider(
    stack: TerraformStack,
    alias: string,
    supportedRegion: Constants.AWS_REGION_ALIASES
  ): AwsProvider {
    const providerAlias = this.awsProviderAliasHelper(alias, supportedRegion);
    const matchingProviders = stack.allProviders().filter((provider) => {
      return provider.alias === providerAlias;
    });

    if (matchingProviders.length === 0) {
      throw new Error(
        `No matching providers found for alias: ${providerAlias}`
      );
    }

    if (matchingProviders.length > 1) {
      throw new Error(
        `More than one matching provider found for alias: ${providerAlias}`
      );
    }

    return matchingProviders.pop() as AwsProvider;
  }

  /**
   *
   * @param {IConstruct} node
   * @return {AwsNode}
   */
  static isAwsNode(node: IConstruct): node is AwsNode {
    return (node.constructor['tfResourceType'] as string)?.startsWith('aws_');
  }

  /**
   *
   * @param {string} accountId
   * @return {string}
   */
  static getLogRetention(accountId: string): number {
    return Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(accountId) ? 365 : 30;
  }

  /**
   * @param {string} region
   * @param {string} calledFrom
   * @return {Constants.AWS_REGION_ALIASES}
   */
  static getRegionAliasFromRegion(
    region: string
  ): Constants.AWS_REGION_ALIASES {
    if (region === undefined) {
      throw new Error('Value provided for region variable cannot be undefined');
    }

    const supportedRegions = Object.values(Constants.AWS_REGION_MAP);

    if (!supportedRegions.includes(region)) {
      throw new Error(
        `Provided region variable ${region} does not exist in ${supportedRegions}.`
      );
    }

    const regionMapKey = Object.keys(Constants.AWS_REGION_MAP).find(
      (key: Constants.AWS_REGION_ALIASES) =>
        Constants.AWS_REGION_MAP[key] === region
    );

    const regionAliasKey = Object.keys(Constants.AWS_REGION_ALIASES).find(
      (key) =>
        Constants.AWS_REGION_ALIASES[
          key as keyof typeof Constants.AWS_REGION_ALIASES
        ] === regionMapKey
    );

    if (regionMapKey === undefined) {
      throw new Error(
        `Could not find key in AWS_REGION_MAP with a value of ${region}. Valid values are ${Object.values(
          Constants.AWS_REGION_MAP
        )}.`
      );
    } else if (regionAliasKey === undefined) {
      throw new Error(
        `Could not find key ${regionMapKey} in AWS_REGION_ALIASES - Valid keys are ${Object.keys(
          Constants.AWS_REGION_ALIASES
        )}.`
      );
    }
    return Constants.AWS_REGION_ALIASES[regionAliasKey];
  }

  /**
   * @return {AccountProviderConfig}
   */
  static getMasterAccountProviderConfig(): AccountProviderConfig {
    return {
      accountId: Constants.ACCOUNT_NUMBER_MASTER,
      accountName: Constants.ENVIRONMENT_NAME_MASTER,
      accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
    };
  }

  /**
   * @param {boolean} isPlatformSandbox
   * @param {boolean} isNonProd
   * @return {AccountProviderConfig}
   */
  static getSharedNetworkAccountProviderConfig(
    isPlatformSandbox = false,
    isNonProd = false
  ): AccountProviderConfig {
    if (isPlatformSandbox)
      return {
        accountId: Constants.ACCOUNT_NUMBER_PLATFORM_SANDBOX_SHARED_NETWORK,
        accountName: Constants.ENVIRONMENT_NAME_PLATFORM_SANDBOX_SHARED_NETWORK,
        accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
      };
    else if (isNonProd)
      return {
        accountId: DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber,
        accountName: DfAccounts.getNonProdSharedNetworkAccountDef().name,
        accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
      };
    return {
      accountId: Constants.ACCOUNT_NUMBER_SHARED_NETWORK,
      accountName: Constants.ENVIRONMENT_NAME_SHARED_NETWORK,
      accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
    };
  }

  static getSharedAccountProviderConfig(
    AccountDefinition: AccountDefinition
  ): AccountProviderConfig {
    switch (AccountDefinition.accountType) {
      case 'uat': {
        return {
          accountId: DfAccounts.getSharedUatAccountDef().accountNumber,
          accountName: DfAccounts.getSharedUatAccountDef().name,
          accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
        };
      }
      case 'prod': {
        return {
          accountId: DfAccounts.getSharedProdAccountDef().accountNumber,
          accountName: DfAccounts.getSharedProdAccountDef().name,
          accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
        };
      }
      default: {
        throw new Error(
          `DF ERROR: Account type ${AccountDefinition.accountType} is not a supported shared account type`
        );
      }
    }
  }

  /**
   * @return {AccountProviderConfig}
   *  ! I did this so I wouldn't have to change a bunch of code. Will refactor later
   */
  static getNonProdSharedNetworkAccountProviderConfig(): AccountProviderConfig {
    return {
      accountId: DfAccounts.getNonProdSharedNetworkAccountDef().accountNumber,
      accountName: DfAccounts.getNonProdSharedNetworkAccountDef().name,
      accountProvisionRole: Constants.ROLE_PROVISION_ROLE_NAME,
    };
  }

  /**
   *
   * @param {string} accountNumber
   * @return {boolean}
   */
  static isPlatformSandboxTypeEnvironment(accountNumber: string): boolean {
    return Constants.PLATFORM_SANDBOX_ACCOUNT_NUMBERS.includes(accountNumber);
  }

  /**
   * @param {TerraformResource | TerraformDataSource} resource
   */
  static addPublicTag(resource: IConstruct) {
    Aspects.of(resource).add(
      new DfCustomTagsAspect({
        public: 'true',
      })
    );
  }

  /**
   * Just a little jank to convert a Typescript string[] to something parsable by Ansible
   * The end result is a single string formatted like this: "one two three"
   *
   * Templated example: cidr_allow_list: "{{ cidr_allow_list }}"
   * Rendered example: cidr_allow_list: "one two three"
   *
   * Loop example: loop: "{{ cidr_allow_list | split }}"
   *
   * @param {string[]} stringArray
   * @return {string}
   */
  static stringArrayToYamlArray(stringArray: string[]): string {
    let yamlArray = '';
    stringArray.forEach((value: string) => {
      yamlArray = yamlArray + `${value} `;
    });
    return yamlArray.trim();
  }

  /**
   * Chunks an array into many array of given size
   *
   * @param {string[]} inputArray - array to chunk
   * @param {number} chunkSize - size of chunks
   * @return {string[][]} array of chunked arrays
   */

  static arrayChunker(inputArray: string[], chunkSize: number): string[][] {
    const chunkedArrays: string[][] = [];

    for (let index = 0; index < inputArray.length; index += chunkSize) {
      const chunk = inputArray.slice(index, index + chunkSize);
      chunkedArrays.push(chunk);
    }

    return chunkedArrays;
  }

  static getCustomerSubnetTerraformOutputName(
    customerName: string,
    azCidrKey: string
  ) {
    return `customer-subnet-${customerName}-${azCidrKey}`;
  }

  static isEnvironmentProdLike(accountDefinition: AccountDefinition) {
    return (
      accountDefinition.accountType === 'prod' ||
      accountDefinition.accountType === 'uat' ||
      accountDefinition.accountType === 'prodNetwork'
    );
  }

  static isEnvironmentProd(accountDefinition: AccountDefinition) {
    return accountDefinition.accountType === 'prod';
  }

  static isProdLikeCustomerEnvironment(
    accountDefinition: AccountDefinition,
    customerDefinition: CustomerDefinition
  ) {
    return (
      this.isEnvironmentProdLike(accountDefinition) &&
      (customerDefinition.customerType === 'uob' ||
        customerDefinition.customerType === 'eb')
    );
  }

  static isSharedAccount(accountDefinition: AccountDefinition): boolean {
    const sharedAccountNames = DfAccounts.getSharedAccounts().map((account) => {
      return account.name;
    });

    return sharedAccountNames.includes(accountDefinition.name);
  }

  static deployToRecoveryRegion(accountDefinition: AccountDefinition) {
    return (
      Utils.isEnvironmentProdLike(accountDefinition) &&
      !(accountDefinition.refrainFromRecoveryDeployment ?? false)
    );
  }
  // Builds lambda assets for any new lambda
  static buildLambdaAsssets(config: buildLambdaAsssetsConfig) {
    if (process.env.SKIP_LAMBDA) {
      console.info('env var SKIP_LAMBDA is set, skipping lambda build steps');
      return;
    }

    try {
      execSync('npm install', {
        cwd: config.lambdaAssetDir,
        stdio: 'inherit',
      });

      // Transpiles typescript code into Javascript
      buildSync({
        entryPoints: [path.resolve(config.lambdaAssetDir, 'src/index.ts')],
        bundle: true,
        platform: 'node',
        target: 'es2018',
        outdir: config.lambdaAssetBundleDir,
      });
    } catch (error) {
      console.error(`Error running npm install: ${error}`);
    }
  }

  static objContainsFalsyValue(obj: { [key: string]: string }): {
    [key: string]: string;
  } {
    Object.entries(obj).forEach(([key, value]) => {
      this.checkUndefinedValue(value, key);
    });
    return obj;
  }
  static checkUndefinedValue(value: string | undefined, key?: string): string {
    if (value === undefined) {
      throw new Error(`${key} is undefined`);
    }
    return value;
  }

  static getDragonflyAppSubnetsFromCidr(cidrBlock: string) {
    return [...Array(3).keys()].map((i) => {
      return Fn.cidrsubnet(cidrBlock, 4, i + 3);
    });
  }

  static getDragonflyDataSubnetsFromCidr(cidrBlock: string) {
    return [...Array(3).keys()].map((i) => {
      return Fn.cidrsubnet(cidrBlock, 4, i + 6);
    });
  }

  static createS3BackendProps(stackUuid: string, envName: string) {
    return {
      bucket: Constants.STATE_BUCKET_NAME,
      key: `${envName}-${stackUuid}/state`,
      roleArn: `arn:aws:iam::${Constants.STATE_ACCOUNT_ID}:role/${Constants.STATE_ROLE_NAME}`,
      externalId: 'state-admin',
      // TODO: Pull default sessions from the ENV
      sessionName: 'terraformer-stating',
    };
  }

  static getNetworkS3BackendProps(
    regionAlias: Constants.AWS_REGION_ALIASES,
    networkType: string,
    envName: string
  ): S3BackendConfig {
    let vpcStackId: string;

    switch (regionAlias) {
      case Constants.AWS_REGION_ALIASES.LEGACY:
        switch (networkType) {
          case 'prod':
            vpcStackId = Constants.PROD_LEGACY_SHARED_NETWORK_STACK_ID;
            break;
          case 'nonProd':
            vpcStackId = Constants.NON_PROD_LEGACY_SHARED_NETWORK_STACK_ID;
            break;
          case 'ps':
            vpcStackId = Constants.PS_LEGACY_SHARED_NETWORK_STACK_ID;
            break;
          default:
            throw new Error(
              'DF ERROR: Combination of network type and region invalid'
            );
        }
        break;
      case Constants.AWS_REGION_ALIASES.DF_PRIMARY:
        switch (networkType) {
          case 'prod':
            vpcStackId = Constants.PROD_PRIMARY_SHARED_NETWORK_STACK_ID;
            break;
          case 'nonProd':
            vpcStackId = Constants.NON_PROD_PRIMARY_SHARED_NETWORK_STACK_ID;
            break;
          case 'ps':
            vpcStackId = Constants.PS_PRIMARY_SHARED_NETWORK_STACK_ID;
            break;
          default:
            throw new Error(
              'DF ERROR: Combination of network type and region invalid'
            );
        }
        break;
      case Constants.AWS_REGION_ALIASES.DF_RECOVERY:
        switch (networkType) {
          case 'prod':
            vpcStackId = Constants.PROD_RECOVERY_SHARED_NETWORK_STACK_ID;
            break;
          case 'nonProd':
            vpcStackId = Constants.NON_PROD_RECOVERY_SHARED_NETWORK_STACK_ID;
            break;
          case 'ps':
            vpcStackId = Constants.PS_RECOVERY_SHARED_NETWORK_STACK_ID;
            break;
          default:
            throw new Error(
              'DF ERROR: Combination of network type and region invalid'
            );
        }
        break;
    }
    return Utils.createS3BackendProps(vpcStackId, envName);
  }

  /**
   *
   * Wacky bitwise math to check if an IP is in a CIDR
   * The same logic is used in cloudfrontFunctions/frbMaintenanceRedirect.ts as a cloudfront function
   *
   * @param {string} ip
   * @param {string} cidr
   * @return {boolean}
   */
  public static isIpInCidr(ip: string, cidr: string[]): boolean {
    function ipIsInCidr(ip: string, cidr: string) {
      const cidrIp = cidr.split('/')[0];
      const cidrSm = cidr.split('/')[1];
      return (ipNumber(ip) & ipMask(cidrSm)) == ipNumber(cidrIp);
    }

    function ipNumber(ipAddress: string) {
      const ip = ipAddress.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ip) {
        return (+ip[1] << 24) + (+ip[2] << 16) + (+ip[3] << 8) + +ip[4];
      }
      return null;
    }

    function ipMask(maskSize) {
      return -1 << (32 - maskSize);
    }

    function ipIsInAnyCidr(ip: string, cidrRanges: string[]) {
      for (let i = 0; i < cidrRanges.length; i++) {
        if (ipIsInCidr(ip, cidrRanges[i])) {
          return true;
        }
      }
      return false;
    }

    return ipIsInAnyCidr(ip, cidr);
  }
}
