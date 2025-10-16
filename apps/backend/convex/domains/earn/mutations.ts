import { z } from 'zod';
import {
  CreateIncomeStreamInputSchema,
  UpdateIncomeStreamInputSchema,
  RequestIncomePayoutInputSchema,
  SkipIncomePayoutInputSchema,
} from '@guap/types';
import { defineMutation } from '../../core/functions';
import {
  ensureOrganizationAccess,
  ensureRole,
  OWNER_ADMIN_ROLES,
} from '../../core/session';
import { deriveGuardrailReason } from '../../core/guardrailReasons';
import { logEvent } from '../events/services';
import {
  advanceStreamSchedule,
  deriveNextScheduledAt,
  ensureDestinationAccount,
  ensureSourceAccount,
  evaluateEarnGuardrail,
  normalizeScheduledAt,
} from './services';
import { internalMutation } from '../../_generated/server';

const CreateIncomeStreamArgs = CreateIncomeStreamInputSchema.shape;
const UpdateIncomeStreamArgs = UpdateIncomeStreamInputSchema.shape;
const RequestIncomePayoutArgs = RequestIncomePayoutInputSchema.shape;
const SkipIncomePayoutArgs = SkipIncomePayoutInputSchema.shape;

type SessionSnapshot = { userId: string | null; role: string | null };

const SYSTEM_SESSION: SessionSnapshot = { userId: 'system', role: null };

const requirePositiveAmount = (amount: { cents: number; currency: string }) => {
  const cents = Math.round(amount.cents);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  return { ...amount, cents };
};

const loadIncomeStream = async (db: any, incomeStreamId: string, organizationId?: string) => {
  const stream = await db.get(incomeStreamId);
  if (!stream) {
    throw new Error('Income stream not found');
  }
  if (organizationId && stream.organizationId !== organizationId) {
    throw new Error('Income stream does not belong to organization');
  }
  return stream;
};

const logEarnEvent = async (
  db: any,
  params: {
    organizationId: string;
    eventKind: 'income_request' | 'income_completed' | 'income_skipped';
    actorProfileId: string | null;
    streamId: string;
    transferId?: string | null;
    payload?: Record<string, unknown> | null;
  }
) => {
  await logEvent(db, {
    organizationId: params.organizationId,
    eventKind: params.eventKind,
    actorProfileId: params.actorProfileId,
    primaryEntity: { table: 'incomeStreams', id: params.streamId },
    relatedEntities: params.transferId ? [{ table: 'transfers', id: params.transferId }] : undefined,
    payload: params.payload ?? null,
  });
};

const createPayoutTransfer = async (
  ctx: any,
  stream: any,
  args: z.infer<typeof RequestIncomePayoutInputSchema>,
  session: SessionSnapshot
) => {
  const timestamp = typeof args.requestedAt === 'number' ? args.requestedAt : Date.now();
  const amount = requirePositiveAmount(args.amount ?? stream.amount);
  const scheduledFor =
    typeof args.scheduledFor === 'number'
      ? args.scheduledFor
      : stream.nextScheduledAt ?? timestamp;

  const destinationAccountId =
    (args.destinationAccountId as any) ?? stream.defaultDestinationAccountId ?? null;
  const destinationAccount = await ensureDestinationAccount(ctx.db, {
    accountId: destinationAccountId,
    organizationId: stream.organizationId,
  });
  if (!destinationAccount) {
    throw new Error('Income stream requires a destination account');
  }

  const sourceAccountId =
    (args.sourceAccountId as any) ?? stream.sourceAccountId ?? null;
  await ensureSourceAccount(ctx.db, {
    accountId: sourceAccountId,
    organizationId: stream.organizationId,
  });

  const decision = await evaluateEarnGuardrail(ctx.db, {
    organizationId: stream.organizationId,
    destinationAccountId: destinationAccount._id ?? null,
    destinationNodeId: destinationAccount.moneyMapNodeId ?? null,
    amountCents: amount.cents,
    streamRequiresApproval: stream.requiresApproval,
  });

  const forceExecution = args.force === true;
  const shouldExecute = forceExecution || decision.decision === 'execute';

  const status: 'pending_approval' | 'executed' =
    shouldExecute ? 'executed' : 'pending_approval';

  const approvedByProfileId = shouldExecute ? session.userId ?? 'system' : null;
  const approvedAt = shouldExecute ? timestamp : null;
  const executedAt = shouldExecute ? timestamp : null;

  const metadata: Record<string, unknown> = {
    incomeStreamId: stream._id,
    streamName: stream.name,
    cadence: stream.cadence,
    scheduledFor,
    amount,
  };

  const guardrailReason =
    status === 'pending_approval'
      ? deriveGuardrailReason(decision.summary, amount.cents)
      : null;

  if (guardrailReason || decision.summary) {
    metadata.guardrail = {
      approvalPolicy: decision.summary.approvalPolicy,
      autoApproveUpToCents: decision.summary.autoApproveUpToCents,
      reasonCode: guardrailReason?.code ?? null,
      reasonLimitCents: guardrailReason?.limitCents ?? null,
    };
  }

  const transferId = await ctx.db.insert('transfers', {
    organizationId: stream.organizationId,
    intent: 'earn',
    sourceAccountId: sourceAccountId,
    destinationAccountId: destinationAccount._id,
    amount,
    requestedByProfileId: session.userId ?? stream.ownerProfileId ?? 'system',
    approvedByProfileId,
    status,
    goalId: null,
    orderId: null,
    requestedAt: timestamp,
    approvedAt,
    executedAt,
    metadata,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const nextScheduledAt = stream.autoSchedule
    ? advanceStreamSchedule(stream, scheduledFor)
    : stream.nextScheduledAt ?? null;

  const streamPatch: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  if (stream.autoSchedule) {
    streamPatch.nextScheduledAt = nextScheduledAt;
  }

  if (status === 'executed') {
    streamPatch.lastPaidAt = executedAt ?? timestamp;
  }

  await ctx.db.patch(stream._id, streamPatch);

  await logEarnEvent(ctx.db, {
    organizationId: stream.organizationId,
    eventKind: 'income_request',
    actorProfileId: session.userId,
    streamId: stream._id,
    transferId,
    payload: {
      amount,
      scheduledFor,
      autoExecuted: status === 'executed',
      streamName: stream.name,
    },
  });

  if (status === 'executed') {
    await logEarnEvent(ctx.db, {
      organizationId: stream.organizationId,
    eventKind: 'income_completed',
    actorProfileId: session.userId,
    streamId: stream._id,
    transferId,
    payload: {
      amount,
      executedAt,
      scheduledFor,
      streamName: stream.name,
    },
  });
  }

  return {
    transferId,
    status,
    guardrail: decision.summary,
    autoExecuted: status === 'executed',
    scheduledFor,
  };
};

export const createIncomeStream = defineMutation({
  args: CreateIncomeStreamArgs,
  handler: async (ctx, rawArgs) => {
    const args = CreateIncomeStreamInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const amount = requirePositiveAmount(args.amount);

    const destinationAccountId = (args.defaultDestinationAccountId as any) ?? null;
    await ensureDestinationAccount(ctx.db, {
      accountId: destinationAccountId,
      organizationId: args.organizationId,
    });

    const sourceAccountId = (args.sourceAccountId as any) ?? null;
    await ensureSourceAccount(ctx.db, {
      accountId: sourceAccountId,
      organizationId: args.organizationId,
    });

    const timestamp = Date.now();
    const autoSchedule = args.autoSchedule ?? false;
    const nextScheduledAt = autoSchedule
      ? normalizeScheduledAt(args.firstScheduledAt ?? null, args.cadence)
      : null;

    const incomeStreamId = await ctx.db.insert('incomeStreams', {
      organizationId: args.organizationId,
      ownerProfileId: args.ownerProfileId,
      name: args.name,
      cadence: args.cadence,
      amount,
      defaultDestinationAccountId: destinationAccountId,
      sourceAccountId,
      requiresApproval: args.requiresApproval ?? true,
      autoSchedule,
      status: 'active',
      nextScheduledAt,
      lastPaidAt: null,
      createdByProfileId: session.userId ?? 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return await ctx.db.get(incomeStreamId);
  },
});

export const updateIncomeStreamImpl = async (
  ctx: any,
  args: z.infer<typeof UpdateIncomeStreamInputSchema>
) => {
  const stream = await loadIncomeStream(ctx.db, args.incomeStreamId, args.organizationId);
  const patch: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  const candidate: any = { ...stream };

  if (typeof args.name === 'string') {
    patch.name = args.name;
    candidate.name = args.name;
  }
  if (args.cadence) {
    patch.cadence = args.cadence;
    candidate.cadence = args.cadence;
  }
  if (args.amount) {
    patch.amount = requirePositiveAmount(args.amount);
    candidate.amount = patch.amount;
  }
  if (args.defaultDestinationAccountId !== undefined) {
    const destinationAccountId = (args.defaultDestinationAccountId as any) ?? null;
    await ensureDestinationAccount(ctx.db, {
      accountId: destinationAccountId,
      organizationId: args.organizationId,
    });
    patch.defaultDestinationAccountId = destinationAccountId;
    candidate.defaultDestinationAccountId = destinationAccountId;
  }
  if (args.sourceAccountId !== undefined) {
    const sourceAccountId = (args.sourceAccountId as any) ?? null;
    await ensureSourceAccount(ctx.db, {
      accountId: sourceAccountId,
      organizationId: args.organizationId,
    });
    patch.sourceAccountId = sourceAccountId;
    candidate.sourceAccountId = sourceAccountId;
  }
  if (typeof args.requiresApproval === 'boolean') {
    patch.requiresApproval = args.requiresApproval;
    candidate.requiresApproval = args.requiresApproval;
  }
  if (typeof args.autoSchedule === 'boolean') {
    patch.autoSchedule = args.autoSchedule;
    candidate.autoSchedule = args.autoSchedule;
  }
  if (args.status) {
    patch.status = args.status;
    candidate.status = args.status;
  }

  let nextScheduledAt = candidate.nextScheduledAt ?? stream.nextScheduledAt ?? null;
  let overrideProvided = false;

  if (args.nextScheduledAt !== undefined) {
    nextScheduledAt = args.nextScheduledAt;
    overrideProvided = true;
  }

  const nextStatus = (candidate.status ?? stream.status) as typeof stream.status;
  const nextAutoSchedule =
    typeof candidate.autoSchedule === 'boolean' ? candidate.autoSchedule : stream.autoSchedule;
  const cadence = (candidate.cadence ?? stream.cadence) as typeof stream.cadence;

  if (nextStatus !== 'active') {
    nextScheduledAt = null;
  } else if (nextAutoSchedule) {
    nextScheduledAt = deriveNextScheduledAt(
      {
        ...candidate,
        cadence,
        nextScheduledAt,
      },
      {
        cadenceOverride: cadence,
        nextScheduledAtOverride: overrideProvided ? nextScheduledAt : null,
      }
    );
  } else if (!overrideProvided && typeof nextScheduledAt !== 'number') {
    nextScheduledAt = null;
  }

  patch.nextScheduledAt = nextScheduledAt;
  candidate.nextScheduledAt = nextScheduledAt;

  await ctx.db.patch(stream._id, patch);
  return await ctx.db.get(stream._id);
};

export const updateIncomeStream = defineMutation({
  args: UpdateIncomeStreamArgs,
  handler: async (ctx, rawArgs) => {
    const args = UpdateIncomeStreamInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await updateIncomeStreamImpl(ctx, args);
  },
});

export const requestIncomePayoutImpl = async (
  ctx: any,
  args: z.infer<typeof RequestIncomePayoutInputSchema>,
  session: SessionSnapshot
) => {
  const stream = await loadIncomeStream(ctx.db, args.incomeStreamId, args.organizationId);
  if (stream.status !== 'active') {
    throw new Error('Income stream is not active');
  }

  return await createPayoutTransfer(ctx, stream, args, session);
};

export const requestIncomePayout = defineMutation({
  args: RequestIncomePayoutArgs,
  handler: async (ctx, rawArgs) => {
    const args = RequestIncomePayoutInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    return await requestIncomePayoutImpl(ctx, args, session);
  },
});

export const skipIncomePayoutImpl = async (
  ctx: any,
  args: z.infer<typeof SkipIncomePayoutInputSchema>,
  session: SessionSnapshot
) => {
  const stream = await loadIncomeStream(ctx.db, args.incomeStreamId, args.organizationId);
  const scheduledFor =
    typeof args.scheduledFor === 'number'
      ? args.scheduledFor
      : stream.nextScheduledAt ?? Date.now();

  const nextScheduledAt = stream.autoSchedule
    ? advanceStreamSchedule(stream, scheduledFor)
    : null;

  await ctx.db.patch(stream._id, {
    nextScheduledAt,
    updatedAt: Date.now(),
  });

  await logEarnEvent(ctx.db, {
    organizationId: stream.organizationId,
    eventKind: 'income_skipped',
    actorProfileId: session.userId,
    streamId: stream._id,
    payload: {
      scheduledFor,
      reason: args.reason ?? null,
      streamName: stream.name,
    },
  });

  return await ctx.db.get(stream._id);
};

export const skipIncomePayout = defineMutation({
  args: SkipIncomePayoutArgs,
  handler: async (ctx, rawArgs) => {
    const args = SkipIncomePayoutInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await skipIncomePayoutImpl(ctx, args, session);
  },
});

export const processEarnSchedules = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dueStreams = await ctx.db
      .query('incomeStreams')
      .withIndex('by_next_schedule', (q: any) => q.lte('nextScheduledAt', now))
      .collect();

    for (const stream of dueStreams) {
      if (!stream.autoSchedule || stream.status !== 'active' || !stream.nextScheduledAt) {
        continue;
      }
      try {
        await createPayoutTransfer(
          ctx,
          stream,
          {
            organizationId: stream.organizationId,
            incomeStreamId: stream._id,
            scheduledFor: stream.nextScheduledAt,
          },
          SYSTEM_SESSION
        );
      } catch (error) {
        console.error('Failed to process earn schedule', {
          streamId: stream._id,
          error,
        });
      }
    }
  },
});
