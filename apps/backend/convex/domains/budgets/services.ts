import type { Id } from '@guap/api/codegen/dataModel';
import type {
  BudgetRecord,
  BudgetWithActuals,
  BudgetActuals,
  BudgetGuardrailSummary,
  BudgetSummary,
} from '@guap/types';

import { logEvent } from '../events/services';

const toCurrencyAmount = (cents: number, currency: string) => ({
  cents: Math.round(cents),
  currency,
});

const clampPeriodKey = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid period key: ${value}`);
  }
  const [, yearStr, monthStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid period month: ${value}`);
  }
  return { year, month };
};

export const resolvePeriodRange = (periodKey: string) => {
  const { year, month } = clampPeriodKey(periodKey);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return {
    start: start.getTime(),
    end: end.getTime(),
  };
};

const matchesBudgetNode = (transaction: any, budget: BudgetRecord, node: any) => {
  if (transaction.moneyMapNodeId && transaction.moneyMapNodeId === budget.moneyMapNodeId) {
    return true;
  }
  const categoryKey =
    node?.metadata && typeof node.metadata.category === 'string'
      ? node.metadata.category
      : null;
  if (categoryKey && transaction.categoryKey === categoryKey) {
    return true;
  }
  return false;
};

const summarizeGuardrail = (guardrail: any): BudgetGuardrailSummary | null => {
  if (!guardrail) return null;
  return {
    approvalPolicy: guardrail.approvalPolicy,
    autoApproveUpToCents: guardrail.autoApproveUpToCents ?? null,
    scope: guardrail.scope?.type ?? null,
  };
};

const ensureBudgetOverspendEvent = async (params: {
  db: any;
  organizationId: string;
  budget: BudgetRecord;
  overspent: boolean;
  periodKey: string;
  periodRange: { start: number; end: number };
}) => {
  if (!params.overspent) {
    return;
  }
  const existingEvents = await params.db
    .query('eventsJournal')
    .withIndex('by_organization_time', (q: any) =>
      q
        .eq('organizationId', params.organizationId)
        .gte('createdAt', params.periodRange.start)
        .lt('createdAt', params.periodRange.end)
    )
    .collect();

  const alreadyLogged = existingEvents.some(
    (event: any) =>
      event.eventKind === 'budget_over_limit' &&
      event.primaryEntity?.table === 'budgets' &&
      event.primaryEntity?.id === params.budget._id &&
      (event.payload as any)?.periodKey === params.periodKey
  );

  if (alreadyLogged) {
    return;
  }

  const timestamp = Date.now();
  await logEvent(params.db, {
    organizationId: params.organizationId,
    eventKind: 'budget_over_limit',
    actorProfileId: null,
    primaryEntity: { table: 'budgets', id: params.budget._id },
    payload: {
      periodKey: params.periodKey,
      plannedAmount: params.budget.plannedAmount,
    },
  });
};

export const calculateBudgetActuals = async (
  db: any,
  budget: BudgetRecord,
  options: { node?: any } = {}
): Promise<BudgetActuals> => {
  const periodRange = resolvePeriodRange(budget.periodKey);
  const { start, end } = periodRange;
  const node =
    options.node ??
    (await db.get(budget.moneyMapNodeId as Id<'moneyMapNodes'>));

  const cursor = db
    .query('transactions')
    .withIndex('by_org_time', (q: any) =>
      q.eq('organizationId', budget.organizationId).gte('occurredAt', start).lt('occurredAt', end)
    )
    .order('desc');

  const rows: any[] = await cursor.collect();

  let spentCents = 0;
  let transactionsCount = 0;
  let lastTransactionAt: number | null = null;

  for (const transaction of rows) {
    if (!matchesBudgetNode(transaction, budget, node)) continue;
    const amountCents = Math.abs(Math.round(transaction.amount?.cents ?? 0));
    if (!amountCents) continue;
    const direction = transaction.direction === 'credit' ? -1 : 1;
    const delta = amountCents * direction;
    spentCents += delta > 0 ? delta : 0;
    transactionsCount += 1;
    if (typeof transaction.occurredAt === 'number') {
      if (lastTransactionAt === null || transaction.occurredAt > lastTransactionAt) {
        lastTransactionAt = transaction.occurredAt;
      }
    }
  }

  spentCents = Math.max(0, spentCents);
  const plannedCents = Math.max(0, Math.round(budget.plannedAmount.cents));
  const percentageUsed = plannedCents > 0 ? spentCents / plannedCents : 0;
  const remainingCents = Math.max(0, plannedCents - spentCents);
  const overspent = spentCents > plannedCents && plannedCents > 0;

  await ensureBudgetOverspendEvent({
    db,
    organizationId: budget.organizationId,
    budget,
    overspent,
    periodKey: budget.periodKey,
    periodRange,
  });

  return {
    spentAmount: toCurrencyAmount(spentCents, budget.plannedAmount.currency),
    remainingAmount: toCurrencyAmount(remainingCents, budget.plannedAmount.currency),
    percentageUsed,
    transactionsCount,
    overspent,
    lastTransactionAt,
  };
};

export const loadBudgetsWithActuals = async (
  db: any,
  budgets: BudgetRecord[]
): Promise<BudgetWithActuals[]> => {
  if (!budgets.length) return [];

  const nodeIds = Array.from(
    new Set(budgets.map((budget) => budget.moneyMapNodeId))
  );

  const nodes = await Promise.all(
    nodeIds.map(async (id) => [id, await db.get(id as Id<'moneyMapNodes'>)] as const)
  );
  const nodeMap = new Map(nodes);

  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', budgets[0].organizationId).eq('intent', 'spend')
    )
    .collect();

  const records: BudgetWithActuals[] = [];
  for (const budget of budgets) {
    const node = nodeMap.get(budget.moneyMapNodeId) ?? null;
    const guardrail = guardrails.find(
      (entry: any) =>
        entry.scope?.type === 'money_map_node' &&
        entry.scope.nodeId === budget.moneyMapNodeId
    );

    const actuals = await calculateBudgetActuals(db, budget, { node });

    records.push({
      budget,
      actuals,
      guardrail: summarizeGuardrail(guardrail),
    });
  }

  return records;
};

export const summarizeBudgets = (records: BudgetWithActuals[]): BudgetSummary => {
  const now = new Date();
  const fallbackPeriodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}`;
  const periodKey = records[0]?.budget.periodKey ?? fallbackPeriodKey;
  const plannedCurrency = records[0]?.budget.plannedAmount.currency ?? 'USD';

  let totalPlanned = 0;
  let totalSpent = 0;
  let overspentBudgets = 0;

  for (const record of records) {
    totalPlanned += Math.max(0, Math.round(record.budget.plannedAmount.cents));
    totalSpent += Math.max(0, Math.round(record.actuals.spentAmount.cents));
    if (record.actuals.overspent) {
      overspentBudgets += 1;
    }
  }

  const totalRemaining = Math.max(0, totalPlanned - totalSpent);

  return {
    periodKey,
    totalPlanned: toCurrencyAmount(totalPlanned, plannedCurrency),
    totalSpent: toCurrencyAmount(totalSpent, plannedCurrency),
    totalRemaining: toCurrencyAmount(totalRemaining, plannedCurrency),
    overspentBudgets,
  };
};

export const ensureBudgetGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    moneyMapNodeId: Id<'moneyMapNodes'>;
    createdByProfileId: string | null;
    autoApproveUpToCents?: number | null;
  }
) => {
  const existing = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'spend')
    )
    .collect();

  const guardrail = existing.find(
    (entry: any) =>
      entry.scope?.type === 'money_map_node' &&
      entry.scope.nodeId === params.moneyMapNodeId
  );

  if (guardrail) {
    return guardrail._id;
  }

  const timestamp = Date.now();
  const autoApproveUpToCents =
    params.autoApproveUpToCents != null && params.autoApproveUpToCents > 0
      ? params.autoApproveUpToCents
      : null;
  const guardrailId = await db.insert('transferGuardrails', {
    organizationId: params.organizationId,
    scope: { type: 'money_map_node', nodeId: params.moneyMapNodeId },
    intent: 'spend',
    direction: {
      sourceNodeId: params.moneyMapNodeId,
      destinationNodeId: null,
    },
    approvalPolicy: autoApproveUpToCents != null ? 'auto' : 'parent_required',
    autoApproveUpToCents,
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

  await logEvent(db, {
    organizationId: params.organizationId,
    eventKind: 'guardrail_updated',
    actorProfileId: params.createdByProfileId,
    primaryEntity: { table: 'transferGuardrails', id: guardrailId },
    payload: {
      scope: 'money_map_node',
      intent: 'spend',
      nodeId: params.moneyMapNodeId,
    },
  });

  return guardrailId;
};

export const updateBudgetGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    moneyMapNodeId: Id<'moneyMapNodes'>;
    autoApproveUpToCents: number | null;
  }
) => {
  const existing = await db
    .query('transferGuardrails')
    .withIndex('by_scope_intent', (q: any) =>
      q.eq('scope.type', 'money_map_node').eq('intent', 'spend')
    )
    .collect();

  const target = existing.find(
    (entry: any) =>
      entry.organizationId === params.organizationId &&
      entry.scope?.nodeId === params.moneyMapNodeId
  );

  if (!target) {
    return;
  }

  const normalizedLimit =
    params.autoApproveUpToCents != null && params.autoApproveUpToCents > 0
      ? params.autoApproveUpToCents
      : null;

  const approvalPolicy = normalizedLimit != null ? 'auto' : 'parent_required';

  await db.patch(target._id, {
    autoApproveUpToCents: normalizedLimit,
    approvalPolicy,
    updatedAt: Date.now(),
  });
};
