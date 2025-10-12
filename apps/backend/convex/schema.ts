import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  MoneyMapChangeStatusValues,
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
} from '@guap/types';

const moneyMapNodeKind = v.union(
  ...MoneyMapNodeKindValues.map((value) => v.literal(value))
);

const moneyMapRuleTrigger = v.union(
  ...MoneyMapRuleTriggerValues.map((value) => v.literal(value))
);

const moneyMapChangeStatus = v.union(
  ...MoneyMapChangeStatusValues.map((value) => v.literal(value))
);

const nullableString = v.union(v.literal(null), v.string());

const moneyMapNodeMetadata = v.object({
  id: v.optional(v.string()),
  category: v.optional(nullableString),
  parentId: v.optional(nullableString),
  podType: v.optional(v.union(v.literal('goal'), v.literal('category'), v.literal('envelope'), v.literal('custom'), v.literal(null))),
  icon: v.optional(nullableString),
  accent: v.optional(nullableString),
  balanceCents: v.optional(v.union(v.number(), v.literal(null))),
  inflow: v.optional(
    v.union(
      v.literal(null),
      v.object({
        amount: v.number(),
        cadence: v.union(v.literal('monthly'), v.literal('weekly'), v.literal('daily')),
      })
    )
  ),
  position: v.optional(
    v.object({
      x: v.number(),
      y: v.number(),
    })
  ),
  returnRate: v.optional(v.union(v.number(), v.literal(null))),
}).optional();

const moneyMapEdgeMetadata = v.object({
  id: v.optional(v.string()),
  ruleId: v.optional(nullableString),
  amountCents: v.optional(v.union(v.number(), v.literal(null))),
  tag: v.optional(nullableString),
  note: v.optional(nullableString),
}).optional();

const moneyMapRuleConfig = v.object({
  ruleId: v.optional(v.string()),
  sourceNodeId: v.optional(v.string()),
  triggerNodeId: v.optional(nullableString),
  allocations: v.optional(
    v.array(
      v.object({
        targetNodeId: v.string(),
        percentage: v.number(),
      })
    )
  ),
});

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
    metadata: moneyMapNodeMetadata,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_map', ['mapId'])
    .index('by_map_key', ['mapId', 'key']),

  moneyMapEdges: defineTable({
    mapId: v.id('moneyMaps'),
    sourceKey: v.string(),
    targetKey: v.string(),
    metadata: moneyMapEdgeMetadata,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_map', ['mapId']),

  moneyMapRules: defineTable({
    mapId: v.id('moneyMaps'),
    key: v.string(),
    trigger: moneyMapRuleTrigger,
    config: moneyMapRuleConfig,
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
    payload: v.object({
      organizationId: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      nodes: v.array(
        v.object({
          key: v.string(),
          kind: moneyMapNodeKind,
          label: v.string(),
          metadata: moneyMapNodeMetadata,
        })
      ),
      edges: v.array(
        v.object({
          sourceKey: v.string(),
          targetKey: v.string(),
          metadata: moneyMapEdgeMetadata,
        })
      ),
      rules: v.array(
        v.object({
          key: v.string(),
          trigger: moneyMapRuleTrigger,
          config: moneyMapRuleConfig,
        })
      ),
    }),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_map_status', ['mapId', 'status'])
    .index('by_organization_status', ['organizationId', 'status']),
});
