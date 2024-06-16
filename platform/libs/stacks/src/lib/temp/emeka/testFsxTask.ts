import {
  DfFsxDataSyncTask,
  DfFsxDataSyncTaskConfig,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../../stacks';

/**
 *
 */
export class TestFsxTask extends RemoteStack {
  constructor(
    stackId: string,
    stackconfig: StackConfig,
    config: DfFsxDataSyncTaskConfig
  ) {
    super(stackId, stackconfig);

    new DfFsxDataSyncTask(this, 'fsx-task', {
      ...config,
    });
  }
}
