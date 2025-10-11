import { query } from '@guap/api/codegen/server';
import { v } from 'convex/values';

export const listForHousehold = query({
  args: {
    householdId: v.id('households'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db
      .query('workspaceSandboxEvents')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .order('desc')
      .take(limit);
  },
});
