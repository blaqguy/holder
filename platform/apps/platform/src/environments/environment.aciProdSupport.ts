import {
  DfAciSendGridProxyStack,
  DfBuildAutomationRoleStack,
  DfEcrDeployStack,
  DfIsolatedVpcStack,
  DfReverseProxyStack,
  RemoteStack,
} from '@dragonfly/stacks';
import { App, TerraformStack } from 'cdktf';
import { AccountDefinition, Constants, DfAccounts } from '@dragonfly/utils';
import MasterEnvironment from './environment.master';
import { DfAlb } from '../crossEnvironmentHelpers/dfAlb';
import { IsolatedNetworkEnvironment } from './isolatedNetworkEnvironment';

/** Aci Prod Support Env */
export default class AciProdSupportEnvironment extends IsolatedNetworkEnvironment {
  private static instance: AciProdSupportEnvironment;
  private sendgridPrimaryReverseProxy: DfReverseProxyStack;
  private sendgridRecoveryReverseProxy: DfReverseProxyStack;

  /**
   *
   * @return {TerraformStack[]}
   */
  protected createStacks(): TerraformStack[] {
    super.createNetworkStacks();
    new DfBuildAutomationRoleStack(
      'build-automation-role-stack',
      this.stackConfig
    );

    this.createEcr();

    this.createSendGridProxy();

    return this.handler;
  }

  /**
   *  Creates Ecr Respository in this environment
   */
  private createEcr(): void {
    new DfEcrDeployStack(
      Constants.INTERNAL_SENDGRID_REVERSE_PROXY,
      this.stackConfig,
      {
        accountId: Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT,
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      }
    );

    new DfEcrDeployStack(
      Constants.INTERNAL_SENDGRID_REVERSE_PROXY_RECOVERY,
      this.stackConfig,
      {
        accountId: Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT,
        region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      }
    );
  }

  /**
   *  Creates internal sendgrid proxy
   */
  private createSendGridProxy(): void {
    const primaryInternalAlb = this.createSendGridTask({
      vpcStack: this.vpcPrimary,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      suffix: '',
    });

    const recoveryInternalAlb = this.createSendGridTask({
      vpcStack: this.vpcRecovery,
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      suffix: '-recovery',
    });

    this.sendgridPrimaryReverseProxy = this.createSendGridReverseProxy({
      vpcStack: this.vpcPrimary,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      suffix: '',
      albArn: primaryInternalAlb.targetGroupArn,
    });

    this.sendgridRecoveryReverseProxy = this.createSendGridReverseProxy({
      vpcStack: this.vpcRecovery,
      region: Constants.AWS_REGION_ALIASES.DF_RECOVERY,
      suffix: '-recovery',
      albArn: recoveryInternalAlb.targetGroupArn,
    });

    new DfAciSendGridProxyStack(`sendgrid-nlb`, this.stackConfig, {
      masterAccountProviderConfig: MasterEnvironment.accountProviderConfig,
      subDomain: Constants.SENDGRID_PROXY_SUB_DOMAIN_NAME,
      healthCheckProps: {
        healthCheckPath: '/dft-healthcheck',
      },
      primaryConfig: {
        vpc: this.vpcPrimary.vpcConstruct,
        ingressAlb: primaryInternalAlb.loadBalancerResource,
      },
      recoveryConfig: {
        vpc: this.vpcRecovery.vpcConstruct,
        ingressAlb: recoveryInternalAlb.loadBalancerResource,
      },
      activeRegion: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
    });
  }

  /**
   *
   * @param {any} param0 -
   * @return {DfAlb}
   */
  private createSendGridTask({
    vpcStack,
    region,
    suffix,
  }: {
    vpcStack: DfIsolatedVpcStack;
    region:
      | Constants.AWS_REGION_ALIASES.DF_PRIMARY
      | Constants.AWS_REGION_ALIASES.DF_RECOVERY;
    suffix: string;
  }): DfAlb {
    const sendGridAlbStack = new RemoteStack(
      `sendgrid-alb-remote-stack${suffix}`,
      this.stackConfig
    );

    const sendgridAlb = new DfAlb(
      `sendgrid${suffix}`,
      this.stackConfig,
      {
        deployHTTPS: true,
        dfAlbProps: {
          internal: true,
          subDomain: Constants.SENDGRID_PROXY_SUB_DOMAIN_NAME,
          stackShell: sendGridAlbStack,
          vpc: vpcStack.vpcConstruct,
          recoveryVpc: this.vpcRecovery.vpcConstruct,
          targetGroupProps: {
            targetGroupPort: 80,
            targetGroupProtocol: 'HTTP',
            healthCheckPath: '/dft-healthcheck',
            healthCheckPort: '80',
            healthCheckProtocol: 'HTTP',
          },
          createR53Record: false,
        },
        app: this.app,
      },
      region
    );

    sendGridAlbStack.switchRegion(region);

    return sendgridAlb;
  }

  /**
   *
   * @param {any} param0 -
   * @return {DfAlb}
   */
  private createSendGridReverseProxy({
    vpcStack,
    region,
    suffix,
    albArn,
  }: {
    vpcStack: DfIsolatedVpcStack;
    region:
      | Constants.AWS_REGION_ALIASES.DF_PRIMARY
      | Constants.AWS_REGION_ALIASES.DF_RECOVERY;
    suffix: string;
    albArn: string;
  }): DfReverseProxyStack {
    const reverseProxy = new DfReverseProxyStack(
      `sendgrid-ecs-rp-stack${suffix}`,
      this.stackConfig,
      {
        clusterVpcConstruct: vpcStack.vpcConstruct,
        rpListeningPort: 80,
        dockerPushRoleAssumption:
          AciProdSupportEnvironment.dockerPushRoleAssumption,
        targetGroupArn: albArn,
        region: region,
        assetsPath: 'docker/aciProdSupport/sendgrid-proxy',
        imageName:
          region === Constants.AWS_REGION_ALIASES.DF_PRIMARY
            ? Constants.INTERNAL_SENDGRID_REVERSE_PROXY
            : Constants.INTERNAL_SENDGRID_REVERSE_PROXY_RECOVERY,
        accountNumber: Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT,
        subDomain: Constants.SENDGRID_PROXY_SUB_DOMAIN_NAME,
        desiredCount: 3,
        sopsData: this.sopsData,
        includeDatadogAgent: true,
      }
    );

    reverseProxy.switchRegion(region);

    return reverseProxy;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_NAME(): string {
    return 'aciProdSupport';
  }

  /**
   *
   */
  private static get dockerPushRoleAssumption(): string {
    return `
            export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
            $(aws sts assume-role \
            --role-arn arn:aws:iam::${AciProdSupportEnvironment.ACCOUNT_ID}:role/${AciProdSupportEnvironment.PROVIDER_ROLE_NAME} \
            --role-session-name DockerPush \
            --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \
            --output text)) 
          `;
  }

  /**
   *
   */
  protected static get ENVIRONMENT_SUBDOMAIN(): string {
    return 'prod';
  }

  /**
   * @return {string}
   */
  protected static get ACCOUNT_ID(): string {
    return Constants.ACCOUNT_NUMBER_ACI_PROD_SUPPORT;
  }

  /**
   *
   * Singleton constructor for the AciProdSupportEnvironment class
   *
   * @constructor
   * @param {App} app - The root CDKTF App
   * @return {AciProdSupportEnvironment}
   *
   */
  public static getInstance(app: App): AciProdSupportEnvironment {
    if (!AciProdSupportEnvironment.instance) {
      AciProdSupportEnvironment.instance = new AciProdSupportEnvironment({
        app: app,
        vpcCidrPrimary:
          AciProdSupportEnvironment.getAciProdAccountDef().vpcCidrs.main
            .primary,
        vpcCidrRecovery:
          AciProdSupportEnvironment.getAciProdAccountDef().vpcCidrs.main
            .recovery,
        envName: AciProdSupportEnvironment.ENVIRONMENT_NAME,
        envTier: 'prod',
      });
      AciProdSupportEnvironment.instance.deployStacks();
    }
    return AciProdSupportEnvironment.instance;
  }

  /**
   * @return {string}
   */
  protected static get PROVIDER_ROLE_NAME(): string {
    // return 'AWSControlTowerExecution';
    return Constants.ROLE_PROVISION_ROLE_NAME;
  }

  /**
   * @return {AccountDefinition}
   */
  public static getAciProdAccountDef(): AccountDefinition {
    return DfAccounts.getAciProdAccountDef();
  }
}
