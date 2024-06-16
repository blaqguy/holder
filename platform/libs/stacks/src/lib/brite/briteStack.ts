import { IamUser } from '@cdktf/provider-aws/lib/iam-user';
import { RemoteStack, StackConfig } from '../stacks';
import { IamUserPolicy } from '@cdktf/provider-aws/lib/iam-user-policy';
import { Constants, Utils } from '@dragonfly/utils';
import { IamAccessKey } from '@cdktf/provider-aws/lib/iam-access-key';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';

/**
 * BriteStack
 */
export class BriteStack extends RemoteStack {
  private ctUser: IamUser;
  /**
   * @param {string} stackId - The ID of the stack
   * @param {StackConfig} StackConfig - The configuration of the stack
   */
  constructor(
    protected readonly stackId: string,
    protected readonly StackConfig: StackConfig
  ) {
    super(stackId, StackConfig);

    this.createBriteCTUser();
  }

  /**
   * Create the BriteCT user
   */
  private createBriteCTUser(): void {
    const briteCtPermission = Utils.createPolicyDocument(
      this,
      'briteCTPermission',
      ['s3:GetObject', 's3:ListBucket'],
      [
        `arn:aws:s3:::${Constants.CENTRAL_CLOUDTRAIL_BUCKET_NAME}`,
        `arn:aws:s3:::${Constants.CENTRAL_CLOUDTRAIL_BUCKET_NAME}/*`,
      ]
    );

    this.ctUser = new IamUser(this, 'cloudTrailUser', {
      name: 'briteCT',
      tags: {
        Name: 'briteCT',
      },
    });

    new IamUserPolicy(this, 'briteCTPolicy', {
      name: 'briteCTPolicy',
      user: this.ctUser.name,
      policy: briteCtPermission.json,
    });

    const accessKeys = new IamAccessKey(this, 'briteCTAccessKey', {
      user: this.ctUser.name,
    });

    const parameterNames = ['briteCTAccessKeyId', 'briteCTSecretAccessKey'];

    for (const parameterName of parameterNames) {
      new SsmParameter(this, parameterName, {
        name: parameterName,
        type: 'SecureString',
        value:
          parameterName === 'briteCTAccessKeyId'
            ? accessKeys.id
            : accessKeys.secret,
        tags: { Name: parameterName },
      });
    }
  }
}
