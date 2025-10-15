import { z } from 'zod';
import { UpsertLiabilityTermsInputSchema } from '@guap/types';
import { defineMutation } from '../../core/functions';
import {
  ensureOrganizationAccess,
  ensureRole,
  OWNER_ADMIN_ROLES,
} from '../../core/session';

const UpsertLiabilityTermsArgs = UpsertLiabilityTermsInputSchema.shape;

export const upsertTerms = defineMutation({
  args: UpsertLiabilityTermsArgs,
  handler: async (ctx, rawArgs) => {
    const args = UpsertLiabilityTermsInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const existing = await ctx.db
      .query('liabilityTerms')
      .withIndex('by_account', (q: any) => q.eq('accountId', args.accountId))
      .unique();

    const payload = {
      liabilityType: args.liabilityType,
      originPrincipal: args.originPrincipal,
      interestRate: args.interestRate,
      minimumPayment: args.minimumPayment,
      statementDay: args.statementDay ?? null,
      dueDay: args.dueDay ?? null,
      maturesAt: args.maturesAt ?? null,
      openedAt: args.openedAt,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    const timestamp = Date.now();
    const termId = await ctx.db.insert('liabilityTerms', {
      organizationId: args.organizationId,
      accountId: args.accountId,
      ...payload,
      createdAt: timestamp,
    });

    return termId;
  },
});
