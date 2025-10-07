import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const now = () => Date.now();

export const ensure = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert('workspaces', {
      name: args.name,
      slug: args.slug,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('workspaces').collect();
  },
});

export const remove = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return;

    const rules = await ctx.db
      .query('rules')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();

    for (const rule of rules) {
      const allocations = await ctx.db
        .query('ruleAllocations')
        .withIndex('by_rule', (q) => q.eq('ruleId', rule._id))
        .collect();
      for (const alloc of allocations) {
        await ctx.db.delete(alloc._id);
      }
      await ctx.db.delete(rule._id);
    }

    const edges = await ctx.db
      .query('edges')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }

    const nodes = await ctx.db
      .query('nodes')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const node of nodes) {
      await ctx.db.delete(node._id);
    }

    const sessions = await ctx.db
      .query('canvasSessions')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(args.workspaceId);
  },
});
