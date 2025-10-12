import { mutation, query } from '@guap/api/codegen/server';
import type { MutationCtx } from '@guap/api/codegen/server';
import type { Id } from '@guap/api/codegen/dataModel';
import { v } from 'convex/values';
import { MembershipRoleSchema, MembershipRoleValues, UserRoleSchema, UserRoleValues } from '@guap/types';
import { literalEnum } from './utils';

const now = () => Date.now();

const roleArg = literalEnum(UserRoleValues);

const membershipRoleArg = literalEnum(MembershipRoleValues);

const onboardingArg = v.union(
  v.null(),
  v.object({
    organizationId: v.optional(v.id('organizations')),
    inviteId: v.optional(v.id('membershipInvites')),
    role: v.optional(membershipRoleArg),
    joinCode: v.optional(v.string()),
    status: v.optional(v.string()),
  })
);

type UpsertArgs = {
  authId: string;
  email?: string;
  displayName: string;
  role: (typeof UserRoleValues)[number];
  avatarUrl?: string;
  householdId?: Id<'households'>;
  guardianId?: Id<'users'>;
  primaryOrganizationId?: Id<'organizations'>;
  defaultMembershipId?: Id<'organizationMemberships'>;
  onboarding?: {
    organizationId?: Id<'organizations'>;
    inviteId?: Id<'membershipInvites'>;
    role?: (typeof MembershipRoleValues)[number];
    joinCode?: string;
    status?: string;
  } | null;
};

const normalizeOnboardingInput = (
  onboarding:
    | {
        organizationId?: Id<'organizations'>;
        inviteId?: Id<'membershipInvites'>;
        role?: string;
        joinCode?: string;
        status?: string;
      }
    | null
    | undefined
): UpsertArgs['onboarding'] => {
  if (onboarding === undefined) {
    return undefined;
  }
  if (onboarding === null) {
    return null;
  }

  return {
    organizationId: onboarding.organizationId ?? undefined,
    inviteId: onboarding.inviteId ?? undefined,
    role: onboarding.role ? MembershipRoleSchema.parse(onboarding.role) : undefined,
    joinCode: onboarding.joinCode ?? undefined,
    status: onboarding.status ?? undefined,
  };
};

const upsertUser = async (ctx: MutationCtx, args: UpsertArgs) => {
  const normalizedRole = UserRoleSchema.parse(args.role);
  const existing = await ctx.db
    .query('users')
    .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      email: args.email ?? existing.email,
      displayName: args.displayName,
      role: normalizedRole,
      avatarUrl: args.avatarUrl ?? existing.avatarUrl,
      householdId: args.householdId ?? existing.householdId,
      guardianId: args.guardianId ?? existing.guardianId,
      primaryOrganizationId:
        args.primaryOrganizationId === undefined
          ? existing.primaryOrganizationId
          : args.primaryOrganizationId ?? undefined,
      defaultMembershipId:
        args.defaultMembershipId === undefined
          ? existing.defaultMembershipId
          : args.defaultMembershipId ?? undefined,
      onboarding:
        args.onboarding === undefined
          ? existing.onboarding
          : args.onboarding ?? undefined,
      lastActiveAt: now(),
      updatedAt: now(),
    });
    return existing._id;
  }

  return await ctx.db.insert('users', {
    authId: args.authId,
    email: args.email,
    displayName: args.displayName,
    role: normalizedRole,
    avatarUrl: args.avatarUrl,
    householdId: args.householdId,
    guardianId: args.guardianId,
    primaryOrganizationId: args.primaryOrganizationId,
    defaultMembershipId: args.defaultMembershipId,
    onboarding: args.onboarding ?? undefined,
    lastActiveAt: now(),
    createdAt: now(),
    updatedAt: now(),
  });
};

export const ensure = mutation({
  args: {
    authId: v.string(),
    email: v.optional(v.string()),
    displayName: v.string(),
    role: roleArg,
    avatarUrl: v.optional(v.string()),
    householdId: v.optional(v.union(v.id('households'), v.null())),
    guardianId: v.optional(v.union(v.id('users'), v.null())),
    primaryOrganizationId: v.optional(v.union(v.id('organizations'), v.null())),
    defaultMembershipId: v.optional(v.union(v.id('organizationMemberships'), v.null())),
    onboarding: v.optional(onboardingArg),
  },
  handler: async (ctx, args) =>
    upsertUser(ctx, {
      authId: args.authId,
      email: args.email ?? undefined,
      displayName: args.displayName,
      role: args.role as (typeof UserRoleValues)[number],
      avatarUrl: args.avatarUrl ?? undefined,
      householdId: args.householdId ?? undefined,
      guardianId: args.guardianId ?? undefined,
      primaryOrganizationId: args.primaryOrganizationId ?? undefined,
      defaultMembershipId: args.defaultMembershipId ?? undefined,
      onboarding: normalizeOnboardingInput(args.onboarding),
    }),
});

export const createProfile = mutation({
  args: {
    authId: v.string(),
    email: v.string(),
    displayName: v.string(),
    role: roleArg,
    avatarUrl: v.optional(v.string()),
    householdId: v.optional(v.union(v.id('households'), v.null())),
    guardianId: v.optional(v.union(v.id('users'), v.null())),
    primaryOrganizationId: v.optional(v.union(v.id('organizations'), v.null())),
    defaultMembershipId: v.optional(v.union(v.id('organizationMemberships'), v.null())),
    onboarding: v.optional(onboardingArg),
  },
  handler: async (ctx, args) =>
    upsertUser(ctx, {
      authId: args.authId,
      email: args.email,
      displayName: args.displayName,
      role: args.role as (typeof UserRoleValues)[number],
      avatarUrl: args.avatarUrl ?? undefined,
      householdId: args.householdId ?? undefined,
      guardianId: args.guardianId ?? undefined,
      primaryOrganizationId: args.primaryOrganizationId ?? undefined,
      defaultMembershipId: args.defaultMembershipId ?? undefined,
      onboarding: normalizeOnboardingInput(args.onboarding),
    }),
});

export const getById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => ctx.db.get(args.userId),
});

export const getByAuthId = query({
  args: { authId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique(),
});

export const getUserProfile = query({
  args: { authId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique(),
});

export const sanitizeRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const allowed = new Set(UserRoleValues);
    const users = await ctx.db.query('users').collect();

    let patched = 0;
    for (const user of users) {
      if (!allowed.has(user.role as (typeof UserRoleValues)[number])) {
        await ctx.db.patch(user._id, {
          role: 'student',
          updatedAt: now(),
        });
        patched += 1;
      }
    }

    return { patched };
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id('users'),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    role: v.optional(roleArg),
    email: v.optional(v.string()),
    householdId: v.optional(v.union(v.id('households'), v.null())),
    guardianId: v.optional(v.union(v.id('users'), v.null())),
    primaryOrganizationId: v.optional(v.union(v.id('organizations'), v.null())),
    defaultMembershipId: v.optional(v.union(v.id('organizationMemberships'), v.null())),
    onboarding: v.optional(onboardingArg),
    permissions: v.optional(v.union(v.record(v.string(), v.boolean()), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.userId);
    if (!existing) throw new Error('User not found');

    const updatedRole = args.role ? UserRoleSchema.parse(args.role) : existing.role;
    const updatedAvatar =
      args.avatarUrl === undefined ? existing.avatarUrl : args.avatarUrl ?? undefined;
    const updatedPermissions =
      args.permissions === undefined ? existing.permissions : args.permissions ?? undefined;
    const onboardingValue =
      args.onboarding === undefined
        ? existing.onboarding
        : normalizeOnboardingInput(args.onboarding);

    await ctx.db.patch(args.userId, {
      displayName: args.displayName ?? existing.displayName,
      avatarUrl: updatedAvatar,
      role: updatedRole,
      email: args.email ?? existing.email,
      householdId:
        args.householdId === undefined ? existing.householdId : args.householdId ?? undefined,
      guardianId:
        args.guardianId === undefined ? existing.guardianId : args.guardianId ?? undefined,
      primaryOrganizationId:
        args.primaryOrganizationId === undefined
          ? existing.primaryOrganizationId
          : args.primaryOrganizationId ?? undefined,
      defaultMembershipId:
        args.defaultMembershipId === undefined
          ? existing.defaultMembershipId
          : args.defaultMembershipId ?? undefined,
      onboarding: onboardingValue,
      permissions: updatedPermissions,
      lastActiveAt: now(),
      updatedAt: now(),
    });
  },
});
