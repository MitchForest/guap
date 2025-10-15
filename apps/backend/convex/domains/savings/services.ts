import type { Id } from '@guap/api/codegen/dataModel';
import type { CurrencyAmount } from '@guap/types';
import { GoalStatusSchema } from '@guap/types';
import { logEvent } from '../events/services';

const MS_PER_DAY = 86_400_000;

const toCurrencyAmount = (cents: number, currency: string): CurrencyAmount => ({
  cents: Math.round(cents),
  currency,
});

const resolveTransferTimestamp = (transfer: any) =>
  transfer.executedAt ?? transfer.approvedAt ?? transfer.requestedAt ?? transfer.updatedAt ?? transfer.createdAt;

export const calculateGoalProgress = async (db: any, goal: any) => {
  const account = await db.get(goal.accountId);
  const transfers = await db
    .query('transfers')
    .withIndex('by_goal', (q: any) => q.eq('goalId', goal._id))
    .collect();

  const executedTransfers = transfers.filter((transfer: any) => transfer.status === 'executed');
  const currency =
    account?.balance?.currency ??
    goal.targetAmount?.currency ??
    goal.startingAmount?.currency ??
    'USD';

  let netContributionCents = 0;
  let depositContributionCents = 0;
  let lastContributionAt: number | null = null;

  for (const transfer of executedTransfers) {
    const amountCents = Math.round(transfer.amount?.cents ?? 0);
    if (!amountCents) continue;

    if (transfer.destinationAccountId === goal.accountId) {
      netContributionCents += amountCents;
      depositContributionCents += amountCents;
    } else if (transfer.sourceAccountId === goal.accountId) {
      netContributionCents -= amountCents;
    }

    const timestamp = resolveTransferTimestamp(transfer);
    if (typeof timestamp === 'number') {
      if (lastContributionAt === null || timestamp > lastContributionAt) {
        lastContributionAt = timestamp;
      }
    }
  }

  const startingCents = Math.round(goal.startingAmount?.cents ?? 0);
  const targetCents = Math.max(0, Math.round(goal.targetAmount?.cents ?? 0));
  const accountBalanceCents = Math.max(
    0,
    Math.round(account?.balance?.cents ?? goal.startingAmount?.cents ?? 0)
  );
  const currentCents = accountBalanceCents;
  const remainingCents = Math.max(0, targetCents - accountBalanceCents);
  const percentageComplete =
    targetCents > 0 ? Math.min(1, accountBalanceCents / targetCents) : 0;

  let projectedCompletionDate: number | null = null;
  if (remainingCents <= 0) {
    projectedCompletionDate = lastContributionAt ?? Date.now();
  } else {
    const depositTimestamps = executedTransfers
      .filter((transfer: any) => transfer.destinationAccountId === goal.accountId)
      .map((transfer: any) => resolveTransferTimestamp(transfer))
      .filter((value: unknown): value is number => typeof value === 'number')
      .sort((a: number, b: number) => a - b);

    if (depositTimestamps.length >= 2 && depositContributionCents > 0) {
      const first = depositTimestamps[0];
      const last = depositTimestamps[depositTimestamps.length - 1];
      const elapsedMs = Math.max(MS_PER_DAY, last - first);
      const elapsedDays = elapsedMs / MS_PER_DAY;
      const averageDailyContribution = depositContributionCents / elapsedDays;

      if (averageDailyContribution > 0) {
        const daysRemaining = remainingCents / averageDailyContribution;
        projectedCompletionDate = Math.round(Date.now() + daysRemaining * MS_PER_DAY);
      }
    }
  }

  return {
    progress: {
      currentAmount: toCurrencyAmount(accountBalanceCents, currency),
      contributedAmount: toCurrencyAmount(
        Math.max(0, accountBalanceCents - startingCents),
        currency
      ),
      remainingAmount: toCurrencyAmount(remainingCents, currency),
      percentageComplete,
      lastContributionAt,
      projectedCompletionDate,
    },
    transfers,
  };
};

export const loadGoalWithProgress = async (db: any, goalId: Id<'savingsGoals'>) => {
  const goal = await db.get(goalId);
  if (!goal) {
    return null;
  }
  const { progress } = await calculateGoalProgress(db, goal);

  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', goal.organizationId).eq('intent', 'save')
    )
    .collect();

  const depositGuardrail = selectGuardrailForDirection(
    guardrails,
    goal,
    'deposit',
    goal.accountId
  );

  const withdrawalGuardrail = selectGuardrailForDirection(
    guardrails,
    goal,
    'withdrawal',
    goal.accountId
  );

  return {
    goal,
    progress,
    guardrails: {
      deposit: summarizeGuardrail(depositGuardrail),
      withdrawal: summarizeGuardrail(withdrawalGuardrail),
    },
  };
};

export const isDepositGuardrail = (guardrail: any, nodeId: Id<'moneyMapNodes'>) => {
  const direction = guardrail.direction ?? {};
  return (
    guardrail.scope?.type === 'money_map_node' &&
    guardrail.scope.nodeId === nodeId &&
    direction.destinationNodeId === nodeId &&
    (direction.sourceNodeId == null || direction.sourceNodeId === null)
  );
};

export const isWithdrawalGuardrail = (guardrail: any, nodeId: Id<'moneyMapNodes'>) => {
  const direction = guardrail.direction ?? {};
  return (
    guardrail.scope?.type === 'money_map_node' &&
    guardrail.scope.nodeId === nodeId &&
    direction.sourceNodeId === nodeId &&
    (direction.destinationNodeId == null || direction.destinationNodeId === null)
  );
};

export const ensureGoalGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    moneyMapNodeId: Id<'moneyMapNodes'>;
    createdByProfileId: string | null;
  }
) => {
  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'save')
    )
    .collect();

  const timestamp = Date.now();
  let depositGuardrail = guardrails.find((guardrail: any) =>
    isDepositGuardrail(guardrail, params.moneyMapNodeId)
  );

  if (!depositGuardrail) {
    const guardrailId = await db.insert('transferGuardrails', {
      organizationId: params.organizationId,
      scope: { type: 'money_map_node', nodeId: params.moneyMapNodeId },
      intent: 'save',
      direction: { sourceNodeId: null, destinationNodeId: params.moneyMapNodeId },
      approvalPolicy: 'auto',
      autoApproveUpToCents: null,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: params.createdByProfileId ?? 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    depositGuardrail = await db.get(guardrailId);

    await logEvent(db, {
      organizationId: params.organizationId,
      eventKind: 'guardrail_updated',
      actorProfileId: params.createdByProfileId,
      primaryEntity: { table: 'transferGuardrails', id: guardrailId },
      payload: {
        scope: 'money_map_node',
        nodeId: params.moneyMapNodeId,
        intent: 'save',
        direction: 'deposit',
      },
    });
  }

  let withdrawalGuardrail = guardrails.find((guardrail: any) =>
    isWithdrawalGuardrail(guardrail, params.moneyMapNodeId) && guardrail.approvalPolicy !== 'auto'
  );

  if (!withdrawalGuardrail) {
    const guardrailId = await db.insert('transferGuardrails', {
      organizationId: params.organizationId,
      scope: { type: 'money_map_node', nodeId: params.moneyMapNodeId },
      intent: 'save',
      direction: { sourceNodeId: params.moneyMapNodeId, destinationNodeId: null },
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: params.createdByProfileId ?? 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    withdrawalGuardrail = await db.get(guardrailId);

    await logEvent(db, {
      organizationId: params.organizationId,
      eventKind: 'guardrail_updated',
      actorProfileId: params.createdByProfileId,
      primaryEntity: { table: 'transferGuardrails', id: guardrailId },
      payload: {
        scope: 'money_map_node',
        nodeId: params.moneyMapNodeId,
        intent: 'save',
        direction: 'withdrawal',
      },
    });
  }

  return {
    depositGuardrail,
    withdrawalGuardrail,
  };
};

const guardrailMatchesDirection = (
  guardrail: any,
  goal: any,
  direction: 'deposit' | 'withdrawal'
) => {
  const scopeType = guardrail.scope?.type;
  if (scopeType === 'organization' || scopeType === 'account') {
    return true;
  }

  if (direction === 'deposit') {
    return isDepositGuardrail(guardrail, goal.moneyMapNodeId);
  }
  return isWithdrawalGuardrail(guardrail, goal.moneyMapNodeId);
};

export const selectGuardrailForDirection = (
  guardrails: any[],
  goal: any,
  direction: 'deposit' | 'withdrawal',
  relevantAccountId: string | null
) => {
  const candidates = guardrails.filter((guardrail: any) =>
    guardrailMatchesDirection(guardrail, goal, direction)
  );

  const accountMatch = candidates.find(
    (guardrail: any) =>
      guardrail.scope?.type === 'account' && guardrail.scope.accountId === relevantAccountId
  );

  const nodeMatch = candidates.find(
    (guardrail: any) =>
      guardrail.scope?.type === 'money_map_node' &&
      guardrail.scope.nodeId === goal.moneyMapNodeId
  );

  const organizationMatch = candidates.find(
    (guardrail: any) => guardrail.scope?.type === 'organization'
  );

  return accountMatch ?? nodeMatch ?? organizationMatch ?? null;
};

export type GuardrailSummary = {
  approvalPolicy: 'auto' | 'parent_required' | 'admin_only';
  autoApproveUpToCents: number | null;
  scope: 'organization' | 'money_map_node' | 'account' | null;
};

export const summarizeGuardrail = (guardrail: any | null): GuardrailSummary => {
  if (!guardrail) {
    return {
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      scope: null,
    };
  }
  return {
    approvalPolicy: guardrail.approvalPolicy ?? 'parent_required',
    autoApproveUpToCents:
      typeof guardrail.autoApproveUpToCents === 'number' ? guardrail.autoApproveUpToCents : null,
    scope: guardrail.scope?.type ?? null,
  };
};

export const resolveTransferGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    goal: any;
    amountCents: number;
    sourceAccountId: string | null;
    destinationAccountId: string;
  }
) => {
  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'save')
    )
    .collect();

  const direction: 'deposit' | 'withdrawal' =
    params.destinationAccountId === params.goal.accountId ? 'deposit' : 'withdrawal';

  const relevantAccountId =
    direction === 'deposit' ? params.destinationAccountId : params.sourceAccountId;

  const selectedGuardrail = selectGuardrailForDirection(
    guardrails,
    params.goal,
    direction,
    relevantAccountId
  );
  const summary = summarizeGuardrail(selectedGuardrail);

  const autoLimit =
    summary.autoApproveUpToCents == null ? null : Math.round(summary.autoApproveUpToCents);

  const shouldAutoApprove =
    summary.approvalPolicy === 'auto' &&
    (autoLimit === null || params.amountCents <= autoLimit);

  return {
    guardrail: summary,
    decision: shouldAutoApprove ? 'execute' : 'pending',
    direction,
  };
};

export const updateGoalStatusIfAchieved = async (db: any, goal: any, progress: any) => {
  const status = GoalStatusSchema.parse(goal.status);
  if ((status === 'archived' || status === 'achieved') && progress.percentageComplete < 1) {
    return false;
  }

  if (progress.percentageComplete >= 1 && status !== 'achieved' && status !== 'archived') {
    await db.patch(goal._id, {
      status: 'achieved',
      achievedAt: progress.lastContributionAt ?? Date.now(),
    });
    return true;
  }

  return false;
};
