import type {
  DonationCause,
  DonationGuardrailSummary,
  DonationHistoryEntry,
  DonationOverview,
  DonationScheduleEntry,
  DonationSummary,
} from '@guap/types';
import type { CurrencyAmount } from '@guap/types';
import { virtualDonationCauses } from '@guap/providers';

const toCurrencyAmount = (cents: number, currency: string): CurrencyAmount => ({
  cents: Math.round(cents),
  currency,
});

export const getDonationCauses = (): DonationCause[] =>
  virtualDonationCauses.map((cause: DonationCause) => ({ ...cause }));

export const findDonationCause = (causeId: string): DonationCause | null => {
  const cause = virtualDonationCauses.find((entry: DonationCause) => entry.id === causeId);
  return cause ? { ...cause } : null;
};

const cloneTransfers = (records: any[]) => records.map((record) => ({ ...record }));

export const getDonationAccounts = async (db: any, organizationId: string) => {
  const accounts = await db
    .query('financialAccounts')
    .withIndex('by_organization', (q: any) => q.eq('organizationId', organizationId))
    .collect();

  return accounts.filter((account: any) => account.kind === 'donation');
};

const DONATION_TRANSFER_STATUSES: Array<'pending_approval' | 'approved' | 'executed' | 'declined' | 'canceled'> = [
  'pending_approval',
  'approved',
  'executed',
  'declined',
  'canceled',
];

export const fetchDonationTransfers = async (
  db: any,
  organizationId: string,
  statuses: Array<'pending_approval' | 'approved' | 'executed' | 'declined' | 'canceled'> = DONATION_TRANSFER_STATUSES
) => {
  const transfers: any[] = [];

  for (const status of statuses) {
    const rows = await db
      .query('transfers')
      .withIndex('by_organization_status', (q: any) =>
        q.eq('organizationId', organizationId).eq('status', status)
      )
      .collect();

    rows.forEach((row: any) => {
      if (row.intent === 'donate') {
        transfers.push(row);
      }
    });
  }

  transfers.sort(
    (a, b) => (b.requestedAt ?? b.createdAt ?? 0) - (a.requestedAt ?? a.createdAt ?? 0)
  );

  return cloneTransfers(transfers);
};

const summarizeGuardrail = (guardrail: any | null): DonationGuardrailSummary => {
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

const selectGuardrailForDonation = (
  guardrails: any[],
  params: { destinationAccountId: string | null; destinationNodeId: string | null }
) => {
  if (params.destinationAccountId) {
    const accountGuardrail = guardrails.find(
      (record: any) =>
        record.scope?.type === 'account' && record.scope.accountId === params.destinationAccountId
    );
    if (accountGuardrail) {
      return accountGuardrail;
    }
  }

  if (params.destinationNodeId) {
    const nodeGuardrail = guardrails.find(
      (record: any) =>
        record.scope?.type === 'money_map_node' && record.scope.nodeId === params.destinationNodeId
    );
    if (nodeGuardrail) {
      return nodeGuardrail;
    }
  }

  return guardrails.find((record: any) => record.scope?.type === 'organization') ?? null;
};

export const evaluateDonationGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    destinationAccountId: string;
    destinationNodeId: string | null;
    amountCents: number;
  }
) => {
  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'donate')
    )
    .collect();

  const selectedGuardrail = selectGuardrailForDonation(guardrails, {
    destinationAccountId: params.destinationAccountId,
    destinationNodeId: params.destinationNodeId,
  });

  const summary = summarizeGuardrail(selectedGuardrail);
  const autoLimit =
    summary.autoApproveUpToCents == null ? null : Math.round(summary.autoApproveUpToCents);

  const shouldExecute =
    summary.approvalPolicy === 'auto' &&
    (autoLimit == null || params.amountCents <= autoLimit);

  return {
    summary,
    shouldExecute,
  };
};

export const loadDonationGuardrailSummary = async (
  db: any,
  params: {
    organizationId: string;
    destinationAccountId: string | null;
    destinationNodeId: string | null;
  }
) => {
  if (!params.destinationAccountId) {
    return summarizeGuardrail(null);
  }

  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'donate')
    )
    .collect();

  const selectedGuardrail = selectGuardrailForDonation(guardrails, {
    destinationAccountId: params.destinationAccountId,
    destinationNodeId: params.destinationNodeId,
  });

  return summarizeGuardrail(selectedGuardrail);
};

export const upsertDonationGuardrail = async (
  db: any,
  params: {
    organizationId: string;
    accountId: string;
    approvalPolicy: 'auto' | 'parent_required' | 'admin_only';
    autoApproveUpToCents: number | null;
    actorProfileId: string | null;
  }
) => {
  const guardrails = await db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'donate')
    )
    .collect();

  let guardrail = guardrails.find(
    (entry: any) => entry.scope?.type === 'account' && entry.scope.accountId === params.accountId
  );

  const timestamp = Date.now();
  if (!guardrail) {
    const id = await db.insert('transferGuardrails', {
      organizationId: params.organizationId,
      scope: { type: 'account', accountId: params.accountId as any },
      intent: 'donate',
      direction: { sourceNodeId: null, destinationNodeId: null },
      approvalPolicy: params.approvalPolicy,
      autoApproveUpToCents: params.autoApproveUpToCents,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: params.actorProfileId ?? 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    guardrail = await db.get(id);
  } else {
    await db.patch(guardrail._id, {
      approvalPolicy: params.approvalPolicy,
      autoApproveUpToCents: params.autoApproveUpToCents,
      updatedAt: timestamp,
    });
    guardrail = await db.get(guardrail._id);
  }

  return {
    guardrailId: guardrail?._id ?? params.accountId,
    summary: summarizeGuardrail(guardrail),
  };
};

const getYearToDateRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  return {
    start: start.getTime(),
    monthsElapsed: now.getUTCMonth() + 1 || 1,
  };
};

export const calculateDonationSummary = async (
  db: any,
  params: {
    organizationId: string;
    donationAccounts: any[];
    executedTransfers: any[];
  }
): Promise<DonationSummary> => {
  const currency =
    params.donationAccounts[0]?.balance?.currency ?? params.executedTransfers[0]?.amount?.currency ?? 'USD';

  const { start, monthsElapsed } = getYearToDateRange();

  const contributions = params.executedTransfers.filter((transfer: any) => {
    const executedAt =
      transfer.executedAt ?? transfer.approvedAt ?? transfer.requestedAt ?? transfer.updatedAt ?? 0;
    return executedAt >= start;
  });

  const yearToDateCents = contributions.reduce((total, transfer) => {
    const amount = Math.round(transfer.amount?.cents ?? 0);
    return total + Math.max(0, amount);
  }, 0);

  const monthlyAverageCents = Math.round(
    yearToDateCents / Math.max(1, monthsElapsed)
  );

  const now = new Date();
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const budgets = await db
    .query('budgets')
    .withIndex('by_org_period', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('periodKey', periodKey)
    )
    .collect();

  const donationNodeIds = new Set(
    params.donationAccounts
      .map((account) => account.moneyMapNodeId)
      .filter((nodeId: unknown): nodeId is string => typeof nodeId === 'string')
  );

  const monthlyTargetCents = budgets.reduce((total: number, budget: any) => {
    if (!donationNodeIds.has(budget.moneyMapNodeId)) {
      return total;
    }
    const cents = Math.round(budget.plannedAmount?.cents ?? 0);
    return total + Math.max(0, cents);
  }, 0);

  const annualizedTargetCents = monthlyTargetCents * Math.max(1, monthsElapsed);

  const percentTowardTarget =
    annualizedTargetCents > 0 ? Math.min(yearToDateCents / annualizedTargetCents, 1) : 0;

  const lastDonationAt = params.executedTransfers.reduce((latest, transfer) => {
    const executedAt =
      transfer.executedAt ?? transfer.approvedAt ?? transfer.requestedAt ?? transfer.updatedAt ?? null;
    if (typeof executedAt === 'number' && executedAt > latest) {
      return executedAt;
    }
    return latest;
  }, 0);

  return {
    yearToDate: toCurrencyAmount(yearToDateCents, currency),
    monthlyAverage: toCurrencyAmount(monthlyAverageCents, currency),
    target: annualizedTargetCents > 0 ? toCurrencyAmount(annualizedTargetCents, currency) : null,
    percentTowardTarget,
    totalDonations: params.executedTransfers.length,
    lastDonationAt: lastDonationAt > 0 ? lastDonationAt : null,
  };
};

const extractCauseInfo = (transfer: any, causeMap: Map<string, DonationCause>) => {
  const metadata = (transfer.metadata ?? {}) as Record<string, unknown>;
  const causeId =
    typeof metadata.causeId === 'string'
      ? metadata.causeId
      : typeof metadata.causeSlug === 'string'
        ? metadata.causeSlug
        : null;

  const fallbackCause: DonationCause | null = typeof metadata.causeName === 'string'
    ? {
        id: causeId ?? 'custom',
        name: metadata.causeName,
        description: metadata.causeName,
        tags: [],
      }
    : null;

  const cause =
    (causeId ? causeMap.get(causeId) ?? fallbackCause : fallbackCause);

  return {
    causeId: cause?.id ?? causeId ?? 'custom',
    causeName:
      cause?.name ??
      (typeof metadata.causeName === 'string' ? metadata.causeName : 'Donation'),
  };
};

const toDonationHistoryEntry = (
  transfer: any,
  causeMap: Map<string, DonationCause>
): DonationHistoryEntry => {
  const { causeId, causeName } = extractCauseInfo(transfer, causeMap);
  const metadata = (transfer.metadata ?? {}) as Record<string, unknown>;
  const memo =
    typeof metadata.memo === 'string'
      ? metadata.memo
      : typeof metadata.note === 'string'
        ? metadata.note
        : null;

  return {
    transferId: transfer._id,
    causeId,
    causeName,
    amount: transfer.amount,
    status: transfer.status,
    requestedAt: transfer.requestedAt ?? transfer.createdAt ?? Date.now(),
    executedAt: transfer.executedAt ?? null,
    memo,
  };
};

export const buildDonationHistory = (
  transfers: any[],
  causes: DonationCause[],
  limit: number
): DonationHistoryEntry[] => {
  const causeMap = new Map(causes.map((cause) => [cause.id, cause]));
  return transfers
    .slice(0, limit)
    .map((transfer) => toDonationHistoryEntry(transfer, causeMap));
};

export const buildUpcomingDonations = (
  transfers: any[],
  causes: DonationCause[]
): DonationScheduleEntry[] => {
  const causeMap = new Map(causes.map((cause) => [cause.id, cause]));
  const now = Date.now();

  return transfers
    .filter((transfer) => {
      if (transfer.status === 'executed') return false;
      const metadata = transfer.metadata ?? {};
      const scheduledFor =
        typeof metadata?.scheduledFor === 'number' ? metadata.scheduledFor : null;
      return scheduledFor != null && scheduledFor >= now;
    })
    .map((transfer) => {
      const metadata = (transfer.metadata ?? {}) as Record<string, unknown>;
      const scheduledFor =
        typeof metadata.scheduledFor === 'number'
          ? metadata.scheduledFor
          : transfer.requestedAt ?? transfer.createdAt ?? Date.now();
      const { causeId, causeName } = extractCauseInfo(transfer, causeMap);

      return {
        transferId: transfer._id,
        causeId,
        causeName,
        amount: transfer.amount,
        scheduledFor,
        status: transfer.status,
      };
    })
    .sort((a, b) => a.scheduledFor - b.scheduledFor);
};

export const buildDonationOverview = async (
  db: any,
  params: {
    organizationId: string;
    limit: number;
  }
): Promise<DonationOverview> => {
  const causes = getDonationCauses();
  const donationAccounts = await getDonationAccounts(db, params.organizationId);
  const transfers = await fetchDonationTransfers(db, params.organizationId);
  const executedTransfers = transfers.filter((transfer) => transfer.status === 'executed');

  const summary = await calculateDonationSummary(db, {
    organizationId: params.organizationId,
    donationAccounts,
    executedTransfers,
  });

  const history = buildDonationHistory(transfers, causes, params.limit);
  const upcoming = buildUpcomingDonations(transfers, causes);

  const primaryAccount = donationAccounts[0] ?? null;
  const guardrail = await loadDonationGuardrailSummary(db, {
    organizationId: params.organizationId,
    destinationAccountId: primaryAccount?._id ?? null,
    destinationNodeId: (primaryAccount?.moneyMapNodeId as string | null) ?? null,
  });

  return {
    summary,
    causes,
    history,
    upcoming,
    guardrail,
  };
};
