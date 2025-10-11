import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from '@guap/api/codegen/api';
import type { DataModel } from '@guap/api/codegen/dataModel';
import { query } from '@guap/api/codegen/server';
import type { QueryCtx } from '@guap/api/codegen/server';
import { betterAuth } from 'better-auth';

const convexSiteUrl = process.env.CONVEX_SITE_URL!;
const frontendUrl = process.env.SITE_URL ?? 'http://localhost:3001';

export const authComponent = createClient<DataModel>(components.betterAuth);

const getDb = (ctx: GenericCtx<DataModel>): QueryCtx['db'] =>
  (ctx as any).db as QueryCtx['db'];

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) =>
  betterAuth({
    logger: {
      disabled: optionsOnly,
    },
    baseURL: convexSiteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: [frontendUrl, 'http://localhost:3001'].filter(Boolean) as string[],
    plugins: [convex()],
  });

export const getCurrentAuthUser = query({
  args: {},
  handler: async (ctx) => authComponent.getAuthUser(ctx as any),
});

export const requireAuth = async (ctx: GenericCtx<DataModel>) => {
  const authUser = await authComponent.getAuthUser(ctx as any);
  if (!authUser) {
    throw new Error('Authentication required');
  }
  return authUser;
};

export const requireRole = async (
  ctx: GenericCtx<DataModel>,
  allowedRoles: Array<'kid' | 'guardian'>
) => {
  const authUser = await requireAuth(ctx);
  const db = getDb(ctx);
  const authId = (authUser as any).id as string;
  const profile = await db
    .query('users')
    .withIndex('by_auth_id', (q) => q.eq('authId', authId))
    .unique();

  if (!profile) {
    throw new Error('User profile not found');
  }

  if (!allowedRoles.includes(profile.role)) {
    throw new Error('Access denied');
  }

  return { authUser, profile };
};
