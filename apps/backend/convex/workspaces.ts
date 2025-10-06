import { mutation, query } from 'convex/server';
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
