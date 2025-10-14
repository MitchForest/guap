import { z } from 'zod';
import { OrganizationKindValues, UserRoleValues } from '@guap/types';
import { getAuthContext, slugFromName } from './services';
import { requireAuth } from '../../core/auth';
import { defineMutation } from '../../core/functions';

const CompleteSignupArgs = {
  role: z.enum(UserRoleValues),
  organizationKind: z.enum(OrganizationKindValues),
  organizationName: z.string().optional(),
} as const;

const CompleteSignupSchema = z.object(CompleteSignupArgs);

export const completeSignup = defineMutation({
  args: CompleteSignupArgs,
  handler: async (ctx, rawArgs) => {
    const args = CompleteSignupSchema.parse(rawArgs);

    const authUser = await requireAuth(ctx);
    const sessionUser = {
      ...(authUser as any)?.session?.user,
      ...(authUser as any)?.user,
    } as Record<string, unknown>;

    const activeOrganizationId =
      typeof sessionUser.activeOrganizationId === 'string'
        ? (sessionUser.activeOrganizationId as string)
        : typeof sessionUser.organizationId === 'string'
          ? (sessionUser.organizationId as string)
          : null;

    if (args.role !== 'owner') {
      return { shouldRefresh: false, organizationId: activeOrganizationId };
    }

    if (activeOrganizationId) {
      return { shouldRefresh: false, organizationId: activeOrganizationId };
    }

    const organizationName = args.organizationName?.trim();
    if (!organizationName) {
      throw new Error('Organization name is required for owner signup');
    }

    const { auth, headers } = await getAuthContext(ctx);
    const organizationType =
      args.organizationKind === 'institution' ? 'school' : 'household';
    const slug = slugFromName(organizationName);

    const createResponse = await auth.api.createOrganization({
      body: {
        name: organizationName,
        slug,
        metadata: { type: organizationType },
      },
      headers,
    });

    const organization =
      (createResponse as any)?.data?.organization ??
      (createResponse as any)?.data ??
      null;

    const organizationId =
      organization && typeof organization === 'object'
        ? (organization as Record<string, unknown>)?.id
        : null;

    if (!organizationId || typeof organizationId !== 'string') {
      throw new Error('Organization creation failed');
    }

    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers,
    });

    return { shouldRefresh: true, organizationId };
  },
});
