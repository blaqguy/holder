export const EB_CLUSTER_NODE_TYPE_ARRAY = [
  'app',
  'web',
  'util',
  'wind',
  'mq',
  'admin', // admin tier is same as wind tier, just a new one to comply with requested naming convention
  'ofx-app',
  'ofx-web',
] as const;

export type EbProdClusterNodeTypes =
  (typeof EB_CLUSTER_NODE_TYPE_ARRAY)[number];
