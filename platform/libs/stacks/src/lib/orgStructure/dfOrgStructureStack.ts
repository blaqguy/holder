import { DataAwsOrganizationsOrganization } from '@cdktf/provider-aws/lib/data-aws-organizations-organization';
import { OrganizationsOrganizationalUnit } from '@cdktf/provider-aws/lib/organizations-organizational-unit';
import { RemoteStack, StackConfig } from '../sharedStackTypes/remoteStack';

export type OrgMap = {
  [key: string]: OrgMap | null;
};

export interface OrgStructureStackConfig {
  orgMap: OrgMap;
}

/**
 * Org structure stack
 */
export class DfOrgStructureStack extends RemoteStack {
  private static readonly STACK_ID = 'OrganizationStructureStack';
  private ouRoot: DataAwsOrganizationsOrganization;

  /**
   * @param {StackConfig} stackConfig- stack config
   * @param {OrgStructureStackConfig} orgStructureStackConfig - org config
   */
  constructor(
    protected stackConfig: StackConfig,
    private orgStructureStackConfig: OrgStructureStackConfig
  ) {
    super(DfOrgStructureStack.STACK_ID, stackConfig);

    this.ouRoot = new DataAwsOrganizationsOrganization(this, 'MasterOU');
    this.recursiveCreateOu(this.orgStructureStackConfig.orgMap);
  }

  /**
   * Recursively iterates through the K/Vs in the map and creates OU resources
   *
   * @param {OrgMap} orgMap - The org structure map
   * @param {string} root - The current root key
   */
  private recursiveCreateOu(
    orgMap: OrgMap,
    root = this.ouRoot.roots.get(0).id
  ) {
    Object.entries(orgMap).forEach(([key, value]) => {
      // The account already has a root OU, but we leave it in the org map for clarity
      let currRoot = root;
      if (key !== 'Root') {
        currRoot = this.createOu(key, root).id;
      }

      // If the OU has children make those now
      if (value !== null) {
        this.recursiveCreateOu(value, currRoot);
      }
    });
  }

  /**
   *
   * @param {string} name - The name of the OU
   * @param {string} root - The name of the parent OU
   * @return {OrganizationsOrganizationalUnit} - The OU TF resource
   */
  private createOu(name: string, root) {
    return new OrganizationsOrganizationalUnit(this, `${name}PlatformUnit`, {
      name: name,
      parentId: root,
      tags: { Name: name },
    });
  }
}
