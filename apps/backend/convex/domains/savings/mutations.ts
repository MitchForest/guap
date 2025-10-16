import { z } from 'zod';
import {
  CreateSavingsGoalInputSchema,
  InitiateSavingsTransferInputSchema,
  UpdateSavingsGoalInputSchema,
  type CreateSavingsGoalInput,
  type InitiateSavingsTransferInput,
  type UpdateSavingsGoalInput,
} from '@guap/types';
import { defineMutation } from '../../core/functions';
import {
  ensureOrganizationAccess,
  ensureRole,
  OWNER_ADMIN_ROLES,
} from '../../core/session';
import { deriveGuardrailReason } from '../../core/guardrailReasons';
import {
  calculateGoalProgress,
  ensureGoalGuardrail,
  loadGoalWithProgress,
  resolveTransferGuardrail,
  updateGoalStatusIfAchieved,
} from './services';
import { logEvent } from '../events/services';

const CreateGoalArgs = CreateSavingsGoalInputSchema.shape;
const UpdateGoalArgs = UpdateSavingsGoalInputSchema.shape;
const InitiateTransferArgs = InitiateSavingsTransferInputSchema.shape;
const ArchiveGoalArgs = {
  organizationId: z.string(),
  goalId: z.string(),
} as const;

export const createGoalImpl = async (ctx: any, args: CreateSavingsGoalInput, session: any) => {
  const moneyMapNode = await ctx.db.get(args.moneyMapNodeId as any);
  if (!moneyMapNode) {
    throw new Error('Money Map node not found');
  }

  const map = await ctx.db.get(moneyMapNode.mapId);
  if (!map) {
    throw new Error('Money Map not found');
  }
  if (map.organizationId !== args.organizationId) {
    throw new Error('Money Map does not belong to organization');
  }
  if (moneyMapNode.kind !== 'goal') {
    throw new Error('Savings goals must be linked to Money Map goal nodes');
  }

  const account = await ctx.db.get(args.accountId as any);
  if (!account || account.organizationId !== args.organizationId) {
    throw new Error('Account not found within organization');
  }

  const timestamp = Date.now();
  const goalId = await ctx.db.insert('savingsGoals', {
    organizationId: args.organizationId,
    moneyMapNodeId: args.moneyMapNodeId as any,
    accountId: args.accountId as any,
    name: args.name ?? moneyMapNode.label ?? 'Savings goal',
    targetAmount: args.targetAmount,
    startingAmount: args.startingAmount,
    targetDate: args.targetDate ?? null,
    status: 'active',
    createdByProfileId: session.userId ?? 'system',
    createdAt: timestamp,
    achievedAt: null,
    archivedAt: null,
  });

  await ensureGoalGuardrail(ctx.db, {
    organizationId: args.organizationId,
    moneyMapNodeId: args.moneyMapNodeId as any,
    createdByProfileId: session.userId ?? null,
  });

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'goal_created',
    actorProfileId: session.userId,
    primaryEntity: { table: 'savingsGoals', id: goalId },
    payload: {
      name: args.name,
      targetAmount: args.targetAmount,
      targetDate: args.targetDate ?? null,
    },
  });

  return await loadGoalWithProgress(ctx.db, goalId);
};

export const updateGoalImpl = async (ctx: any, args: UpdateSavingsGoalInput, session: any) => {
  const goal = await ctx.db.get(args.goalId as any);
  if (!goal) {
    throw new Error('Goal not found');
  }
  if (goal.organizationId !== args.organizationId) {
    throw new Error('Goal does not belong to organization');
  }

  const patch: Record<string, unknown> = {};
  if (typeof args.name === 'string') patch.name = args.name;
  if (args.targetAmount) patch.targetAmount = args.targetAmount;
  if (args.startingAmount) patch.startingAmount = args.startingAmount;
  if (args.targetDate !== undefined) patch.targetDate = args.targetDate ?? null;
  if (args.status) patch.status = args.status;

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(goal._id, patch);
  }

  return await loadGoalWithProgress(ctx.db, goal._id);
};

export const archiveGoalImpl = async (
  ctx: any,
  args: { organizationId: string; goalId: string },
  session: any
) => {
  const goal = await ctx.db.get(args.goalId as any);
  if (!goal) {
    throw new Error('Goal not found');
  }
  if (goal.organizationId !== args.organizationId) {
    throw new Error('Goal does not belong to organization');
  }

  await ctx.db.patch(goal._id, {
    status: 'archived',
    archivedAt: Date.now(),
  });

  return await loadGoalWithProgress(ctx.db, goal._id);
};

export const initiateTransferImpl = async (
  ctx: any,
  args: InitiateSavingsTransferInput,
  session: any
) => {
  const goal = await ctx.db.get(args.goalId as any);
  if (!goal) {
    throw new Error('Goal not found');
  }
  if (goal.organizationId !== args.organizationId) {
    throw new Error('Goal does not belong to organization');
  }

  const sourceAccount = await ctx.db.get(args.sourceAccountId as any);
  if (!sourceAccount || sourceAccount.organizationId !== args.organizationId) {
    throw new Error('Source account not found in organization');
  }

  const amountCents = Math.round(args.amount.cents);
  if (amountCents <= 0) {
    throw new Error('Transfer amount must be positive');
  }

  const guardrailDecision = await resolveTransferGuardrail(ctx.db, {
    organizationId: args.organizationId,
    goal,
    amountCents,
    sourceAccountId: args.sourceAccountId ?? null,
    destinationAccountId: goal.accountId,
  });

  const timestamp = Date.now();
  const metadata = {
    goalId: goal._id,
    goalName: goal.name,
    memo: args.memo ?? null,
  };

  const guardrailSummary = guardrailDecision.guardrail;
  const guardrailReason =
    guardrailDecision.decision === 'execute'
      ? null
      : deriveGuardrailReason(guardrailSummary, amountCents);

  if (guardrailSummary || guardrailReason) {
    (metadata as Record<string, unknown>).guardrail = {
      approvalPolicy: guardrailSummary.approvalPolicy,
      autoApproveUpToCents: guardrailSummary.autoApproveUpToCents,
      reasonCode: guardrailReason?.code ?? null,
      reasonLimitCents: guardrailReason?.limitCents ?? null,
    };
  }

  let status: 'pending_approval' | 'approved' | 'executed' = 'pending_approval';
  let approvedByProfileId: string | null = null;
  let approvedAt: number | null = null;
  let executedAt: number | null = null;

  if (guardrailDecision.decision === 'execute') {
    status = 'executed';
    approvedByProfileId = session.userId ?? 'system';
    approvedAt = timestamp;
    executedAt = timestamp;
  }

  const transferId = await ctx.db.insert('transfers', {
    organizationId: args.organizationId,
    intent: 'save',
    sourceAccountId: args.sourceAccountId as any,
    destinationAccountId: goal.accountId,
    amount: args.amount,
    requestedByProfileId: session.userId ?? 'system',
    approvedByProfileId,
    status,
    goalId: goal._id,
    orderId: null,
    requestedAt: timestamp,
    approvedAt,
    executedAt,
    metadata,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'transfer_requested',
    actorProfileId: session.userId,
    primaryEntity: { table: 'transfers', id: transferId },
    payload: {
      goalId: goal._id,
      goalName: goal.name,
      amount: args.amount,
      approvalPolicy: guardrailDecision.guardrail.approvalPolicy,
      direction: guardrailDecision.direction,
    },
  });

  if (status === 'executed') {
    await logEvent(ctx.db, {
      organizationId: args.organizationId,
      eventKind: 'transfer_executed',
      actorProfileId: session.userId,
      primaryEntity: { table: 'transfers', id: transferId },
      payload: {
        goalId: goal._id,
        goalName: goal.name,
        amount: args.amount,
      },
    });
  }

  const { progress } = await calculateGoalProgress(ctx.db, goal);
  await updateGoalStatusIfAchieved(ctx.db, goal, progress);

  const transferRecord = await ctx.db.get(transferId);

  return {
    transfer: transferRecord,
    guardrail: guardrailDecision.guardrail,
    direction: guardrailDecision.direction,
    progress,
  };
};

export const createGoal = defineMutation({
  args: CreateGoalArgs,
  handler: async (ctx, rawArgs) => {
    const args = CreateSavingsGoalInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await createGoalImpl(ctx, args, session);
  },
});

export const updateGoal = defineMutation({
  args: UpdateGoalArgs,
  handler: async (ctx, rawArgs) => {
    const args = UpdateSavingsGoalInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await updateGoalImpl(ctx, args, session);
  },
});

export const archiveGoal = defineMutation({
  args: ArchiveGoalArgs,
  handler: async (ctx, rawArgs) => {
    const args = z
      .object({
        organizationId: z.string(),
        goalId: z.string(),
      })
      .parse(rawArgs);

    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    return await archiveGoalImpl(ctx, args, session);
  },
});

export const initiateTransfer = defineMutation({
  args: InitiateTransferArgs,
  handler: async (ctx, rawArgs) => {
    const args = InitiateSavingsTransferInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    return await initiateTransferImpl(ctx, args, session);
  },
});
