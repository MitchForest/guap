import { mutation, query } from '@guap/api/codegen/server';
import { v } from 'convex/values';
import { z } from 'zod';

const now = () => Date.now();

const notificationKindArg = v.union(
  v.literal('request'),
  v.literal('transfer'),
  v.literal('automation'),
  v.literal('milestone')
);

const payloadSchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
    requestId: z.string().optional(),
    actionUrl: z.string().optional(),
  })
  .passthrough();

export const publish = mutation({
  args: {
    userId: v.id('users'),
    kind: notificationKindArg,
    payload: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const payload = args.payload ? payloadSchema.parse(args.payload) : undefined;
    return await ctx.db.insert('notifications', {
      userId: args.userId,
      kind: args.kind,
      payload,
      readAt: undefined,
      createdAt: now(),
    });
  },
});

export const listForUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      readAt: now(),
    });
  },
});
