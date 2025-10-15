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
  search: z.string().optional(),
  sort: z
    .enum(['occurredAt', '-occurredAt', 'amount', '-amount'])
    .optional(),
} as const;

const ListTransactionsSchema = z.object(ListTransactionsArgs);

export const listTransactionsImpl = async (ctx: any, args: z.infer<typeof ListTransactionsSchema>) => {
  await ensureOrganizationAccess(ctx, args.organizationId);
  const limit = args.limit ?? 100;

  const query = args.categoryKey
    ? ctx.db
        .query('transactions')
        .withIndex('by_org_category_time', (q: any) =>
          q.eq('organizationId', args.organizationId).eq('categoryKey', args.categoryKey)
        )
        .order('desc')
    : ctx.db
        .query('transactions')
        .withIndex('by_org_time', (q: any) =>
          q.eq('organizationId', args.organizationId)
        )
        .order('desc');

  const rows = await query.take(Math.min(limit * 4, 800));
  const searchTerm = args.search?.trim().toLowerCase() ?? null;

  let filtered = rows.filter((transaction: any) => {
    if (args.accountId && transaction.accountId !== args.accountId) return false;
    if (args.direction && transaction.direction !== args.direction) return false;
    if (args.status && transaction.status !== args.status) return false;
    if (args.needsVsWants && transaction.needsVsWants !== args.needsVsWants) return false;
    if (searchTerm) {
      const merchant = (transaction.merchantName ?? '').toLowerCase();
      const description = (transaction.description ?? '').toLowerCase();
      if (!merchant.includes(searchTerm) && !description.includes(searchTerm)) {
        return false;
      }
    }
    return true;
  });

  if (args.sort) {
    const direction = args.sort.startsWith('-') ? -1 : 1;
    const field = args.sort.replace(/^[-]/, '');
    filtered = filtered.sort((a: any, b: any) => {
      if (field === 'amount') {
        const aValue = Math.abs(a.amount?.cents ?? 0);
        const bValue = Math.abs(b.amount?.cents ?? 0);
        return (aValue - bValue) * direction;
      }
      const aValue = a.occurredAt ?? a.createdAt ?? 0;
      const bValue = b.occurredAt ?? b.createdAt ?? 0;
      return (aValue - bValue) * direction;
    });
  }

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
