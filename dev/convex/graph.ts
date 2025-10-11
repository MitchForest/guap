import { mutation, query } from '@guap/api/codegen/server';
import { v } from 'convex/values';
import { nodePosition } from './schema';
import {
  clearWorkspaceDiffs,
  clearWorkspaceSessions,
  replaceWorkspaceGraph,
} from './workspaceGraph';

const now = () => Date.now();

export const getGraph = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();

    if (!workspace) {
      return null;
    }

    const nodes = await ctx.db
      .query('nodes')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .collect();

    const edges = await ctx.db
      .query('edges')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .collect();

    const rules = await ctx.db
      .query('rules')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .collect();

    const ruleIds = rules.map((rule) => rule._id);

    // Because Convex lacks "in" filter currently in type aware, we fetch per rule.
    const allocationByRule: Record<string, any[]> = {};
    for (const ruleId of ruleIds) {
      const items = await ctx.db
        .query('ruleAllocations')
        .withIndex('by_rule', (q) => q.eq('ruleId', ruleId))
        .collect();
      allocationByRule[String(ruleId)] = items;
    }

    const allocationsFlat = Object.values(allocationByRule).flat();

    return {
      workspace,
      nodes,
      edges,
      rules,
      allocations: allocationsFlat,
    };
  },
});

export const listRulesForNode = query({
  args: { nodeId: v.id('nodes') },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query('rules')
      .withIndex('by_source', (q) => q.eq('sourceNodeId', args.nodeId))
      .collect();

    const result = [] as Array<{ rule: any; allocations: any[] }>;
    for (const rule of rules) {
      const allocations = await ctx.db
        .query('ruleAllocations')
        .withIndex('by_rule', (q) => q.eq('ruleId', rule._id))
        .collect();
      result.push({ rule, allocations });
    }

    return result;
  },
});

export const publish = mutation({
  args: {
    slug: v.string(),
    nodes: v.array(
      v.object({
        clientId: v.string(),
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
        parentClientId: v.optional(v.string()),
        metadata: v.optional(v.record(v.string(), v.any())),
      })
    ),
    edges: v.array(
      v.object({
        clientId: v.string(),
        sourceClientId: v.string(),
        targetClientId: v.string(),
        kind: v.optional(v.union(v.literal('manual'), v.literal('automation'))),
        ruleClientId: v.optional(v.string()),
      })
    ),
    rules: v.array(
      v.object({
        clientId: v.string(),
        sourceClientId: v.string(),
        trigger: v.union(v.literal('incoming'), v.literal('scheduled')),
        triggerNodeClientId: v.optional(v.string()),
        allocations: v.array(
          v.object({
            targetClientId: v.string(),
            percentage: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();

    if (!workspace) {
      throw new Error(`Workspace '${args.slug}' not found. Ensure it exists before publishing.`);
    }

    const { nodeIdMap, edgeIdMap, ruleIdMap } = await replaceWorkspaceGraph(ctx, workspace._id, {
      nodes: args.nodes,
      edges: args.edges,
      rules: args.rules,
    });

    await clearWorkspaceSessions(ctx, workspace._id);
    await clearWorkspaceDiffs(ctx, workspace._id);

    const workspaceUpdatedAt = now();
    await ctx.db.patch(workspace._id, {
      updatedAt: workspaceUpdatedAt,
      ...(workspace.variant === 'live' ? { lastAppliedAt: workspaceUpdatedAt } : {}),
    });

    return {
      nodes: Object.fromEntries(nodeIdMap.entries()),
      edges: Object.fromEntries(edgeIdMap.entries()),
      rules: Object.fromEntries(ruleIdMap.entries()),
    };
  },
});
