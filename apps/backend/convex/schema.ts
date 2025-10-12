import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const moneyMapNodeKind = v.union(
  v.literal('account'),
  v.literal('income'),
  v.literal('expense'),
  v.literal('goal'),
  v.literal('holding')
);

const moneyMapRuleTrigger = v.union(
  v.literal('manual'),
  v.literal('schedule'),
  v.literal('threshold')
);

const moneyMapChangeStatus = v.union(
  v.literal('draft'),
  v.literal('awaiting_guardian'),
  v.literal('approved'),
  v.literal('rejected')
);

export default defineSchema({
  moneyMaps: defineTable({
    organizationId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_organization', ['organizationId']),

  moneyMapNodes: defineTable({
    mapId: v.id('moneyMaps'),
    key: v.string(),
    kind: moneyMapNodeKind,
    label: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_map', ['mapId'])
    .index('by_map_key', ['mapId', 'key']),

  moneyMapEdges: defineTable({
    mapId: v.id('moneyMaps'),
    sourceKey: v.string(),
    targetKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_map', ['mapId']),

  moneyMapRules: defineTable({
    mapId: v.id('moneyMaps'),
    key: v.string(),
    trigger: moneyMapRuleTrigger,
    config: v.record(v.string(), v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_map', ['mapId'])
    .index('by_map_key', ['mapId', 'key']),

  moneyMapChangeRequests: defineTable({
    mapId: v.id('moneyMaps'),
    organizationId: v.string(),
    submitterId: v.string(),
    status: moneyMapChangeStatus,
    summary: v.optional(v.string()),
    payload: v.record(v.string(), v.any()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_map_status', ['mapId', 'status'])
    .index('by_organization_status', ['organizationId', 'status']),
});
