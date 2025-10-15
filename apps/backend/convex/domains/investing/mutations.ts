
import { z } from 'zod';
import {
  ApproveInvestmentOrderInputSchema,
  CancelInvestmentOrderInputSchema,
  CreateInvestmentOrderInputSchema,
} from '@guap/types';
import { virtualProvider } from '@guap/providers';
import { defineMutation } from '../../core/functions';
import { ensureOrganizationAccess, ensureRole, OWNER_ADMIN_ROLES } from '../../core/session';
import { logEvent } from '../events/services';
import {
  applyFillToPosition,
  evaluateGuardrailForOrder,
  resolveGuardrailForAccount,
} from './services';

const SubmitOrderArgs = CreateInvestmentOrderInputSchema.shape;
const ApproveOrderArgs = ApproveInvestmentOrderInputSchema.shape;
const CancelOrderArgs = CancelInvestmentOrderInputSchema.shape;
const UpsertWatchlistArgsSchema = z.object({
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
  instrumentType: z.string(),
  notes: z.string().optional(),
});
const RemoveWatchlistArgsSchema = z.object({
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
});

type SessionSnapshot = { userId: string | null };

type GuardrailEvaluation = ReturnType<typeof evaluateGuardrailForOrder>;

const guardrailMetadata = (evaluation: GuardrailEvaluation) => ({
  guardrailId: evaluation.guardrailId,
  guardrailDecision: evaluation.decision,
  guardrailReason: 'reason' in evaluation ? evaluation.reason ?? null : null,
  guardrailSummary: evaluation.summary,
});

const fetchInvestGuardrails = async (db: any, organizationId: string) =>
  await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', organizationId).eq('intent', 'invest')
    )
    .collect();

const executeOrder = async (
  ctx: any,
  order: any,
  session: SessionSnapshot
) => {
  const timestamp = Date.now();
  const fill = await virtualProvider.executeInvestmentOrder({
    organizationId: order.organizationId,
    accountId: order.accountId,
    symbol: order.symbol,
    instrumentType: order.instrumentType,
    side: order.side,
    quantity: order.quantity,
  });

  const { positionId, notionalCents } = await applyFillToPosition(ctx.db, {
    organizationId: order.organizationId,
    accountId: order.accountId,
    symbol: order.symbol,
    instrumentType: order.instrumentType,
    side: order.side,
    quantity: order.quantity,
    unitPrice: fill.price,
  });

  await ctx.db.insert('instrumentSnapshots', {
    symbol: order.symbol,
    price: fill.price,
    capturedAt: fill.filledAt,
    source: 'virtual',
  });

  await ctx.db.patch(order._id, {
    status: 'executed',
    approvedByProfileId: order.approvedByProfileId ?? session.userId ?? 'system',
    approvedAt: order.approvedAt ?? timestamp,
    executedAt: fill.filledAt,
    executionPrice: fill.price,
    notional: { cents: notionalCents, currency: fill.price.currency },
    updatedAt: timestamp,
    failureReason: null,
  });

  await logEvent(ctx.db, {
    organizationId: order.organizationId,
    eventKind: 'order_executed',
    actorProfileId: session.userId,
    primaryEntity: { table: 'investmentOrders', id: order._id },
    relatedEntities: [{ table: 'investmentPositions', id: positionId }],
    payload: {
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: fill.price,
    },
  });

  return await ctx.db.get(order._id);
};

const failOrder = async (ctx: any, order: any, reason: string) => {
  const timestamp = Date.now();
  await ctx.db.patch(order._id, {
    status: 'failed',
    failureReason: reason,
    updatedAt: timestamp,
  });

  await logEvent(ctx.db, {
    organizationId: order.organizationId,
    eventKind: 'order_failed',
    actorProfileId: order.approvedByProfileId ?? order.placedByProfileId ?? null,
    primaryEntity: { table: 'investmentOrders', id: order._id },
    payload: {
      symbol: order.symbol,
      reason,
    },
  });
};

export const submitOrderHandler = async (ctx: any, rawArgs: unknown) => {
  const args = CreateInvestmentOrderInputSchema.parse(rawArgs);
  const session = await ensureOrganizationAccess(ctx, args.organizationId);

  const account = await ctx.db.get(args.accountId as any);
  if (!account || account.organizationId !== args.organizationId) {
    throw new Error('Account not found for organization');
  }

  const quantity = Number(args.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be positive');
  }

  const [quote] = await virtualProvider.getQuotes([args.symbol]);
  if (!quote) {
    throw new Error('No quote available for symbol');
  }

  const notionalCents = Math.round(quantity * quote.price.cents);
  if (notionalCents <= 0) {
    throw new Error('Order amount must be greater than zero');
  }

  const guardrails = await fetchInvestGuardrails(ctx.db, args.organizationId);
  const guardrail = resolveGuardrailForAccount({
    guardrails,
    account,
  });
  const evaluation = evaluateGuardrailForOrder({
    guardrail,
    symbol: args.symbol,
    instrumentType: args.instrumentType,
    side: args.side,
    notionalCents,
  });

  if (evaluation.decision === 'blocked') {
    throw new Error(`Order blocked: ${evaluation.reason}`);
  }

  const timestamp = Date.now();
  const initialStatus = evaluation.decision === 'auto_execute' ? 'pending' : 'awaiting_parent';

  const metadata = {
    ...guardrailMetadata(evaluation),
    quote: quote.price,
  };

  const orderId = await ctx.db.insert('investmentOrders', {
    organizationId: args.organizationId,
    accountId: args.accountId,
    symbol: args.symbol.toUpperCase(),
    instrumentType: args.instrumentType,
    side: args.side,
    orderType: 'market',
    quantity,
    notional: { cents: notionalCents, currency: quote.price.currency },
    limitPrice: null,
    status: initialStatus,
    placedByProfileId: session.userId ?? 'system',
    approvedByProfileId: null,
    submittedAt: timestamp,
    approvedAt: null,
    executedAt: null,
    executionPrice: null,
    transferId: null,
    failureReason: null,
    metadata,
  });

  const orderRecord = await ctx.db.get(orderId);

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'order_submitted',
    actorProfileId: session.userId,
    primaryEntity: { table: 'investmentOrders', id: orderId },
    payload: {
      symbol: args.symbol,
      side: args.side,
      quantity,
      notional: { cents: notionalCents, currency: quote.price.currency },
      guardrailDecision: evaluation.decision,
      guardrailSummary: evaluation.summary,
    },
  });

  if (evaluation.decision === 'auto_execute' && orderRecord) {
    try {
      return await executeOrder(ctx, orderRecord, session);
    } catch (error) {
      await failOrder(ctx, orderRecord, error instanceof Error ? error.message : 'Execution failed');
      throw error;
    }
  }

  return orderRecord;
};

export const approveOrderHandler = async (ctx: any, rawArgs: unknown) => {
  const args = ApproveInvestmentOrderInputSchema.parse(rawArgs);
  const session = await ensureOrganizationAccess(ctx, args.organizationId);
  ensureRole(session, OWNER_ADMIN_ROLES);

  const order = await ctx.db.get(args.orderId as any);
  if (!order || order.organizationId !== args.organizationId) {
    throw new Error('Order not found');
  }

  if (order.status !== 'awaiting_parent') {
    throw new Error('Only pending approvals can be approved');
  }

  await ctx.db.patch(order._id, {
    status: 'approved',
    approvedByProfileId: session.userId ?? 'system',
    approvedAt: Date.now(),
  });

  await logEvent(ctx.db, {
    organizationId: order.organizationId,
    eventKind: 'order_approved',
    actorProfileId: session.userId,
    primaryEntity: { table: 'investmentOrders', id: order._id },
    payload: {
      symbol: order.symbol,
      side: order.side,
    },
  });

  const updated = await ctx.db.get(order._id);
  try {
    return await executeOrder(ctx, updated, session);
  } catch (error) {
    await failOrder(ctx, updated, error instanceof Error ? error.message : 'Execution failed');
    throw error;
  }
};

export const cancelOrderHandler = async (ctx: any, rawArgs: unknown) => {
  const args = CancelInvestmentOrderInputSchema.parse(rawArgs);
  const session = await ensureOrganizationAccess(ctx, args.organizationId);

  const order = await ctx.db.get(args.orderId as any);
  if (!order || order.organizationId !== args.organizationId) {
    throw new Error('Order not found');
  }

  if (order.status === 'executed') {
    throw new Error('Executed orders cannot be canceled');
  }

  const isOwner = session.userId && order.placedByProfileId === session.userId;
  if (!isOwner) {
    ensureRole(session, OWNER_ADMIN_ROLES);
  }

  await ctx.db.patch(order._id, {
    status: 'canceled',
    failureReason: args.reason ?? 'canceled',
    updatedAt: Date.now(),
  });

  await logEvent(ctx.db, {
    organizationId: order.organizationId,
    eventKind: 'order_failed',
    actorProfileId: session.userId,
    primaryEntity: { table: 'investmentOrders', id: order._id },
    payload: {
      symbol: order.symbol,
      reason: args.reason ?? 'canceled',
    },
  });

  return await ctx.db.get(order._id);
};

export const upsertWatchlistEntryHandler = async (ctx: any, rawArgs: unknown) => {
  const args = UpsertWatchlistArgsSchema.parse(rawArgs);
  const session = await ensureOrganizationAccess(ctx, args.organizationId);
  if (session.userId !== args.profileId) {
    ensureRole(session, OWNER_ADMIN_ROLES);
  }

  const existing = await ctx.db
    .query('watchlistEntries')
    .withIndex('by_profile_symbol', (q: any) =>
      q.eq('profileId', args.profileId).eq('symbol', args.symbol.toUpperCase())
    )
    .unique();

  const timestamp = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      notes: args.notes ?? null,
      instrumentType: args.instrumentType,
    });
    return await ctx.db.get(existing._id);
  }

  const entryId = await ctx.db.insert('watchlistEntries', {
    organizationId: args.organizationId,
    profileId: args.profileId,
    symbol: args.symbol.toUpperCase(),
    instrumentType: args.instrumentType,
    createdAt: timestamp,
    notes: args.notes ?? null,
  });

  return await ctx.db.get(entryId);
};

export const removeWatchlistEntryHandler = async (ctx: any, rawArgs: unknown) => {
  const args = RemoveWatchlistArgsSchema.parse(rawArgs);
  const session = await ensureOrganizationAccess(ctx, args.organizationId);
  if (session.userId !== args.profileId) {
    ensureRole(session, OWNER_ADMIN_ROLES);
  }

  const entry = await ctx.db
    .query('watchlistEntries')
    .withIndex('by_profile_symbol', (q: any) =>
      q.eq('profileId', args.profileId).eq('symbol', args.symbol.toUpperCase())
    )
    .unique();

  if (entry) {
    await ctx.db.delete(entry._id);
  }
};

export const submitOrder = defineMutation({
  args: SubmitOrderArgs,
  handler: submitOrderHandler,
});

export const approveOrder = defineMutation({
  args: ApproveOrderArgs,
  handler: approveOrderHandler,
});

export const cancelOrder = defineMutation({
  args: CancelOrderArgs,
  handler: cancelOrderHandler,
});

export const upsertWatchlistEntry = defineMutation({
  args: UpsertWatchlistArgsSchema.shape,
  handler: upsertWatchlistEntryHandler,
});

export const removeWatchlistEntry = defineMutation({
  args: RemoveWatchlistArgsSchema.shape,
  handler: removeWatchlistEntryHandler,
});
