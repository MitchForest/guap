import { query } from '@guap/api/codegen/server';
import { v } from 'convex/values';

export const listRecent = query({
  args: {
    providerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const results = await ctx.db
      .query('providerSyncEvents')
      .withIndex('by_provider', (q) => q.eq('providerId', args.providerId))
      .order('desc')
      .take(limit);
    return results;
  },
});
