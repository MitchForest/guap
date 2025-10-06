import { mutation } from 'convex/server';
import { v } from 'convex/values';

const now = () => Date.now();

export const create = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    sourceNodeId: v.id('nodes'),
    targetNodeId: v.id('nodes'),
    kind: v.optional(v.union(v.literal('manual'), v.literal('automation'))),
    ruleId: v.optional(v.id('rules')),
  },
  handler: async (ctx, args) => {
    const exists = await ctx.db
      .query('edges')
      .withIndex('by_source_target', (q) =>
        q.eq('sourceNodeId', args.sourceNodeId).eq('targetNodeId', args.targetNodeId)
      )
      .unique();
    if (exists) return exists._id;

    return await ctx.db.insert('edges', {
      workspaceId: args.workspaceId,
      sourceNodeId: args.sourceNodeId,
      targetNodeId: args.targetNodeId,
      kind: args.kind,
      ruleId: args.ruleId,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const remove = mutation({
  args: { edgeId: v.id('edges') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.edgeId);
  },
});
