import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { components } from '@guap/api/codegen/api';
import type { DataModel } from '@guap/api/codegen/dataModel';
import { query } from '@guap/api/codegen/server';
import { betterAuth } from 'better-auth';
import { admin, magicLink, organization } from 'better-auth/plugins';
import { createAuthMiddleware } from 'better-auth/api';
import Stripe from 'stripe';
import { stripe as stripePlugin } from '@better-auth/stripe';
import { sendMagicLinkEmail } from './magicLinkEmail';
import authSchema from './betterAuth/schema';

const convexSiteUrl = process.env.CONVEX_SITE_URL ?? '';
const frontendUrl = process.env.SITE_URL ?? 'http://localhost:3001';

const buildStripePlugin = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_placeholder';
  const isStubConfig =
    !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET;

  if (isStubConfig && process.env.NODE_ENV !== 'test') {
    console.warn(
      '[auth] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing – using placeholder keys until real credentials are provided.'
    );
  }

  const stripeClient = new Stripe(stripeSecretKey);

  return stripePlugin({
    stripeClient,
    stripeWebhookSecret,
    createCustomerOnSignUp: true,
  });
};

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: {
    schema: authSchema,
  },
  verbose: true,
});

const trustedOrigins = [frontendUrl].filter(Boolean) as string[];

const CANONICAL_ROLES = ['owner', 'admin', 'member'] as const;
type CanonicalRole = (typeof CANONICAL_ROLES)[number];
const CANONICAL_ROLE_SET = new Set<CanonicalRole>(CANONICAL_ROLES);

const toCanonicalRole = (value: unknown): CanonicalRole | null => {
  if (typeof value !== 'string') {
    return null;
  }
  return CANONICAL_ROLE_SET.has(value as CanonicalRole) ? (value as CanonicalRole) : null;
};

type CreateAuthArgs = {
  ctx?: GenericCtx<DataModel>;
  optionsOnly?: boolean;
};

const createAuthOptions = ({ ctx, optionsOnly = false }: CreateAuthArgs) => {
  const basePlugins = [
    magicLink({
      sendMagicLink: async ({ email, url, token }) =>
        sendMagicLinkEmail({ email, url, token }),
    }),
    admin(),
    organization(),
    buildStripePlugin(),
    crossDomain({
      siteUrl: frontendUrl,
    }),
  ];

  const adapterCtx = ctx ?? ({} as GenericCtx<DataModel>);
  const database = authComponent.adapter(adapterCtx);

  const roleSyncHook =
    optionsOnly === false
      ? createAuthMiddleware(async (ctx) => {
          const newSession = ctx.context.newSession;
          if (!newSession) {
            return;
          }

          const user = (newSession.user ?? {}) as Record<string, unknown>;
          const sessionUser = (newSession.session?.user ?? {}) as Record<string, unknown>;
          const userId = typeof user.id === 'string' ? (user.id as string) : null;
          if (!userId) {
            return;
          }

          const primaryRole =
            toCanonicalRole(sessionUser.role) ?? toCanonicalRole(user.role) ?? null;

          let targetRole: CanonicalRole | null = primaryRole;

          const activeOrganizationId =
            (typeof sessionUser.activeOrganizationId === 'string'
              ? sessionUser.activeOrganizationId
              : undefined) ??
            (typeof sessionUser.organizationId === 'string'
              ? sessionUser.organizationId
              : undefined) ??
            null;

          if (!targetRole && activeOrganizationId) {
            try {
              const membership = await (ctx.context.internalAdapter as any)?.findMemberByOrgId?.({
                userId,
                organizationId: activeOrganizationId,
              });
              const membershipRole = toCanonicalRole(membership?.role);
              if (membershipRole) {
                targetRole = membershipRole;
              }
            } catch (error) {
              console.warn('[auth] Unable to determine membership role', error);
            }
          }

          if (!targetRole) {
            targetRole = 'member';
          }

          const existingRole = toCanonicalRole(user.role);
          if (existingRole === targetRole) {
            return;
          }

          try {
            await (ctx.context.internalAdapter as any)?.updateUser?.(
              userId,
              {
                role: targetRole,
              },
              ctx
            );
          } catch (error) {
            console.error('[auth] Failed to synchronize Better Auth user role', error);
          }
        })
      : null;

  return {
    logger: {
      disabled: optionsOnly,
    },
    baseURL: convexSiteUrl,
    trustedOrigins,
    database,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        userId: {
          type: 'string' as const,
          input: false,
        },
      },
    },
    plugins: optionsOnly ? basePlugins : [...basePlugins, convex()],
    hooks: roleSyncHook ? { after: roleSyncHook } : undefined,
  };
};

export const auth = betterAuth(createAuthOptions({ optionsOnly: true }));

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) =>
  betterAuth(
    createAuthOptions({
      ctx,
      optionsOnly,
    })
  );

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

export const requireRole = async (ctx: GenericCtx<DataModel>, allowedRoles: Array<string>) => {
  const authUser = await requireAuth(ctx);
  const role =
    (authUser as any)?.session?.user?.role ??
    (authUser as any)?.user?.role ??
    null;

  if (!role || !allowedRoles.includes(role)) {
    throw new Error('Access denied');
  }

  return authUser;
};
