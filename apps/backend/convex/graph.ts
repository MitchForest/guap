import { query } from 'convex/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

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
