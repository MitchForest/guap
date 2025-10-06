import { mutation, query } from 'convex/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

const now = () => Date.now();

export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('nodes')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: {
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
    position: v.object({ x: v.number(), y: v.number() }),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('nodes', {
      workspaceId: args.workspaceId,
      type: args.type,
      label: args.label,
      icon: args.icon,
      accent: args.accent,
      balanceCents: args.balanceCents,
      position: args.position,
      metadata: args.metadata,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const update = mutation({
  args: {
    nodeId: v.id('nodes'),
    label: v.optional(v.string()),
    balanceCents: v.optional(v.number()),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.nodeId);
    if (!existing) throw new Error('Node not found');

    await ctx.db.patch(args.nodeId, {
      label: args.label ?? existing.label,
      balanceCents: args.balanceCents ?? existing.balanceCents,
      icon: args.icon ?? existing.icon,
      accent: args.accent ?? existing.accent,
      position: args.position ?? existing.position,
      metadata: args.metadata ?? existing.metadata,
      updatedAt: now(),
    });
  },
});

export const moveMany = mutation({
  args: {
    updates: v.array(
      v.object({ nodeId: v.id('nodes'), position: v.object({ x: v.number(), y: v.number() }) })
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      const existing = await ctx.db.get(update.nodeId);
      if (!existing) continue;
      await ctx.db.patch(update.nodeId, { position: update.position, updatedAt: now() });
    }
  },
});

export const remove = mutation({
  args: { nodeId: v.id('nodes') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.nodeId);

    // Cascade edges
    const edges = await ctx.db
      .query('edges')
      .withIndex('by_source_target', (q) => q.eq('sourceNodeId', args.nodeId))
      .collect();
    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }

    const incoming = await ctx.db
      .query('edges')
      .withIndex('by_source_target', (q) => q.eq('targetNodeId', args.nodeId))
      .collect();
    for (const edge of incoming) {
      await ctx.db.delete(edge._id);
    }
  },
});
