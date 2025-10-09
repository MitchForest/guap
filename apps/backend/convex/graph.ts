import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { nodePosition } from './schema';

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
    let workspace = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();

    if (!workspace) {
      const workspaceId = await ctx.db.insert('workspaces', {
        name: args.slug,
        slug: args.slug,
        createdAt: now(),
        updatedAt: now(),
      });
      workspace = await ctx.db.get(workspaceId);
    }

    if (!workspace) throw new Error('Unable to ensure workspace');

    const workspaceId = workspace._id;

    const existingRules = await ctx.db
      .query('rules')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();

    for (const rule of existingRules) {
      const allocations = await ctx.db
        .query('ruleAllocations')
        .withIndex('by_rule', (q) => q.eq('ruleId', rule._id))
        .collect();
      for (const allocation of allocations) {
        await ctx.db.delete(allocation._id);
      }
      await ctx.db.delete(rule._id);
    }

    const existingEdges = await ctx.db
      .query('edges')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    for (const edge of existingEdges) {
      await ctx.db.delete(edge._id);
    }

    const existingNodes = await ctx.db
      .query('nodes')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    for (const node of existingNodes) {
      await ctx.db.delete(node._id);
    }

    const nodeIdMap = new Map<string, Id<'nodes'>>();
    for (const node of args.nodes) {
      const id = await ctx.db.insert('nodes', {
        workspaceId,
        type: node.type,
        label: node.label,
        icon: node.icon,
        accent: node.accent,
        balanceCents: node.balanceCents,
        position: node.position,
        createdAt: now(),
        updatedAt: now(),
      });
      nodeIdMap.set(node.clientId, id);
    }

    const ruleIdMap = new Map<string, Id<'rules'>>();
    for (const rule of args.rules) {
      const sourceId = nodeIdMap.get(rule.sourceClientId);
      if (!sourceId) continue;
      const triggerNodeId = rule.triggerNodeClientId
        ? nodeIdMap.get(rule.triggerNodeClientId) ?? sourceId
        : sourceId;
      const ruleId = await ctx.db.insert('rules', {
        workspaceId,
        sourceNodeId: sourceId,
        triggerType: rule.trigger,
        triggerNodeId,
        createdAt: now(),
        updatedAt: now(),
      });
      ruleIdMap.set(rule.clientId, ruleId);

      let order = 0;
      for (const allocation of rule.allocations) {
        const targetId = nodeIdMap.get(allocation.targetClientId);
        if (!targetId) continue;
        await ctx.db.insert('ruleAllocations', {
          ruleId,
          order: order++,
          percentage: allocation.percentage,
          targetNodeId: targetId,
          createdAt: now(),
          updatedAt: now(),
        });
      }
    }

    const edgeIdMap = new Map<string, Id<'edges'>>();
    for (const edge of args.edges) {
      const sourceId = nodeIdMap.get(edge.sourceClientId);
      const targetId = nodeIdMap.get(edge.targetClientId);
      if (!sourceId || !targetId) continue;
      const ruleId = edge.ruleClientId ? ruleIdMap.get(edge.ruleClientId) : undefined;
      const edgeId = await ctx.db.insert('edges', {
        workspaceId,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        kind: edge.kind ?? 'manual',
        ruleId,
        createdAt: now(),
        updatedAt: now(),
      });
      edgeIdMap.set(edge.clientId, edgeId);
    }

    return {
      nodes: Object.fromEntries(nodeIdMap.entries()),
      edges: Object.fromEntries(edgeIdMap.entries()),
      rules: Object.fromEntries(ruleIdMap.entries()),
    };
  },
});
