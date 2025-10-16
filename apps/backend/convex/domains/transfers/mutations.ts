import type { Id } from '@guap/api/codegen/dataModel';
import { z } from 'zod';
import { TransferStatusSchema, CurrencyAmountSchema } from '@guap/types';
import { zid } from 'convex-helpers/server/zod';
import { defineMutation } from '../../core/functions';
import { ensureOrganizationAccess, ensureRole, OWNER_ADMIN_ROLES } from '../../core/session';
import { logEvent } from '../events/services';
import { advanceStreamSchedule } from '../earn/services';
import { evaluateGuardrailForSpend } from './services';

const UpdateStatusArgs = {
  transferId: zid('transfers'),
  status: TransferStatusSchema,
} as const;

const InitiateSpendTransferArgs = {
  organizationId: z.string(),
  sourceAccountId: z.string(),
  destinationAccountId: z.string(),
  amount: CurrencyAmountSchema,
  memo: z.string().optional(),
} as const;

const handleIncomeTransferSideEffects = async (
  ctx: any,
  params: {
    transferId: Id<'transfers'>;
    status: 'executed' | 'declined';
    streamId: string;
    metadata: Record<string, unknown>;
    timestamp: number;
    actorProfileId: string | null;
  }
) => {
  const stream = await ctx.db.get(params.streamId as any);
  if (!stream) {
    return;
  }

  const scheduledFor =
    typeof params.metadata.scheduledFor === 'number'
      ? (params.metadata.scheduledFor as number)
      : null;

  if (params.status === 'executed') {
    const nextScheduledAt = stream.autoSchedule
      ? advanceStreamSchedule(stream, scheduledFor ?? params.timestamp)
      : stream.nextScheduledAt ?? null;

    await ctx.db.patch(stream._id, {
      lastPaidAt: params.timestamp,
      nextScheduledAt,
      updatedAt: Date.now(),
    });

    await logEvent(ctx.db, {
      organizationId: stream.organizationId,
      eventKind: 'income_completed',
      actorProfileId: params.actorProfileId,
      primaryEntity: { table: 'incomeStreams', id: stream._id },
      relatedEntities: [{ table: 'transfers', id: params.transferId }],
      payload: {
        amount: params.metadata.amount ?? null,
        executedAt: params.timestamp,
        scheduledFor,
        streamName: stream.name,
      },
    });
  } else if (params.status === 'declined') {
    const nextScheduledAt = stream.autoSchedule
      ? advanceStreamSchedule(stream, scheduledFor ?? params.timestamp)
      : stream.nextScheduledAt ?? null;

    await ctx.db.patch(stream._id, {
      nextScheduledAt,
      updatedAt: Date.now(),
    });

    await logEvent(ctx.db, {
      organizationId: stream.organizationId,
      eventKind: 'income_skipped',
      actorProfileId: params.actorProfileId,
      primaryEntity: { table: 'incomeStreams', id: stream._id },
      relatedEntities: [{ table: 'transfers', id: params.transferId }],
      payload: {
        scheduledFor,
        reason: 'declined',
        streamName: stream.name,
      },
    });
  }
};

export const updateStatus = defineMutation({
  args: UpdateStatusArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(UpdateStatusArgs).parse(rawArgs);
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    const session = await ensureOrganizationAccess(ctx, transfer.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const timestamp = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: timestamp,
    };

    if (args.status === 'approved' || args.status === 'executed') {
      patch.approvedByProfileId = session.userId ?? null;
    }

    if (args.status === 'approved' && !transfer.approvedAt) {
      patch.approvedAt = timestamp;
    }

    if (args.status === 'executed') {
      patch.executedAt = timestamp;
    }

    await ctx.db.patch(args.transferId, patch);

    const metadata = (transfer.metadata ?? {}) as Record<string, unknown>;
    const incomeStreamId =
      typeof metadata.incomeStreamId === 'string' ? (metadata.incomeStreamId as string) : null;

    const eventKind =
      args.status === 'approved'
        ? 'transfer_approved'
        : args.status === 'declined'
          ? 'transfer_declined'
          : args.status === 'executed'
            ? 'transfer_executed'
            : 'transfer_requested';

    await logEvent(ctx.db, {
      organizationId: transfer.organizationId,
      eventKind,
      actorProfileId: session.userId,
      primaryEntity: { table: 'transfers', id: args.transferId },
      payload: {
        previousStatus: transfer.status,
        status: args.status,
      },
    });

    if (incomeStreamId && (args.status === 'executed' || args.status === 'declined')) {
      await handleIncomeTransferSideEffects(ctx, {
        transferId: args.transferId as any,
        status: args.status,
        streamId: incomeStreamId,
        metadata,
        timestamp,
        actorProfileId: session.userId,
      });
    }

    return { ...transfer, ...patch };
  },
});

const InitiateSpendTransferSchema = z.object(InitiateSpendTransferArgs);

export const initiateSpendTransfer = defineMutation({
  args: InitiateSpendTransferArgs,
  handler: async (ctx, rawArgs) => {
    const args = InitiateSpendTransferSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await initiateSpendTransferImpl(ctx, args, session);
  },
});

export const initiateSpendTransferImpl = async (
  ctx: any,
  args: z.infer<typeof InitiateSpendTransferSchema>,
  session: { userId: string | null }
) => {
  const [sourceAccount, destinationAccount] = await Promise.all([
    ctx.db.get(args.sourceAccountId as any),
    ctx.db.get(args.destinationAccountId as any),
  ]);

  if (!sourceAccount || sourceAccount.organizationId !== args.organizationId) {
    throw new Error('Source account not found');
  }

  if (!destinationAccount || destinationAccount.organizationId !== args.organizationId) {
    throw new Error('Destination account not found');
  }

  const amountCents = Math.round(args.amount.cents);
  if (amountCents <= 0) {
    throw new Error('Transfer amount must be positive');
  }

  const guardrail = await evaluateGuardrailForSpend(ctx.db, {
    organizationId: args.organizationId,
    destinationAccountId: args.destinationAccountId,
    amountCents,
  });

  const timestamp = Date.now();
  const shouldExecute = guardrail.shouldExecute;

  const status: 'pending_approval' | 'approved' | 'executed' = shouldExecute
    ? 'executed'
    : 'pending_approval';

  const approvedByProfileId = shouldExecute ? session.userId ?? 'system' : null;
  const approvedAt = shouldExecute ? timestamp : null;
  const executedAt = shouldExecute ? timestamp : null;

  const transferId = await ctx.db.insert('transfers', {
    organizationId: args.organizationId,
    intent: 'credit_payoff',
    sourceAccountId: args.sourceAccountId as any,
    destinationAccountId: args.destinationAccountId as any,
    amount: args.amount,
    requestedByProfileId: session.userId ?? 'system',
    approvedByProfileId,
    status,
    goalId: null,
    orderId: null,
    requestedAt: timestamp,
    approvedAt,
    executedAt,
    metadata: {
      memo: args.memo ?? null,
      destinationAccountName: destinationAccount.name,
      intent: 'credit_payoff',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'transfer_requested',
    actorProfileId: session.userId,
    primaryEntity: { table: 'transfers', id: transferId },
    payload: {
      amount: args.amount,
      intent: 'credit_payoff',
      approvalPolicy: guardrail.guardrailSummary.approvalPolicy,
    },
  });

  if (status === 'executed') {
    await logEvent(ctx.db, {
      organizationId: args.organizationId,
      eventKind: 'transfer_executed',
      actorProfileId: session.userId,
      primaryEntity: { table: 'transfers', id: transferId },
      payload: {
        amount: args.amount,
        intent: 'credit_payoff',
      },
    });

    await ctx.db.insert('transactions', {
      organizationId: args.organizationId,
      accountId: args.destinationAccountId as any,
      transferId,
      providerTransactionId: null,
      direction: 'credit',
      source: 'transfer',
      status: 'posted',
      amount: args.amount,
      description: args.memo?.trim() ? args.memo.trim() : 'Credit payoff',
      merchantName: 'Credit payoff',
      categoryKey: null,
      categoryConfidence: null,
      needsVsWants: null,
      occurredAt: timestamp,
      createdAt: timestamp,
      metadata: {
        intent: 'credit_payoff',
      },
      moneyMapNodeId: destinationAccount.moneyMapNodeId ?? null,
    });
  }

  const transferRecord = await ctx.db.get(transferId);
  return {
    transfer: transferRecord,
    guardrail: guardrail.guardrailSummary,
  };
};
