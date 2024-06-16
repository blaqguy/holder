import { Testing } from 'cdktf';
import { Constants, DfPackerUtils } from './utils';

describe('DfPackerUtils', () => {
  it('return AMI data source given an AMI name', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      DfPackerUtils.getAmiByName(mockStack, Constants.AMIS.UOB_APP_SERVER);
    });
    expect(synthedMockStack).toMatchSnapshot();
  });
});
