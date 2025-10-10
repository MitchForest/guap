import { mutation, query } from '@guap/api/codegen/server';
import { v } from 'convex/values';
import { IncomeCadenceSchema } from '@guap/types';

const now = () => Date.now();

const cadenceArg = v.union(
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('biweekly'),
  v.literal('monthly'),
  v.literal('quarterly'),
  v.literal('yearly')
);

export const create = mutation({
  args: {
    householdId: v.id('households'),
    label: v.string(),
    cadence: cadenceArg,
    amountCents: v.number(),
    sourceAccountId: v.optional(v.id('accounts')),
    active: v.optional(v.boolean()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const cadence = IncomeCadenceSchema.parse(args.cadence);
    return await ctx.db.insert('incomeStreams', {
      householdId: args.householdId,
      label: args.label,
      cadence,
      amountCents: args.amountCents,
      sourceAccountId: args.sourceAccountId ?? undefined,
      active: args.active ?? true,
      metadata: args.metadata,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const listForHousehold = query({
  args: { householdId: v.id('households') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('incomeStreams')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .collect();
  },
});

export const update = mutation({
  args: {
    incomeId: v.id('incomeStreams'),
    label: v.optional(v.string()),
    cadence: v.optional(cadenceArg),
    amountCents: v.optional(v.number()),
    active: v.optional(v.boolean()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.incomeId);
    if (!existing) throw new Error('Income stream not found');

    await ctx.db.patch(args.incomeId, {
      label: args.label ?? existing.label,
      cadence:
        args.cadence !== undefined ? IncomeCadenceSchema.parse(args.cadence) : existing.cadence,
      amountCents: args.amountCents ?? existing.amountCents,
      active: args.active ?? existing.active,
      metadata: args.metadata ?? existing.metadata,
      updatedAt: now(),
    });
  },
});
