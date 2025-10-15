
import { Accessor, createMemo, createResource } from 'solid-js';
import type {
  InvestmentOrderRecord,
  InvestmentPositionRecord,
  WatchlistEntryRecord,
  InvestmentGuardrailEvaluation,
} from '@guap/types';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import {
  fetchGuardrail,
  fetchOrders,
  fetchPositions,
  fetchSnapshotsForSymbol,
  fetchWatchlist,
} from '../api/client';

type SnapshotSummary = {
  latest: number;
  previous: number;
  currency: string;
};

type PortfolioSummary = {
  totalCents: number;
  dailyChangeCents: number;
  changePercent: number;
};

type InvestData = {
  positions: () => InvestmentPositionRecord[];
  positionsLoading: () => boolean;
  refetchPositions: () => Promise<InvestmentPositionRecord[] | null | undefined>;
  orders: () => InvestmentOrderRecord[];
  ordersLoading: () => boolean;
  refetchOrders: () => Promise<InvestmentOrderRecord[] | null | undefined>;
  watchlist: () => WatchlistEntryRecord[];
  watchlistLoading: () => boolean;
  refetchWatchlist: () => Promise<WatchlistEntryRecord[] | null | undefined>;
  snapshots: () => Map<string, SnapshotSummary>;
  summary: () => PortfolioSummary;
  evaluateGuardrail: (input: {
    organizationId: string;
    accountId: string;
    symbol?: string;
    instrumentType?: string;
    side?: 'buy' | 'sell';
    notionalCents?: number;
  }) => Promise<InvestmentGuardrailEvaluation>;
};

export const createInvestData = (
  organizationId: Accessor<string | null | undefined>,
  profileId: Accessor<string | null | undefined>
): InvestData => {
  const positionsQuery = createGuapQuery<string, InvestmentPositionRecord[]>({
    source: organizationId,
    initialValue: [],
    fetcher: async (orgId) => await fetchPositions(orgId),
  });

  const ordersQuery = createGuapQuery<string, InvestmentOrderRecord[]>({
    source: organizationId,
    initialValue: [],
    fetcher: async (orgId) => await fetchOrders(orgId),
  });

  const watchlistQuery = createGuapQuery<string, WatchlistEntryRecord[]>({
    source: () => {
      const orgId = organizationId();
      const profile = profileId();
      if (!orgId || !profile) return null;
      return JSON.stringify({ orgId, profile });
    },
    initialValue: [],
    fetcher: async (key) => {
      const parsed = JSON.parse(key) as { orgId: string; profile: string };
      return await fetchWatchlist(parsed.orgId, parsed.profile);
    },
  });

  const [snapshots] = createResource(
    () => {
      const positions = positionsQuery.data();
      if (!positions.length) return null;
      const symbols = Array.from(new Set(positions.map((position) => position.symbol))).sort();
      return symbols.join(',');
    },
    async (key) => {
      const symbols = key?.split(',') ?? [];
      const entries = new Map<string, SnapshotSummary>();
      await Promise.all(
        symbols.map(async (symbol) => {
          const response = await fetchSnapshotsForSymbol(symbol);
          const latest = response[0]?.price.cents ?? 0;
          const previous = response[1]?.price.cents ?? latest;
          const currency = response[0]?.price.currency ?? 'USD';
          entries.set(symbol, { latest, previous, currency });
        })
      );
      return entries;
    },
    {
      initialValue: new Map<string, SnapshotSummary>(),
    }
  );

  const summary = createMemo<PortfolioSummary>(() => {
    const positions = positionsQuery.data();
    if (!positions.length) {
      return {
        totalCents: 0,
        dailyChangeCents: 0,
        changePercent: 0,
      };
    }

    const snapshotMap = snapshots() ?? new Map<string, SnapshotSummary>();
    let totalCents = 0;
    let previousCents = 0;

    for (const position of positions) {
      totalCents += position.marketValue.cents;
      const snapshot = snapshotMap.get(position.symbol);
      const priorPrice = snapshot ? snapshot.previous : position.lastPrice.cents;
      previousCents += Math.round(position.quantity * priorPrice);
    }

    const dailyChangeCents = totalCents - previousCents;
    const changePercent = previousCents > 0 ? dailyChangeCents / previousCents : 0;

    return {
      totalCents,
      dailyChangeCents,
      changePercent,
    };
  });

  const evaluateGuardrail = (input: {
    organizationId: string;
    accountId: string;
    symbol?: string;
    instrumentType?: string;
    side?: 'buy' | 'sell';
    notionalCents?: number;
  }) => fetchGuardrail(input);

  return {
    positions: positionsQuery.data,
    positionsLoading: positionsQuery.isLoading,
    refetchPositions: async () => await positionsQuery.refetch(),
    orders: ordersQuery.data,
    ordersLoading: ordersQuery.isLoading,
    refetchOrders: async () => await ordersQuery.refetch(),
    watchlist: watchlistQuery.data,
    watchlistLoading: watchlistQuery.isLoading,
    refetchWatchlist: async () => await watchlistQuery.refetch(),
    snapshots: () => snapshots() ?? new Map<string, SnapshotSummary>(),
    summary,
    evaluateGuardrail,
  };
};
