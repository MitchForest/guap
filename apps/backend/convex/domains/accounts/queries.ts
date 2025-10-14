import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const ListAccountsArgs = {
  organizationId: z.string(),
} as const;

export const listForOrganization = defineQuery({
  args: ListAccountsArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListAccountsArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    return await ctx.db
      .query('financialAccounts')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
      .collect();
  },
});

const GetAccountArgs = {
  accountId: zid('financialAccounts'),
} as const;

export const getById = defineQuery({
  args: GetAccountArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(GetAccountArgs).parse(rawArgs);
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return null;
    }
    await ensureOrganizationAccess(ctx, account.organizationId);
    return account;
  },
});

const ListSnapshotsArgs = {
  accountId: zid('financialAccounts'),
  limit: z.number().int().min(1).max(90).optional(),
} as const;

export const listSnapshots = defineQuery({
  args: ListSnapshotsArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListSnapshotsArgs).parse(rawArgs);
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    await ensureOrganizationAccess(ctx, account.organizationId);
    const limit = args.limit ?? 30;

    return await ctx.db
      .query('accountSnapshots')
      .withIndex('by_account_time', (q: any) => q.eq('accountId', args.accountId))
      .order('desc')
      .take(limit);
  },
});
