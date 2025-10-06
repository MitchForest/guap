import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const nodePosition = v.object({
  x: v.number(),
  y: v.number(),
});

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_slug', ['slug']),

  nodes: defineTable({
    workspaceId: v.id('workspaces'),
    type: v.union(
      v.literal('income'),
      v.literal('account'),
      v.literal('pod'),
      v.literal('goal'),
      v.literal('liability')
    ),
    label: v.string(),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    balanceCents: v.optional(v.number()),
    position: nodePosition,
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_type', ['workspaceId', 'type']),

  edges: defineTable({
    workspaceId: v.id('workspaces'),
    sourceNodeId: v.id('nodes'),
    targetNodeId: v.id('nodes'),
    kind: v.optional(v.union(v.literal('manual'), v.literal('automation'))),
    ruleId: v.optional(v.id('rules')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_source_target', ['sourceNodeId', 'targetNodeId']),

  rules: defineTable({
    workspaceId: v.id('workspaces'),
    sourceNodeId: v.id('nodes'),
    triggerType: v.union(v.literal('incoming'), v.literal('scheduled')),
    triggerNodeId: v.optional(v.id('nodes')),
    schedule: v.optional(
      v.object({
        cadence: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
        day: v.optional(v.number()),
      })
    ),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_source', ['sourceNodeId']),

  ruleAllocations: defineTable({
    ruleId: v.id('rules'),
    order: v.number(),
    percentage: v.number(),
    targetNodeId: v.id('nodes'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_rule', ['ruleId']),

  canvasSessions: defineTable({
    workspaceId: v.id('workspaces'),
    snapshot: v.object({
      nodes: v.array(
        v.object({ id: v.id('nodes'), position: nodePosition })
      ),
      edges: v.array(v.object({ id: v.id('edges') })),
      viewport: v.object({ x: v.number(), y: v.number(), scale: v.number() }),
    }),
    status: v.union(v.literal('draft'), v.literal('published')),
    authorId: v.optional(v.string()),
    savedAt: v.number(),
  }).index('by_workspace', ['workspaceId']),
});
