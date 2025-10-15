import { z } from 'zod';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';
import {
  loadBudgetsWithActuals,
  summarizeBudgets,
} from './services';

const ListBudgetsArgs = {
  organizationId: z.string(),
  periodKey: z.string().optional(),
  includeArchived: z.boolean().optional(),
} as const;

const SummaryArgs = {
  organizationId: z.string(),
  periodKey: z.string().optional(),
} as const;

export const listForOrganization = defineQuery({
  args: ListBudgetsArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListBudgetsArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    let query = ctx.db
      .query('budgets')
      .withIndex('by_org_period', (q: any) =>
        q.eq('organizationId', args.organizationId)
      );

    if (args.periodKey) {
      query = query.eq('periodKey', args.periodKey);
    }

    const includeArchived = args.includeArchived ?? false;
    const records = await query.collect();
    const activeBudgets = includeArchived
      ? records
      : records.filter((item: any) => item.archivedAt == null);

    if (!activeBudgets.length) {
      return [];
    }

    return await loadBudgetsWithActuals(ctx.db, activeBudgets);
  },
});

export const summarizeForOrganization = defineQuery({
  args: SummaryArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(SummaryArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    let query = ctx.db
      .query('budgets')
      .withIndex('by_org_period', (q: any) =>
        q.eq('organizationId', args.organizationId)
      );

    if (args.periodKey) {
      query = query.eq('periodKey', args.periodKey);
    }

    const budgets = await query.collect();
    const active = budgets.filter((item: any) => item.archivedAt == null);
    if (!active.length) {
      return null;
    }

    const records = await loadBudgetsWithActuals(ctx.db, active);
    return summarizeBudgets(records);
  },
});
