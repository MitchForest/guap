import { z } from 'zod';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const ListLiabilitiesArgs = {
  organizationId: z.string(),
} as const;

const GetLiabilityArgs = {
  accountId: z.string(),
} as const;

export const listForOrganization = defineQuery({
  args: ListLiabilitiesArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListLiabilitiesArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    const accounts = await ctx.db
      .query('financialAccounts')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
      .collect();

    const terms: any[] = [];
    for (const account of accounts) {
      if (account.kind !== 'credit' && account.kind !== 'liability') continue;
      const record = await ctx.db
        .query('liabilityTerms')
        .withIndex('by_account', (q: any) => q.eq('accountId', account._id))
        .unique();
      if (record) {
        terms.push(record);
      }
    }

    return terms;
  },
});

export const getByAccount = defineQuery({
  args: GetLiabilityArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(GetLiabilityArgs).parse(rawArgs);
    const record = await ctx.db
      .query('liabilityTerms')
      .withIndex('by_account', (q: any) => q.eq('accountId', args.accountId))
      .unique();

    if (!record) {
      return null;
    }

    await ensureOrganizationAccess(ctx, record.organizationId);
    return record;
  },
});
