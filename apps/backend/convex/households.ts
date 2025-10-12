import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { BillingIntervalValues, HouseholdPlanValues, MembershipRoleValues, MembershipStatusValues } from '@guap/types';
import { literalEnum } from './utils';

const now = () => Date.now();

const memberRoleArg = literalEnum(MembershipRoleValues);

const memberStatusArg = literalEnum(MembershipStatusValues);

const householdPlanArg = literalEnum(HouseholdPlanValues);

const billingIntervalArg = literalEnum(BillingIntervalValues);

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    creatorUserId: v.id('users'),
    linkedOrganizationId: v.optional(v.id('organizations')),
    plan: v.optional(householdPlanArg),
    planInterval: v.optional(billingIntervalArg),
    planSeats: v.optional(v.number()),
    creatorRole: v.optional(memberRoleArg),
    organizationMembershipId: v.optional(v.id('organizationMemberships')),
  },
  handler: async (ctx, args) => {
    const existingSlug = await ctx.db
      .query('households')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
    if (existingSlug) {
      throw new Error('Slug already in use');
    }

    const creator = await ctx.db.get(args.creatorUserId);
    const inferredRole =
      args.creatorRole ?? (creator?.role as (typeof MembershipRoleValues)[number] | undefined) ?? 'guardian';
    const resolvedPlan =
      args.plan ??
      (args.linkedOrganizationId
        ? 'organization'
        : inferredRole === 'student'
          ? 'free'
          : 'free');
    const planStatus = resolvedPlan === 'free' ? 'active' : 'inactive';

    const householdId = await ctx.db.insert('households', {
      name: args.name,
      slug: args.slug,
      plan: resolvedPlan,
      planStatus,
      planInterval: args.planInterval ?? (resolvedPlan === 'organization' ? 'monthly' : undefined),
      planSeats: args.planSeats ?? undefined,
      linkedOrganizationId: args.linkedOrganizationId ?? undefined,
      subscriptionId: undefined,
      customerId: undefined,
      createdAt: now(),
      updatedAt: now(),
    });

    await ctx.db.insert('householdMemberships', {
      householdId,
      userId: args.creatorUserId,
      role: inferredRole,
      status: 'active',
      organizationMembershipId: args.organizationMembershipId ?? undefined,
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
    organizationMembershipId: v.optional(v.id('organizationMemberships')),
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
        organizationMembershipId: args.organizationMembershipId ?? existing.organizationMembershipId,
        updatedAt: now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('householdMemberships', {
      householdId: args.householdId,
      userId: args.userId,
      role: args.role,
      status: args.status ?? 'active',
      organizationMembershipId: args.organizationMembershipId ?? undefined,
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

export const backfillPlanDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const households = await ctx.db.query('households').collect();
    let updated = 0;

    for (const household of households) {
      if (!household.plan || !household.planStatus) {
        const nextPlan = household.plan ?? ('free' as (typeof HouseholdPlanValues)[number]);
        const nextStatus =
          household.planStatus ??
          (nextPlan === 'free' ? ('active' as const) : ('inactive' as const));

        await ctx.db.patch(household._id, {
          plan: nextPlan,
          planStatus: nextStatus,
          updatedAt: now(),
        });
        updated += 1;
      }
    }

    return { updated };
  },
});
