import { mutation, query } from '@guap/api/codegen/server';
import type { MutationCtx } from '@guap/api/codegen/server';
import type { Id } from '@guap/api/codegen/dataModel';
import { v } from 'convex/values';
import { UserRoleSchema } from '@guap/types';

const now = () => Date.now();

const roleArg = v.union(v.literal('kid'), v.literal('guardian'));

type UpsertArgs = {
  authId: string;
  email?: string;
  displayName: string;
  role: 'kid' | 'guardian';
  avatarUrl?: string;
  householdId?: Id<'households'>;
  guardianId?: Id<'users'>;
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
    householdId: v.optional(v.id('households')),
    guardianId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) =>
    upsertUser(ctx, {
      authId: args.authId,
      email: args.email ?? undefined,
      displayName: args.displayName,
      role: args.role,
      avatarUrl: args.avatarUrl ?? undefined,
      householdId: args.householdId ?? undefined,
      guardianId: args.guardianId ?? undefined,
    }),
});

export const createProfile = mutation({
  args: {
    authId: v.string(),
    email: v.string(),
    displayName: v.string(),
    role: roleArg,
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    upsertUser(ctx, {
      authId: args.authId,
      email: args.email,
      displayName: args.displayName,
      role: args.role,
      avatarUrl: args.avatarUrl ?? undefined,
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

export const updateProfile = mutation({
  args: {
    userId: v.id('users'),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    role: v.optional(roleArg),
    email: v.optional(v.string()),
    householdId: v.optional(v.union(v.id('households'), v.null())),
    guardianId: v.optional(v.union(v.id('users'), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.userId);
    if (!existing) throw new Error('User not found');

    const updatedRole = args.role ? UserRoleSchema.parse(args.role) : existing.role;
    const updatedAvatar =
      args.avatarUrl === undefined ? existing.avatarUrl : args.avatarUrl ?? undefined;

    await ctx.db.patch(args.userId, {
      displayName: args.displayName ?? existing.displayName,
      avatarUrl: updatedAvatar,
      role: updatedRole,
      email: args.email ?? existing.email,
      householdId:
        args.householdId === undefined ? existing.householdId : args.householdId ?? undefined,
      guardianId:
        args.guardianId === undefined ? existing.guardianId : args.guardianId ?? undefined,
      lastActiveAt: now(),
      updatedAt: now(),
    });
  },
});
