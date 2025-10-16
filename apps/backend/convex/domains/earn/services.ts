import type { Id } from '@guap/api/codegen/dataModel';
import type { CurrencyAmount } from '@guap/types';
import type { IncomeCadence } from '@guap/types';
import { loadSnapshot } from '../moneyMaps/services';

type IncomeStreamRecord = {
  _id: Id<'incomeStreams'>;
  organizationId: string;
  ownerProfileId: string;
  name: string;
  cadence: IncomeCadence;
  amount: CurrencyAmount;
  defaultDestinationAccountId: Id<'financialAccounts'> | null;
  sourceAccountId: Id<'financialAccounts'> | null;
  requiresApproval: boolean;
  autoSchedule: boolean;
  status: string;
  nextScheduledAt: number | null;
  lastPaidAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type GuardrailRecord = {
  _id: Id<'transferGuardrails'>;
  organizationId: string;
  approvalPolicy?: 'auto' | 'parent_required' | 'admin_only';
  autoApproveUpToCents?: number | null;
  scope?: { type: 'organization' } | { type: 'account'; accountId: Id<'financialAccounts'> } | { type: 'money_map_node'; nodeId: Id<'moneyMapNodes'> };
};

const DAY_MS = 86_400_000;

const cadenceIntervalMs = (cadence: IncomeCadence): number => {
  switch (cadence) {
    case 'daily':
      return DAY_MS;
    case 'weekly':
      return DAY_MS * 7;
    case 'biweekly':
      return DAY_MS * 14;
    case 'monthly':
      return DAY_MS * 30;
    case 'quarterly':
      return DAY_MS * 90;
    case 'yearly':
      return DAY_MS * 365;
    default:
      return DAY_MS * 30;
  }
};

const addMonths = (timestamp: number, months: number) => {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() + months);
  return date.getTime();
};

export const resolveNextScheduledAt = (
  cadence: IncomeCadence,
  reference: number | null,
  fallback: number
) => {
  const base = reference ?? fallback;
  switch (cadence) {
    case 'monthly':
      return addMonths(base, 1);
    case 'quarterly':
      return addMonths(base, 3);
    case 'yearly':
      return addMonths(base, 12);
    default:
      return base + cadenceIntervalMs(cadence);
  }
};

export const normalizeScheduledAt = (input: number | null | undefined, cadence: IncomeCadence) => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  const now = Date.now();
  // Ensure the schedule is in the future by at least one cadence interval.
  return resolveNextScheduledAt(cadence, now, now);
};

export const calculateMonthlyAmount = (amountCents: number, cadence: IncomeCadence) => {
  switch (cadence) {
    case 'daily':
      return amountCents * 30;
    case 'weekly':
      return amountCents * 4;
    case 'biweekly':
      return amountCents * 2;
    case 'quarterly':
      return Math.round(amountCents / 3);
    case 'yearly':
      return Math.round(amountCents / 12);
    default:
      return amountCents;
  }
};

export const summarizeGuardrail = (guardrail: GuardrailRecord | null, fallbackPolicy: 'auto' | 'parent_required') => {
  return {
    approvalPolicy: guardrail?.approvalPolicy ?? fallbackPolicy,
    autoApproveUpToCents:
      typeof guardrail?.autoApproveUpToCents === 'number' ? guardrail.autoApproveUpToCents : null,
    scope: guardrail?.scope?.type ?? null,
  };
};

export const selectGuardrailForEarn = (
  guardrails: GuardrailRecord[],
  params: {
    destinationAccountId: Id<'financialAccounts'> | null;
    destinationNodeId: Id<'moneyMapNodes'> | null;
  }
) => {
  if (params.destinationAccountId) {
    const accountGuardrail = guardrails.find(
      (record) => record.scope?.type === 'account' && record.scope.accountId === params.destinationAccountId
    );
    if (accountGuardrail) {
      return accountGuardrail;
    }
  }

  if (params.destinationNodeId) {
    const nodeGuardrail = guardrails.find(
      (record) => record.scope?.type === 'money_map_node' && record.scope.nodeId === params.destinationNodeId
    );
    if (nodeGuardrail) {
      return nodeGuardrail;
    }
  }

  return guardrails.find((record) => record.scope?.type === 'organization') ?? null;
};

export const evaluateEarnGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    destinationAccountId: Id<'financialAccounts'> | null;
    destinationNodeId: Id<'moneyMapNodes'> | null;
    amountCents: number;
    streamRequiresApproval: boolean;
  }
) => {
  const guardrails: GuardrailRecord[] = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'earn')
    )
    .collect();

  const matchedGuardrail = selectGuardrailForEarn(guardrails, {
    destinationAccountId: params.destinationAccountId,
    destinationNodeId: params.destinationNodeId,
  });

  const fallbackPolicy = params.streamRequiresApproval ? 'parent_required' : 'auto';
  const summary = summarizeGuardrail(matchedGuardrail, fallbackPolicy);
  const autoLimit =
    summary.autoApproveUpToCents == null ? null : Math.round(summary.autoApproveUpToCents);

  const shouldExecute =
    summary.approvalPolicy === 'auto' &&
    (autoLimit == null || params.amountCents <= autoLimit);

  return {
    summary,
    decision: shouldExecute ? 'execute' : 'pending',
  } as const;
};

export const advanceStreamSchedule = (
  stream: IncomeStreamRecord,
  reference: number | null
) => {
  if (!stream.autoSchedule) {
    return null;
  }
  const scheduledBase = reference ?? stream.nextScheduledAt ?? Date.now();
  return resolveNextScheduledAt(stream.cadence, scheduledBase, Date.now());
};

export const deriveNextScheduledAt = (
  stream: IncomeStreamRecord,
  options: {
    cadenceOverride?: IncomeCadence | null;
    nextScheduledAtOverride?: number | null;
    now?: number;
  } = {}
) => {
  const cadence = options.cadenceOverride ?? stream.cadence;
  const now = options.now ?? Date.now();
  const base =
    options.nextScheduledAtOverride ??
    stream.nextScheduledAt ??
    stream.lastPaidAt ??
    now;
  return normalizeScheduledAt(base, cadence);
};

const MAX_PROJECTION_PER_STREAM = 3;

export const computeStreamProjections = (
  stream: IncomeStreamRecord,
  options: { perStream?: number; now?: number } = {}
) => {
  const occurrences: Array<{ scheduledAt: number }> = [];
  const perStream = options.perStream ?? MAX_PROJECTION_PER_STREAM;
  const now = options.now ?? Date.now();

  let next = stream.nextScheduledAt;

  if ((!next || next <= now) && stream.autoSchedule) {
    next = deriveNextScheduledAt(stream, { now });
  }

  if (!next) {
    return occurrences;
  }

  let current = next;
  let count = 0;

  while (count < perStream && typeof current === 'number') {
    if (current >= now) {
      occurrences.push({ scheduledAt: current });
      count += 1;
    }
    current = resolveNextScheduledAt(stream.cadence, current, current);
  }

  return occurrences;
};

export const buildEarnProjections = (
  streams: IncomeStreamRecord[],
  options: { perStream?: number; limit?: number; now?: number } = {}
) => {
  const perStream = options.perStream ?? 2;
  const limit = options.limit ?? 8;
  const now = options.now ?? Date.now();

  const entries = streams.flatMap((stream) => {
    const occurrences = computeStreamProjections(stream, { perStream, now });
    return occurrences.map((occurrence) => ({
      streamId: stream._id,
      streamName: stream.name,
      scheduledAt: occurrence.scheduledAt,
      amount: stream.amount,
      cadence: stream.cadence,
      autoScheduled: stream.autoSchedule,
    }));
  });

  return entries
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
    .slice(0, limit);
};

type StreamAllocation = {
  nodeId: string;
  nodeName: string;
  percentage: number;
};

export const createStreamAllocationLookup = async (
  db: any,
  params: { organizationId: string }
) => {
  const maps = await db
    .query('moneyMaps')
    .withIndex('by_organization', (q: any) => q.eq('organizationId', params.organizationId))
    .collect();

  const map = maps[0];
  if (!map) {
    return () => [] as StreamAllocation[];
  }

  const [snapshot, accounts] = await Promise.all([
    loadSnapshot(db, map._id),
    db
      .query('financialAccounts')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', params.organizationId))
      .collect(),
  ]);

  const accountById = new Map(accounts.map((account: any) => [account._id, account]));
  const nodeById = new Map(snapshot.nodes.map((node: any) => [node._id, node]));
  const nodeByKey = new Map(snapshot.nodes.map((node: any) => [node.key, node]));

  const allocationsBySourceKey = new Map<string, Array<{ targetKey: string; percentage: number }>>();

  for (const rule of snapshot.rules) {
    const config = (rule.config ?? {}) as Record<string, unknown>;
    const sourceNodeId = typeof config.sourceNodeId === 'string' ? config.sourceNodeId : null;
    const rawAllocations = Array.isArray((config as any).allocations)
      ? ((config as any).allocations as Array<{ targetNodeId: string; percentage: number }>)
      : [];

    if (!sourceNodeId || !rawAllocations.length) {
      continue;
    }

    const normalized = rawAllocations
      .map((alloc) => ({
        targetKey: alloc.targetNodeId,
        percentage: Number.isFinite(alloc.percentage) ? alloc.percentage : 0,
      }))
      .filter((alloc) => alloc.targetKey && alloc.percentage > 0);

    if (!normalized.length) continue;

    const existing = allocationsBySourceKey.get(sourceNodeId) ?? [];
    allocationsBySourceKey.set(sourceNodeId, existing.concat(normalized));
  }

  return (stream: IncomeStreamRecord | null | undefined): StreamAllocation[] => {
    if (!stream) return [];

    const accountId =
      (stream.defaultDestinationAccountId as Id<'financialAccounts'> | null) ??
      (stream.sourceAccountId as Id<'financialAccounts'> | null) ??
      null;

    if (!accountId) return [];

    const account = accountById.get(accountId) as any | undefined;
    if (!account) return [];

    const nodeId = account.moneyMapNodeId as Id<'moneyMapNodes'> | null;
    if (!nodeId) return [];

    const node = nodeById.get(nodeId) as any | undefined;
    if (!node) return [];

    const allocations = allocationsBySourceKey.get(node.key);
    if (!allocations || !allocations.length) {
      return [
        {
          nodeId: String(node._id),
          nodeName: node.label ?? 'Account',
          percentage: 100,
        },
      ];
    }

    const mapped = allocations
      .map((alloc) => {
        const target = nodeByKey.get(alloc.targetKey) as any | undefined;
        if (!target) return null;
        return {
          nodeId: String(target._id),
          nodeName: target.label ?? 'Allocation',
          percentage: alloc.percentage,
        } satisfies StreamAllocation;
      })
      .filter((value): value is StreamAllocation => value !== null);

    if (!mapped.length) {
      return [
        {
          nodeId: String(node._id),
          nodeName: node.label ?? 'Account',
          percentage: 100,
        },
      ];
    }

    return mapped;
  };
};

export const ensureDestinationAccount = async (
  db: any,
  params: { accountId: Id<'financialAccounts'> | null; organizationId: string }
) => {
  if (!params.accountId) {
    return null;
  }
  const account = await db.get(params.accountId);
  if (!account || account.organizationId !== params.organizationId) {
    throw new Error('Destination account not found in organization');
  }
  return account;
};

export const ensureSourceAccount = async (
  db: any,
  params: { accountId: Id<'financialAccounts'> | null; organizationId: string }
) => {
  if (!params.accountId) {
    return null;
  }
  const account = await db.get(params.accountId);
  if (!account || account.organizationId !== params.organizationId) {
    throw new Error('Source account not found in organization');
  }
  return account;
};
