import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DfSpokeVpcConstruct } from '../../vpc';

/**
 * Represents configuration options for creating a DataSync Task for FSx.
 * @property {object} providers - The AWS providers for the source and destination.
 * @property {string} fsxArns - The ARNs for the source and destination FSx file systems.
 * @property {object} vpcs - The VPCs for the source and destination.
 * @property {string} DataSyncTaskName - The name of the DataSync Task.
 * @property {string} accountId - The AWS account ID.
 */
export interface DfFsxDataSyncTaskConfig {
  /**
   * The AWS providers for the source and destination.
   */
  providers: {
    source: AwsProvider;
    destination: AwsProvider;
  };
  /**
   * The ARNs for the source and destination FSx file systems.
   */
  fsxArns: {
    source: string;
    destination: string;
  }
  /**
   * The VPCs for the source and destination.
   */;
  vpcs: {
    source: DfSpokeVpcConstruct;
    destination: DfSpokeVpcConstruct;
  }
  /**
   * The name of the DataSync Task.
   */;
  DataSyncTaskName?: string;
  /**
   * The AWS account ID.
   */
  accountId: string;
}
