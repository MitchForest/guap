import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const now = () => Date.now();

const memberRoleArg = v.union(
  v.literal('kid'),
  v.literal('guardian'),
  v.literal('manager')
);

const memberStatusArg = v.union(
  v.literal('active'),
  v.literal('invited'),
  v.literal('left')
);

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    creatorUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existingSlug = await ctx.db
      .query('households')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
    if (existingSlug) {
      throw new Error('Slug already in use');
    }

    const householdId = await ctx.db.insert('households', {
      name: args.name,
      slug: args.slug,
      createdAt: now(),
      updatedAt: now(),
    });

    await ctx.db.insert('householdMemberships', {
      householdId,
      userId: args.creatorUserId,
      role: 'guardian',
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    });

    return householdId;
  },
});

export const addMember = mutation({
  args: {
    householdId: v.id('households'),
    userId: v.id('users'),
    role: memberRoleArg,
    status: v.optional(memberStatusArg),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('householdMemberships')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        status: args.status ?? 'active',
        updatedAt: now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('householdMemberships', {
      householdId: args.householdId,
      userId: args.userId,
      role: args.role,
      status: args.status ?? 'active',
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const listForUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('householdMemberships')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect();

    const households = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.householdId))
    );

    return households.filter((household): household is NonNullable<typeof household> =>
      Boolean(household)
    );
  },
});

export const listMembers = query({
  args: { householdId: v.id('households') },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('householdMemberships')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .collect();

    const users = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return user
          ? {
              user,
              membership,
            }
          : null;
      })
    );

    return users.filter((value): value is NonNullable<typeof value> => Boolean(value));
  },
});
