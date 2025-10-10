import { mutation, query } from '@guap/api/codegen/server';
import { v } from 'convex/values';
import { RequestKindSchema, RequestStateSchema } from '@guap/types';

const now = () => Date.now();

const requestKindArg = v.union(
  v.literal('transfer'),
  v.literal('purchase'),
  v.literal('goal-funding'),
  v.literal('automation-change')
);

const requestStateArg = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('cancelled')
);

export const create = mutation({
  args: {
    householdId: v.id('households'),
    createdByUserId: v.id('users'),
    assignedToUserId: v.optional(v.id('users')),
    kind: requestKindArg,
    payload: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const kind = RequestKindSchema.parse(args.kind);

    return await ctx.db.insert('requests', {
      householdId: args.householdId,
      createdByUserId: args.createdByUserId,
      assignedToUserId: args.assignedToUserId ?? undefined,
      kind,
      state: 'pending',
      payload: args.payload,
      resolvedByUserId: undefined,
      resolvedAt: undefined,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const listForHousehold = query({
  args: { householdId: v.id('households') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('requests')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .order('desc')
      .collect();
  },
});

export const listForUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const created = await ctx.db
      .query('requests')
      .withIndex('by_creator', (q) => q.eq('createdByUserId', args.userId))
      .collect();

    const assigned = await ctx.db
      .query('requests')
      .withIndex('by_assignee', (q) => q.eq('assignedToUserId', args.userId))
      .collect();

    const merged = [...created, ...assigned];
    merged.sort((a, b) => b.createdAt - a.createdAt);
    return merged;
  },
});

export const updateState = mutation({
  args: {
    requestId: v.id('requests'),
    state: requestStateArg,
    resolvedByUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const nextState = RequestStateSchema.parse(args.state);
    const existing = await ctx.db.get(args.requestId);
    if (!existing) throw new Error('Request not found');

    await ctx.db.patch(args.requestId, {
      state: nextState,
      resolvedByUserId: args.resolvedByUserId,
      resolvedAt: now(),
      updatedAt: now(),
    });
  },
});
