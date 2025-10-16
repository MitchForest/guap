import { z } from 'zod';
import {
  DonationGuardrailSummarySchema,
  DonationCauseSchema,
  ScheduleDonationInputSchema,
  TransferRecordSchema,
  UpdateDonationGuardrailInputSchema,
} from '@guap/types';
import { defineMutation } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';
import { evaluateDonationGuardrail, findDonationCause, upsertDonationGuardrail } from './services';
import { logEvent } from '../events/services';
import type { ScheduleDonationInput, UpdateDonationGuardrailInput } from '@guap/types';
import { ensureRole, OWNER_ADMIN_ROLES } from '../../core/session';

const ScheduleDonationArgs = ScheduleDonationInputSchema.shape;
const UpdateGuardrailArgs = UpdateDonationGuardrailInputSchema.shape;

export const scheduleDonationImpl = async (
  ctx: any,
  args: ScheduleDonationInput,
  session: { userId: string | null }
) => {
  const cause = findDonationCause(args.causeId);
  if (!cause) {
    throw new Error('Donation cause not found');
  }

  const sourceAccount = await ctx.db.get(args.sourceAccountId as any);
  if (!sourceAccount || sourceAccount.organizationId !== args.organizationId) {
    throw new Error('Source account not found in organization');
  }

  const destinationAccount = await ctx.db.get(args.destinationAccountId as any);
  if (!destinationAccount || destinationAccount.organizationId !== args.organizationId) {
    throw new Error('Destination account not found in organization');
  }
  if (destinationAccount.kind !== 'donation') {
    throw new Error('Destination account must be a donation account');
  }

  const amountCents = Math.round(args.amount.cents);
  if (amountCents <= 0) {
    throw new Error('Donation amount must be positive');
  }

  const guardrailDecision = await evaluateDonationGuardrail(ctx.db, {
    organizationId: args.organizationId,
    destinationAccountId: destinationAccount._id,
    destinationNodeId: destinationAccount.moneyMapNodeId ?? null,
    amountCents,
  });

  const now = Date.now();
  const scheduledFor = typeof args.scheduledFor === 'number' ? args.scheduledFor : null;
  const memo = typeof args.memo === 'string' && args.memo.trim().length > 0 ? args.memo.trim() : null;

  let status: 'pending_approval' | 'approved' | 'executed' = 'pending_approval';
  let approvedByProfileId: string | null = null;
  let approvedAt: number | null = null;
  let executedAt: number | null = null;
  let autoExecuted = false;

  if (guardrailDecision.shouldExecute) {
    if (scheduledFor && scheduledFor > now) {
      status = 'approved';
      approvedByProfileId = session.userId ?? 'system';
      approvedAt = now;
    } else {
      status = 'executed';
      approvedByProfileId = session.userId ?? 'system';
      approvedAt = now;
      executedAt = now;
      autoExecuted = true;
    }
  }

  const metadata: Record<string, unknown> = {
    causeId: cause.id,
    causeName: cause.name,
    scheduledFor,
    memo,
    recurringCadence: args.recurringCadence ?? null,
    destinationAccountName: destinationAccount.name,
  };

  const transferId = await ctx.db.insert('transfers', {
    organizationId: args.organizationId,
    intent: 'donate',
    sourceAccountId: args.sourceAccountId as any,
    destinationAccountId: args.destinationAccountId as any,
    amount: args.amount,
    requestedByProfileId: session.userId ?? 'system',
    approvedByProfileId,
    status,
    goalId: null,
    orderId: null,
    requestedAt: now,
    approvedAt,
    executedAt,
    metadata,
    createdAt: now,
    updatedAt: now,
  });

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'donation_requested',
    actorProfileId: session.userId,
    primaryEntity: { table: 'transfers', id: transferId },
    payload: {
      causeId: cause.id,
      causeName: cause.name,
      amount: args.amount,
      scheduledFor,
      approvalPolicy: guardrailDecision.summary.approvalPolicy,
      autoApproveUpToCents: guardrailDecision.summary.autoApproveUpToCents,
    },
  });

  if (status === 'executed') {
    await logEvent(ctx.db, {
      organizationId: args.organizationId,
      eventKind: 'donation_completed',
      actorProfileId: session.userId,
      primaryEntity: { table: 'transfers', id: transferId },
      payload: {
        causeId: cause.id,
        causeName: cause.name,
        amount: args.amount,
        executedAt,
      },
    });
  }

  const transferRecord = await ctx.db.get(transferId);

  return {
    transfer: transferRecord,
    guardrail: guardrailDecision.summary,
    autoExecuted,
    cause,
  };
};

export const scheduleDonation = defineMutation({
  args: ScheduleDonationArgs,
  returns: z.object({
    transfer: TransferRecordSchema,
    guardrail: DonationGuardrailSummarySchema.nullable(),
    autoExecuted: z.boolean(),
    cause: DonationCauseSchema,
  }),
  handler: async (ctx, rawArgs) => {
    const args = ScheduleDonationInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    return await scheduleDonationImpl(ctx, args, session);
  },
});

export const updateGuardrailImpl = async (
  ctx: any,
  args: UpdateDonationGuardrailInput,
  session: { userId: string | null }
) => {
  const account = await ctx.db.get(args.accountId as any);
  if (!account || account.organizationId !== args.organizationId) {
    throw new Error('Donation account not found in organization');
  }
  if (account.kind !== 'donation') {
    throw new Error('Guardrails can only be updated for donation accounts');
  }

  const approvalPolicy = args.approvalPolicy ?? 'parent_required';
  const { summary, guardrailId } = await upsertDonationGuardrail(ctx.db, {
    organizationId: args.organizationId,
    accountId: args.accountId,
    approvalPolicy,
    autoApproveUpToCents:
      args.autoApproveUpToCents != null ? Math.max(0, Math.round(args.autoApproveUpToCents)) : null,
    actorProfileId: session.userId,
  });

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'guardrail_updated',
    actorProfileId: session.userId,
    primaryEntity: { table: 'transferGuardrails', id: guardrailId },
    payload: {
      scope: 'donation_account',
      accountId: args.accountId,
      approvalPolicy: summary.approvalPolicy,
      autoApproveUpToCents: summary.autoApproveUpToCents,
    },
  });

  return summary;
};

export const updateGuardrail = defineMutation({
  args: UpdateGuardrailArgs,
  returns: DonationGuardrailSummarySchema,
  handler: async (ctx, rawArgs) => {
    const args = UpdateDonationGuardrailInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await updateGuardrailImpl(ctx, args, session);
  },
});
