import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { components } from '@guap/api/codegen/api';
import type { DataModel } from '@guap/api/codegen/dataModel';
import { query } from '@guap/api/codegen/server';
import { betterAuth } from 'better-auth';
import { admin, magicLink, organization, jwt, oneTimeToken } from 'better-auth/plugins';
import authSchema from './generated/schema';
import { sendMagicLinkEmail, sendOrganizationInvitationEmail } from './magicLinkEmail';

const convexSiteUrl = process.env.CONVEX_SITE_URL ?? '';
const resolvedConvexSiteUrl = convexSiteUrl || 'http://localhost:3000';
const frontendSiteUrl = process.env.SITE_URL ?? (convexSiteUrl || 'http://localhost:3001');

const toOrigin = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const trustedOriginsSet = new Set<string>();
const resolvedBaseOrigin = toOrigin(resolvedConvexSiteUrl);
const frontendOrigin = toOrigin(frontendSiteUrl);
if (resolvedBaseOrigin) trustedOriginsSet.add(resolvedBaseOrigin);
if (frontendOrigin) trustedOriginsSet.add(frontendOrigin);

if (process.env.NODE_ENV !== 'production') {
  ['http://localhost:3001', 'http://127.0.0.1:3001'].forEach((value) => {
    const origin = toOrigin(value);
    if (origin) trustedOriginsSet.add(origin);
  });
}

const trustedOrigins = Array.from(trustedOriginsSet);

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: {
    schema: authSchema,
  },
  verbose: true,
});

const buildAuthOptions = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly }: { optionsOnly: boolean }
) => ({
  logger: {
    disabled: optionsOnly,
  },
  baseURL: resolvedConvexSiteUrl,
  trustedOrigins,
  database: authComponent.adapter(ctx),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        await sendMagicLinkEmail({ email, url, token });
      },
    }),
    oneTimeToken(),
    organization({
      sendInvitationEmail: async ({ email, id, role, organization: org, inviter }) => {
        const base = frontendSiteUrl || convexSiteUrl || 'http://localhost:3001';
        let invitationUrl: string;
        try {
          invitationUrl = new URL(`/auth/accept-invite/${id}`, base).toString();
        } catch {
          const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
          invitationUrl = `${trimmedBase}/auth/accept-invite/${id}`;
        }

        const orgRecord = (org ?? {}) as Record<string, unknown>;
        const organizationName =
          typeof orgRecord.name === 'string'
            ? (orgRecord.name as string)
            : typeof orgRecord.slug === 'string'
              ? (orgRecord.slug as string)
              : 'your organization';

        const inviterRecord = (inviter ?? {}) as Record<string, unknown>;
        const inviterUser = (inviterRecord.user ?? {}) as Record<string, unknown>;
        const inviterName =
          (typeof inviterRecord.name === 'string' && (inviterRecord.name as string)) ||
          (typeof inviterUser.name === 'string' && (inviterUser.name as string)) ||
          (typeof inviterUser.email === 'string' && (inviterUser.email as string)) ||
          (typeof inviterRecord.email === 'string' && (inviterRecord.email as string)) ||
          null;

        await sendOrganizationInvitationEmail({
          email,
          invitationUrl,
          organizationName,
          role: typeof role === 'string' ? role : null,
          inviterName,
        });
      },
    }),
    admin(),
    jwt(),
    crossDomain({
      siteUrl: frontendSiteUrl,
    }),
    convex(),
  ],
});

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly }: { optionsOnly?: boolean } = { optionsOnly: false }
) => betterAuth(buildAuthOptions(ctx, { optionsOnly: Boolean(optionsOnly) }));

export const auth = createAuth({} as GenericCtx<DataModel>, { optionsOnly: true });

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
