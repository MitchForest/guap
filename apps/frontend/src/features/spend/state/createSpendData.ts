import { Accessor, createMemo, createSignal } from 'solid-js';
import type {
  BudgetWithActuals,
  BudgetSummary,
  TransactionRecord,
  MoneyMapSnapshot,
} from '@guap/api';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import { guapApi } from '~/shared/services/guapApi';

export type SpendFilters = {
  search: string;
  needsVsWants: 'all' | 'needs' | 'wants' | 'neutral';
  sort: 'occurredAt' | '-occurredAt' | 'amount' | '-amount';
};

export type NeedsWantsBreakdown = {
  needs: number;
  wants: number;
  neutral: number;
  total: number;
};

const defaultFilters: SpendFilters = {
  search: '',
  needsVsWants: 'all',
  sort: '-occurredAt',
};

const serializeTransactionKey = (params: {
  organizationId: string;
  filters: SpendFilters;
}) => JSON.stringify(params);

const parseTransactionKey = (key: string) => JSON.parse(key) as {
  organizationId: string;
  filters: SpendFilters;
};

export const createSpendData = (organizationId: Accessor<string | null | undefined>) => {
  const [filters, setFilters] = createSignal<SpendFilters>(defaultFilters);

  const budgetsQuery = createGuapQuery<string, BudgetWithActuals[]>({
    source: () => organizationId() ?? null,
    initialValue: [],
    fetcher: async (orgId) => {
      return await guapApi.budgets.list({ organizationId: orgId, includeArchived: false });
    },
  });

  const summaryQuery = createGuapQuery<string, BudgetSummary | null>({
    source: () => organizationId() ?? null,
    initialValue: null,
    fetcher: async (orgId) => {
      return await guapApi.budgets.summarize({ organizationId: orgId });
    },
  });

  const moneyMapQuery = createGuapQuery<string, MoneyMapSnapshot | null>({
    source: () => organizationId() ?? null,
    initialValue: null,
    fetcher: async (orgId) => {
      return await guapApi.loadMoneyMap(orgId);
    },
  });

  const transactionsQuery = createGuapQuery<string, TransactionRecord[]>({
    source: () => {
      const orgId = organizationId();
      if (!orgId) return null;
      return serializeTransactionKey({ organizationId: orgId, filters: filters() });
    },
    initialValue: [],
    fetcher: async (key) => {
      const { organizationId: orgId, filters: activeFilters } = parseTransactionKey(key);
      const response = await guapApi.transactions.list({
        organizationId: orgId,
        limit: 100,
        search: activeFilters.search.trim() ? activeFilters.search.trim() : undefined,
        needsVsWants:
          activeFilters.needsVsWants === 'all' ? undefined : activeFilters.needsVsWants,
        sort: activeFilters.sort,
      });
      return response;
    },
  });

  const budgets = createMemo(() => budgetsQuery.data());
  const transactions = createMemo(() => transactionsQuery.data());
  const nodeLabelMap = createMemo(() => {
    const snapshot = moneyMapQuery.data();
    if (!snapshot) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const node of snapshot.nodes ?? []) {
      if (node.kind === 'pod' || node.kind === 'account') {
        map.set(node._id, node.label);
      }
    }
    return map;
  });

  const labelForBudget = (record: BudgetWithActuals) =>
    nodeLabelMap().get(record.budget.moneyMapNodeId) ?? 'Budget';

  const needsWants = createMemo<NeedsWantsBreakdown>(() => {
    const totals = { needs: 0, wants: 0, neutral: 0 };
    for (const txn of transactions()) {
      const cents = Math.abs(txn.amount.cents);
      if (txn.needsVsWants === 'needs') {
        totals.needs += cents;
      } else if (txn.needsVsWants === 'wants') {
        totals.wants += cents;
      } else {
        totals.neutral += cents;
      }
    }
    const total = totals.needs + totals.wants + totals.neutral;
    return { ...totals, total };
  });

  const setSearch = (value: string) => setFilters((prev) => ({ ...prev, search: value }));
  const setNeedsVsWants = (value: SpendFilters['needsVsWants']) =>
    setFilters((prev) => ({
      ...prev,
      needsVsWants: prev.needsVsWants === value ? 'all' : value,
    }));
  const setSort = (value: SpendFilters['sort']) =>
    setFilters((prev) => ({ ...prev, sort: value }));

  return {
    budgets,
    budgetsLoading: budgetsQuery.isLoading,
    budgetsError: budgetsQuery.error,
    refetchBudgets: budgetsQuery.refetch,

    summary: () => summaryQuery.data(),
    summaryLoading: summaryQuery.isLoading,
    refetchSummary: summaryQuery.refetch,
    reloadMoneyMap: moneyMapQuery.refetch,

    transactions,
    transactionsLoading: transactionsQuery.isLoading,
    transactionsError: transactionsQuery.error,
    refetchTransactions: transactionsQuery.refetch,

    filters,
    setSearch,
    setNeedsVsWants,
    setSort,
    needsWants,
    labelForBudget,
  };
};
