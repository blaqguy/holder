import { Annotations, IAspect, TerraformDataSource } from 'cdktf';
import { IConstruct } from 'constructs';
import { Utils } from './helpers';

const GLOBAL_TAGS = [
  'Environment',
  'map-migrated',
  'compliance-scope',
] as const;
const REQUIRED_TAGS = ['Name', ...GLOBAL_TAGS] as const;

type GlobalTags = {
  [key in (typeof GLOBAL_TAGS)[number]]: string;
};

type CustomTag = {
  [key: string]: string;
};

type TaggableConstruct = IConstruct & {
  tags?: { [key: string]: string };
  tagsInput?: { [key: string]: string };
};

/**
 *
 */
class BaseTaggingClass {
  /**
   *
   * @param {IConstruct} node
   * @return {TaggableConstruct}
   *
   */
  isTaggableConstruct(node: IConstruct): node is TaggableConstruct {
    return (
      'tags' in node &&
      'tagsInput' in node &&
      'tfResourceType' in node.constructor &&
      Utils.isAwsNode(node) &&
      !(node instanceof TerraformDataSource)
    );
  }
}

/**
 *
 */
export class DfTagsAspect extends BaseTaggingClass implements IAspect {
  /**
   *
   * @param {GlobalTags} globalTags
   */
  constructor(private globalTags: GlobalTags) {
    super();
  }

  /**
   *
   * @param {IConstruct} node
   */
  visit(node: IConstruct): void {
    if (this.isTaggableConstruct(node)) {
      /**
       * Setting tags to local var so we can check tags during synth
       * tags on node aren't accessible until build time, so the tags
       * are just tokens when we check them here
       */
      const nodeTags = {
        ...this.globalTags,
        ...(node.tagsInput || {}),
      };

      node.tags = nodeTags;

      for (const tag of REQUIRED_TAGS) {
        if (!nodeTags[tag]) {
          Annotations.of(node).addWarning(`${tag} tag is required`);
        }
      }
    }
  }
}

/**
 *
 */
export class DfCustomTagsAspect extends BaseTaggingClass implements IAspect {
  /**
   *
   * @param {CustomTag} customTag
   */
  constructor(private customTag: CustomTag) {
    super();
  }

  /**
   *
   * @param {IConstruct} node
   */
  visit(node: IConstruct): void {
    if (this.isTaggableConstruct(node)) {
      /**
       * Setting tags to local var so we can check tags during synth
       * tags on node aren't accessible until build time, so the tags
       * are just tokens when we check them here
       */
      const nodeTags = {
        ...this.customTag,
        ...(node.tagsInput || {}),
      };

      node.tags = nodeTags;
    }
  }
}
