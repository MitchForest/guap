import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  MoneyMapChangeStatusValues,
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
  OrganizationKindValues,
  UserRoleValues,
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

const moneyMapNodeMetadata = v.optional(v.object({
  id: v.optional(v.string()),
  category: v.optional(v.string()),
  parentId: v.optional(v.string()),
  podType: v.optional(v.union(v.literal('goal'), v.literal('category'), v.literal('envelope'), v.literal('custom'))),
  icon: v.optional(v.string()),
  accent: v.optional(v.string()),
  balanceCents: v.optional(v.number()),
  inflow: v.optional(
    v.object({
      amount: v.number(),
      cadence: v.union(v.literal('monthly'), v.literal('weekly'), v.literal('daily')),
    })
  ),
  position: v.optional(
    v.object({
      x: v.number(),
      y: v.number(),
    })
  ),
  returnRate: v.optional(v.number()),
}));

const moneyMapEdgeMetadata = v.optional(v.object({
  id: v.optional(v.string()),
  ruleId: v.optional(v.string()),
  amountCents: v.optional(v.number()),
  tag: v.optional(v.string()),
  note: v.optional(v.string()),
}));

const moneyMapRuleConfig = v.object({
  ruleId: v.optional(v.string()),
  sourceNodeId: v.optional(v.string()),
  triggerNodeId: v.optional(v.string()),
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

  signupRequests: defineTable({
    email: v.string(),
    role: v.union(...UserRoleValues.map((value) => v.literal(value))),
    organizationName: v.optional(v.string()),
    organizationKind: v.union(...OrganizationKindValues.map((value) => v.literal(value))),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  }).index('by_email', ['email']),

  pendingInvites: defineTable({
    invitationId: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index('by_invitation', ['invitationId']).index('by_email', ['email']),
});
