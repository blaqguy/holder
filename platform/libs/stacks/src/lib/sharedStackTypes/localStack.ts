import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { LocalBackend, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';

/**
 * Local stack base class
 */
export class LocalStack extends TerraformStack {
  protected provider: AwsProvider;
  private backend: LocalBackend;

  /**
   *
   * @param {Construct} scope - Root CDK app
   * @param {string} id - Id of the stack
   */
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // TODO: Unhardcode the region
    this.provider = new AwsProvider(this, `${id}-aws-provider`, {
      region: 'us-east-1',
    });

    // TODO: Support workspaces
    this.backend = new LocalBackend(this);
  }
}
