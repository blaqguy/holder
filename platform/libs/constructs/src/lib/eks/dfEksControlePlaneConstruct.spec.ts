import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfSpokeVpcConstruct } from '../vpc';
import { DfEksControlPlaneConstruct } from './dfEksControlPlaneConstruct';
import { Constants } from '@dragonfly/utils';

describe('EKS construct', () => {
  it('Should create resources in EKS construct', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      const vpcConstruct = new DfSpokeVpcConstruct(
        mockStack,
        'mockVpcConstruct',
        {
          vpcCidr: '10.1.1.1/16',
          provider: null,
          federatedAccountId: Constants.ACCOUNT_NUMBER_SHARED_UAT,
        }
      );

      new DfEksControlPlaneConstruct(mockStack, {
        vpc: vpcConstruct,
        clusterName: 'eks-cluster',
        nodeGroupName: 'node-group',
      });
    });

    expect(synthedMockStack).toMatchSnapshot();
  });
});
