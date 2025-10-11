import { mutation, query } from '@guap/api/codegen/server';
import { v } from 'convex/values';
import { AccountKindSchema, AccountStatusSchema, AccountKindValues, AccountStatusValues } from '@guap/types';
import { literalEnum } from './utils';

const now = () => Date.now();

const kindArg = literalEnum(AccountKindValues);

const statusArg = literalEnum(AccountStatusValues);

export const create = mutation({
  args: {
    householdId: v.id('households'),
    ownerUserId: v.optional(v.id('users')),
    name: v.string(),
    kind: kindArg,
    status: v.optional(statusArg),
    currency: v.optional(v.string()),
    initialBalanceCents: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const kind = AccountKindSchema.parse(args.kind);
    const status = AccountStatusSchema.parse(args.status ?? 'active');

    return await ctx.db.insert('accounts', {
      householdId: args.householdId,
      ownerUserId: args.ownerUserId ?? undefined,
      name: args.name,
      kind,
      status,
      currency: args.currency ?? 'USD',
      balanceCents: args.initialBalanceCents ?? 0,
      availableCents: args.initialBalanceCents ?? 0,
      institution: undefined,
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
      .query('accounts')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .collect();
  },
});

export const updateBalance = mutation({
  args: {
    accountId: v.id('accounts'),
    balanceCents: v.number(),
    availableCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      balanceCents: args.balanceCents,
      availableCents: args.availableCents ?? args.balanceCents,
      updatedAt: now(),
    });
  },
});

export const updateMetadata = mutation({
  args: {
    accountId: v.id('accounts'),
    name: v.optional(v.string()),
    status: v.optional(statusArg),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.accountId);
    if (!existing) throw new Error('Account not found');

    const status = args.status ? AccountStatusSchema.parse(args.status) : existing.status;

    await ctx.db.patch(args.accountId, {
      name: args.name ?? existing.name,
      status,
      metadata: args.metadata ?? existing.metadata,
      updatedAt: now(),
    });
  },
});
