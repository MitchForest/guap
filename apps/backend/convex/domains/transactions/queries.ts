import { z } from 'zod';
import {
  NeedsVsWantsSchema,
  TransactionDirectionSchema,
  TransactionStatusSchema,
} from '@guap/types';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const ListTransactionsArgs = {
  organizationId: z.string(),
  accountId: z.string().optional(),
  categoryKey: z.string().optional(),
  direction: TransactionDirectionSchema.optional(),
  status: TransactionStatusSchema.optional(),
  needsVsWants: NeedsVsWantsSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
} as const;

const ListTransactionsSchema = z.object(ListTransactionsArgs);

export const listTransactionsImpl = async (ctx: any, args: z.infer<typeof ListTransactionsSchema>) => {
  await ensureOrganizationAccess(ctx, args.organizationId);
  const limit = args.limit ?? 100;

  let query = ctx.db
    .query('transactions')
    .withIndex('by_org_category_time', (q: any) =>
      q.eq('organizationId', args.organizationId)
    )
    .order('desc');

  if (args.categoryKey) {
    query = query.eq('categoryKey', args.categoryKey);
  }

  const rows = await query.take(limit * 2);
  const filtered = rows.filter((transaction: any) => {
    if (args.accountId && transaction.accountId !== args.accountId) return false;
    if (args.direction && transaction.direction !== args.direction) return false;
    if (args.status && transaction.status !== args.status) return false;
    if (args.needsVsWants && transaction.needsVsWants !== args.needsVsWants) return false;
    return true;
  });

  return filtered.slice(0, limit);
};

export const listForOrganization = defineQuery({
  args: ListTransactionsArgs,
  handler: async (ctx, rawArgs) => {
    const args = ListTransactionsSchema.parse(rawArgs);
    return await listTransactionsImpl(ctx, args);
  },
});

const ListCategoryRulesArgs = {
  organizationId: z.string(),
} as const;

export const listCategoryRules = defineQuery({
  args: ListCategoryRulesArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListCategoryRulesArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    return await ctx.db
      .query('categoryRules')
      .withIndex('by_organization_priority', (q: any) =>
        q.eq('organizationId', args.organizationId)
      )
      .order('desc')
      .collect();
  },
});
