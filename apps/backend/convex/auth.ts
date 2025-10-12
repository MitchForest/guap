import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { components } from '@guap/api/codegen/api';
import type { DataModel } from '@guap/api/codegen/dataModel';
import { query } from '@guap/api/codegen/server';
import { betterAuth } from 'better-auth';
import { admin, magicLink, organization } from 'better-auth/plugins';
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

  return {
    logger: {
      disabled: optionsOnly,
    },
    baseURL: convexSiteUrl,
    trustedOrigins,
    database,
    user: {
      additionalFields: {
        userId: {
          type: 'string' as const,
          input: false,
        },
      },
    },
    plugins: optionsOnly ? basePlugins : [...basePlugins, convex()],
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
