import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  MoneyMapChangeStatusValues,
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
  TransferIntentValues,
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
    .index('by_map', ['mapId']),

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
    .index('by_map', ['mapId']),

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

  transferGuardrails: defineTable({
    organizationId: v.string(),
    scope: v.union(
      v.object({ type: v.literal('organization') }),
      v.object({ type: v.literal('money_map_node'), nodeId: v.id('moneyMapNodes') }),
      v.object({ type: v.literal('account'), accountId: v.id('financialAccounts') })
    ),
    intent: v.union(...TransferIntentValues.map((value) => v.literal(value))),
    direction: v.object({
      sourceNodeId: v.union(v.null(), v.id('moneyMapNodes')),
      destinationNodeId: v.union(v.null(), v.id('moneyMapNodes')),
    }),
    approvalPolicy: v.union(
      v.literal('auto'),
      v.literal('parent_required'),
      v.literal('admin_only')
    ),
    autoApproveUpToCents: v.optional(v.union(v.null(), v.number())),
    dailyLimitCents: v.optional(v.union(v.null(), v.number())),
    weeklyLimitCents: v.optional(v.union(v.null(), v.number())),
    allowedInstrumentKinds: v.optional(
      v.array(
        v.union(
          v.literal('etf'),
          v.literal('stock'),
          v.literal('bond'),
          v.literal('cash')
        )
      )
    ),
    blockedSymbols: v.optional(v.array(v.string())),
    maxOrderAmountCents: v.optional(v.union(v.null(), v.number())),
    requireApprovalForSell: v.optional(v.union(v.null(), v.boolean())),
    allowedRolesToInitiate: v.array(
      v.union(v.literal('owner'), v.literal('admin'), v.literal('member'))
    ),
    createdByProfileId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization_intent', ['organizationId', 'intent'])
    .index('by_scope_intent', ['scope.type', 'intent']),

  financialAccounts: defineTable({
    organizationId: v.string(),
    name: v.string(),
    kind: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_organization', ['organizationId']),

});
