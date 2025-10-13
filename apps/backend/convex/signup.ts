import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { OrganizationKindValues, UserRoleValues } from '@guap/types';
import { requireAuth, createAuth, authComponent } from './auth';

const roleArg = v.union(...UserRoleValues.map((value) => v.literal(value)));
const organizationKindArg = v.union(
  ...OrganizationKindValues.map((value) => v.literal(value))
);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const slugFromName = (name: string) => {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'organization';
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
};

export const record = mutation({
  args: {
    email: v.string(),
    role: roleArg,
    organizationName: v.optional(v.string()),
    organizationKind: organizationKindArg,
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const timestamp = Date.now();

    const existing = await ctx.db
      .query('signupRequests')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    const payload = {
      email,
      role: args.role,
      organizationName: args.organizationName?.trim() || undefined,
      organizationKind: args.organizationKind,
      createdAt: timestamp,
      processedAt: undefined as number | undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert('signupRequests', payload);
    }
  },
});

export const recordInvite = mutation({
  args: {
    invitationId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invitationId = args.invitationId.trim();
    if (!invitationId) {
      throw new Error('Invitation id is required');
    }

    const normalizedEmail = args.email ? normalizeEmail(args.email) : undefined;
    const timestamp = Date.now();

    const existing = await ctx.db
      .query('pendingInvites')
      .withIndex('by_invitation', (q) => q.eq('invitationId', invitationId))
      .unique();

    const payload = {
      invitationId,
      email: normalizedEmail,
      createdAt: timestamp,
      processedAt: undefined as number | undefined,
      lastError: undefined as string | undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert('pendingInvites', payload);
    }
  },
});

export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await requireAuth(ctx);
    const sessionUser = {
      ...(authUser as any)?.session?.user,
      ...(authUser as any)?.user,
    } as Record<string, unknown>;

    const emailValue = sessionUser.email;
    const email =
      typeof emailValue === 'string' ? normalizeEmail(emailValue) : null;
    if (!email) {
      return { shouldRefresh: false };
    }

    const pending = await ctx.db
      .query('signupRequests')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    if (!pending) {
      return { shouldRefresh: false };
    }

    const auth = createAuth(ctx as any);
    const headers = await authComponent.getHeaders(ctx as any);

    let shouldRefresh = false;
    const activeOrganizationId =
      typeof sessionUser.activeOrganizationId === 'string'
        ? (sessionUser.activeOrganizationId as string)
        : typeof sessionUser.organizationId === 'string'
        ? (sessionUser.organizationId as string)
        : null;

    if (!activeOrganizationId && pending.role === 'owner') {
      const organizationName = pending.organizationName;
      if (organizationName) {
        const organizationType =
          pending.organizationKind === 'institution' ? 'school' : 'household';
        const slug = slugFromName(organizationName);

        const createResponse = await auth.api.createOrganization({
          body: {
            name: organizationName,
            slug,
            metadata: { type: organizationType },
          },
          headers,
        });

        const organizationId =
          (createResponse as any)?.data?.organization?.id ??
          (createResponse as any)?.data?.id ??
          null;

        if (organizationId) {
          await auth.api.setActiveOrganization({
            body: { organizationId },
            headers,
          });
          shouldRefresh = true;
        }
      }
    }

    await ctx.db.delete(pending._id);

    const invites = await ctx.db.query('pendingInvites').collect();
    for (const invite of invites) {
      if (invite.processedAt) {
        continue;
      }

      try {
        await auth.api.acceptInvitation({
          body: { invitationId: invite.invitationId },
          headers,
        });
        shouldRefresh = true;
        await ctx.db.patch(invite._id, {
          processedAt: Date.now(),
          lastError: undefined,
        });
      } catch (error) {
        console.warn('Failed to accept invitation', invite.invitationId, error);
        await ctx.db.patch(invite._id, {
          processedAt: Date.now(),
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { shouldRefresh };
  },
});
