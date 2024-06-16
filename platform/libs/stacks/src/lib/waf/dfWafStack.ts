import { RemoteStack, StackConfig } from '../stacks';
import {
  Wafv2WebAcl,
  Wafv2WebAclRule,
} from '@cdktf/provider-aws/lib/wafv2-web-acl';
import { Wafv2IpSet } from '@cdktf/provider-aws/lib/wafv2-ip-set';
import { Wafv2WebAclLoggingConfiguration } from '@cdktf/provider-aws/lib/wafv2-web-acl-logging-configuration';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { Utils } from '@dragonfly/utils';
import { Construct } from 'constructs';

export interface WafConfig {
  ipv4WhiteList?: string[];
  ipv6WhiteList?: string[];
  listName?: string;
  uriLists?: {
    listName: string;
    uriMatch: string;
    allowList: string[];
  }[];
}
/**
 *
 */
export class DfWafStack extends RemoteStack {
  private webAcl: Wafv2WebAcl;
  private scope: Construct;
  /**
   *
   * @param {string} stackName - Stack Name to use for this stack
   * @param {StackConfig} stackConfig - Stack config for the stack
   * @param {Construct} scope
   */
  constructor(
    private stackName: string,
    protected stackConfig: StackConfig,
    protected wafConfig?: WafConfig,
    scope?: Construct
  ) {
    super(stackName, stackConfig);
    this.scope = scope ?? this;
    this.createWAF(stackName);
  }

  /**
   * Creates an AWS Cloudfront Distribution using an internal alb as the origin
   * @param {string} stackName - The name of the stack
   */
  private createWAF(stackName: string) {
    // Create and attach AWS managed rule groups
    const awsManagedRuleGroups = ['AWSManagedRulesAmazonIpReputationList'];

    const webAclRules: Wafv2WebAclRule[] = [];

    let ipv4WhitelistArn = undefined;
    let ipv6WhitelistArn = undefined;

    if (this.wafConfig?.ipv4WhiteList?.length > 0) {
      ipv4WhitelistArn = this.createWhitelist(
        this.wafConfig.ipv4WhiteList,
        webAclRules.length,
        'IPV4'
      );
    }

    if (this.wafConfig?.ipv6WhiteList?.length > 0) {
      ipv6WhitelistArn = this.createWhitelist(
        this.wafConfig.ipv6WhiteList,
        webAclRules.length,
        'IPV6'
      );
    }

    let whiteListStatement = undefined;
    if (ipv4WhitelistArn && ipv6WhitelistArn) {
      whiteListStatement = {
        and_statement: {
          statement: [
            {
              not_statement: {
                statement: [
                  {
                    ip_set_reference_statement: {
                      arn: ipv4WhitelistArn,
                    },
                  },
                ],
              },
            },
            {
              not_statement: {
                statement: [
                  {
                    ip_set_reference_statement: {
                      arn: ipv6WhitelistArn,
                    },
                  },
                ],
              },
            },
          ],
        },
      };
    } else if (ipv4WhitelistArn || ipv6WhitelistArn) {
      whiteListStatement = {
        not_statement: {
          statement: [
            {
              ip_set_reference_statement: {
                arn: ipv4WhitelistArn ?? ipv6WhitelistArn,
              },
            },
          ],
        },
      };
    }

    if (whiteListStatement) {
      webAclRules.push({
        name: [this.wafConfig.listName].join('-'),
        priority: webAclRules.length,
        action: {
          block: {},
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudwatchMetricsEnabled: true,
          metricName: this.wafConfig.listName,
        },
        statement: whiteListStatement,
      });
    }

    if (this.wafConfig.uriLists?.length) {
      this.wafConfig.uriLists.forEach((uriList) => {
        const uriIpSet = new Wafv2IpSet(
          this.scope,
          `${uriList.listName}IpSet`,
          {
            name: `${uriList.listName}IpSet`,
            addresses: uriList.allowList,
            description: 'Whitelist',
            ipAddressVersion: 'IPV4',
            scope: 'CLOUDFRONT',
          }
        );

        webAclRules.push({
          name: uriList.listName,
          priority: webAclRules.length,
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudwatchMetricsEnabled: true,
            metricName: uriList.listName,
          },
          statement: {
            and_statement: {
              statement: [
                {
                  not_statement: {
                    statement: [
                      {
                        ip_set_reference_statement: {
                          arn: uriIpSet.arn,
                        },
                      },
                    ],
                  },
                },
                {
                  byte_match_statement: {
                    field_to_match: {
                      uri_path: {},
                    },

                    positional_constraint: 'CONTAINS',
                    search_string: uriList.uriMatch,
                    text_transformation: {
                      priority: 0,
                      type: 'NONE',
                    },
                  },
                },
              ],
            },
          },
        });
      });
    }

    awsManagedRuleGroups.forEach((managedRuleGroupName) => {
      webAclRules.push({
        name: managedRuleGroupName,
        priority: webAclRules.length,
        statement: {
          managed_rule_group_statement: {
            name: managedRuleGroupName,
            vendor_name: 'AWS',
          },
        },
        overrideAction: {
          none: {},
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: managedRuleGroupName,
          sampledRequestsEnabled: true,
        },
      });
    });

    this.webAcl = new Wafv2WebAcl(this.scope, `${stackName}-web-acl`, {
      lifecycle: {
        ignoreChanges: ['tags', 'rule'],
      },
      name: stackName,
      description: 'DragonflyFt WAFv2 web ACL',
      scope: 'CLOUDFRONT',
      defaultAction: {
        allow: {},
      },
      rule: webAclRules,
      visibilityConfig: {
        cloudwatchMetricsEnabled: true,
        metricName: `${stackName}-web-acl-metrics`,
        sampledRequestsEnabled: true,
      },
      // TODO: Upgrade Provider
      tags: { Name: stackName },
    });

    this.enableLogging(this.webAcl);
  }

  /**
   *
   * @param {string[]} ipSet
   * @param {number} priority
   * @param {string} ipVersion
   * @return {Wafv2WebAclRule}
   */
  private createWhitelist(
    ipSet: string[],
    priority: number,
    ipVersion: 'IPV4' | 'IPV6'
  ) {
    const whitelistIpSet = new Wafv2IpSet(
      this.scope,
      `${this.wafConfig.listName}IpSet-${ipVersion}`,
      {
        name: [this.wafConfig.listName, ipVersion].join('-'),
        addresses: ipSet,
        description: 'Whitelist',
        ipAddressVersion: ipVersion,
        scope: 'CLOUDFRONT',
      }
    );

    return whitelistIpSet.arn;
  }

  /**
   *
   * @param {Wafv2WebAcl} webAcl
   */
  private enableLogging(webAcl: Wafv2WebAcl) {
    const wafLogGroup = new CloudwatchLogGroup(
      this.scope,
      `${this.stackName}-cloudwatch-log-group`,
      {
        name: `aws-waf-logs-${this.stackName}`,
        retentionInDays: Utils.getLogRetention(
          this.stackConfig.federatedAccountId
        ),
        tags: {
          Name: this.stackName,
        },
      }
    );

    new Wafv2WebAclLoggingConfiguration(
      this.scope,
      `${this.stackName}-logging-config`,
      {
        dependsOn: [webAcl],
        logDestinationConfigs: [wafLogGroup.arn],
        resourceArn: webAcl.arn,
      }
    );
  }

  /**
   * @return {string} Web Acl ARN
   */
  public get webAclArn(): string {
    return this.webAcl.arn;
  }
}
