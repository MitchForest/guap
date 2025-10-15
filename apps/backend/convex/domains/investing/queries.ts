import { z } from 'zod';
import { OrderStatusSchema } from '@guap/types';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';
import { resolveGuardrailForAccount, evaluateGuardrailForOrder, summarizeGuardrail } from './services';

const ListPositionsArgs = {
  organizationId: z.string(),
} as const;

const ListOrdersArgs = {
  organizationId: z.string(),
  status: z.array(OrderStatusSchema).optional(),
  limit: z.number().min(1).max(200).optional(),
} as const;

const GetOrderArgs = {
  organizationId: z.string(),
  orderId: z.string(),
} as const;

const ListWatchlistArgs = {
  organizationId: z.string(),
  profileId: z.string().optional(),
} as const;

const GetGuardrailArgs = {
  organizationId: z.string(),
  accountId: z.string(),
  symbol: z.string().optional(),
  instrumentType: z.string().optional(),
  side: z.enum(['buy', 'sell']).optional(),
  notionalCents: z.number().optional(),
} as const;

const ListSnapshotsArgs = {
  symbol: z.string(),
  limit: z.number().min(1).max(90).optional(),
} as const;

export const listPositionsHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListPositionsArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);

  return await ctx.db
    .query('investmentPositions')
    .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
    .collect();
};

export const listOrdersHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListOrdersArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);
  const limit = args.limit ?? 100;

  const records = await ctx.db
    .query('investmentOrders')
    .withIndex('by_organization_status', (q: any) => q.eq('organizationId', args.organizationId))
    .collect();

  const statuses = args.status ?? null;
  const filtered =
    statuses && statuses.length
      ? records.filter((order: any) => statuses.includes(order.status))
      : records;

  return filtered
    .sort((a: any, b: any) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
    .slice(0, limit);
};

export const getOrderByIdHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(GetOrderArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);
  const order = await ctx.db.get(args.orderId as any);
  if (!order || order.organizationId !== args.organizationId) {
    return null;
  }
  return order;
};

export const listWatchlistEntriesHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListWatchlistArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);

  return await ctx.db
    .query('watchlistEntries')
    .withIndex('by_organization_profile', (q: any) => {
      const builder = q.eq('organizationId', args.organizationId);
      return args.profileId ? builder.eq('profileId', args.profileId) : builder;
    })
    .collect();
};

export const getGuardrailSummaryHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(GetGuardrailArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);
  const account = await ctx.db.get(args.accountId as any);
  if (!account || account.organizationId !== args.organizationId) {
    throw new Error('Account not found');
  }

  const guardrails = await ctx.db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', args.organizationId).eq('intent', 'invest')
    )
    .collect();

  const guardrail = resolveGuardrailForAccount({
    guardrails,
    account,
  });

  if (args.symbol && args.instrumentType && args.side && typeof args.notionalCents === 'number') {
    return evaluateGuardrailForOrder({
      guardrail,
      symbol: args.symbol,
      instrumentType: args.instrumentType,
      side: args.side,
      notionalCents: args.notionalCents,
    });
  }

  const summary = summarizeGuardrail(guardrail);
  const decision =
    summary.approvalPolicy === 'auto'
      ? 'auto_execute'
      : summary.approvalPolicy === 'admin_only'
        ? 'needs_admin'
        : 'needs_parent';

  return {
    decision,
    summary,
    guardrailId: guardrail?._id ?? null,
  };
};

export const listInstrumentSnapshotsHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListSnapshotsArgs).parse(rawArgs);
  const limit = args.limit ?? 30;

  return await ctx.db
    .query('instrumentSnapshots')
    .withIndex('by_symbol_time', (q: any) => q.eq('symbol', args.symbol.toUpperCase()))
    .order('desc')
    .take(limit);
};

export const listPositions = defineQuery({
  args: ListPositionsArgs,
  handler: listPositionsHandler,
});

export const listOrders = defineQuery({
  args: ListOrdersArgs,
  handler: listOrdersHandler,
});

export const getOrderById = defineQuery({
  args: GetOrderArgs,
  handler: getOrderByIdHandler,
});

export const listWatchlistEntries = defineQuery({
  args: ListWatchlistArgs,
  handler: listWatchlistEntriesHandler,
});

export const getGuardrailSummary = defineQuery({
  args: GetGuardrailArgs,
  handler: getGuardrailSummaryHandler,
});

export const listInstrumentSnapshots = defineQuery({
  args: ListSnapshotsArgs,
  handler: listInstrumentSnapshotsHandler,
});
