import { describe, expect, it, vi } from 'vitest';
import { InvestingApi } from '../domains/investing/client';

const samplePosition = {
  _id: 'pos-1',
  organizationId: 'org-1',
  accountId: 'acc-1',
  symbol: 'VTI',
  instrumentType: 'etf',
  quantity: 5,
  averageCost: { cents: 200_00, currency: 'USD' },
  marketValue: { cents: 250_00, currency: 'USD' },
  lastPrice: { cents: 50_00, currency: 'USD' },
  lastPricedAt: Date.now(),
  metadata: null,
  updatedAt: Date.now(),
};

const sampleOrder = {
  _id: 'order-1',
  organizationId: 'org-1',
  accountId: 'acc-1',
  symbol: 'VTI',
  instrumentType: 'etf',
  side: 'buy' as const,
  orderType: 'market' as const,
  quantity: 1,
  notional: { cents: 50_00, currency: 'USD' },
  limitPrice: null,
  status: 'awaiting_parent' as const,
  placedByProfileId: 'user-1',
  approvedByProfileId: null,
  submittedAt: Date.now(),
  approvedAt: null,
  executedAt: null,
  executionPrice: null,
  transferId: null,
  failureReason: null,
  metadata: null,
};

const sampleWatchlist = {
  _id: 'watch-1',
  organizationId: 'org-1',
  profileId: 'user-1',
  symbol: 'AAPL',
  instrumentType: 'equity',
  createdAt: Date.now(),
  notes: null,
};

const guardrailEvaluation = {
  decision: 'auto_execute' as const,
  guardrailId: 'guard-1',
  summary: {
    approvalPolicy: 'auto' as const,
    maxOrderAmountCents: null,
    blockedSymbols: [],
    allowedInstrumentKinds: ['equity'],
    requireApprovalForSell: false,
    scope: null,
  },
};

describe('InvestingApi', () => {
  const buildClient = () => {
    const queryHandlers: Record<string, (args: any) => any> = {
      'domains/investing/queries:listPositions': () => [samplePosition],
      'domains/investing/queries:listOrders': () => [sampleOrder],
      'domains/investing/queries:getOrderById': () => sampleOrder,
      'domains/investing/queries:listWatchlistEntries': () => [sampleWatchlist],
      'domains/investing/queries:getGuardrailSummary': () => guardrailEvaluation,
      'domains/investing/queries:listInstrumentSnapshots': () => [
        { _id: 'snap-1', symbol: 'VTI', price: { cents: 52_00, currency: 'USD' }, capturedAt: Date.now(), source: 'virtual' },
      ],
    };

    const mutationHandlers: Record<string, (args: any) => any> = {
      'domains/investing/mutations:submitOrder': () => ({ ...sampleOrder, status: 'awaiting_parent' as const }),
      'domains/investing/mutations:approveOrder': () => ({ ...sampleOrder, status: 'executed' as const }),
      'domains/investing/mutations:cancelOrder': () => ({ ...sampleOrder, status: 'canceled' as const }),
      'domains/investing/mutations:upsertWatchlistEntry': () => sampleWatchlist,
      'domains/investing/mutations:removeWatchlistEntry': () => undefined,
    };

    const query = vi.fn(async (name: string, args: unknown) => {
      const handler = queryHandlers[name];
      expect(handler).toBeDefined();
      return handler(args);
    });

    const mutation = vi.fn(async (name: string, args: unknown) => {
      const handler = mutationHandlers[name];
      expect(handler).toBeDefined();
      return handler(args);
    });

    return { client: { query, mutation } as any, query, mutation };
  };

  it('invokes queries with expected payloads', async () => {
    const { client, query } = buildClient();
    const api = new InvestingApi(client);

    const positions = await api.listPositions({ organizationId: 'org-1' });
    expect(positions).toEqual([samplePosition]);
    expect(query).toHaveBeenCalledWith('domains/investing/queries:listPositions', { organizationId: 'org-1' });

    const orders = await api.listOrders({ organizationId: 'org-1', limit: 25 });
    expect(orders[0]?.status).toBe('awaiting_parent');

    const guardrail = await api.getGuardrail({ organizationId: 'org-1', accountId: 'acc-1' });
    expect(guardrail.decision).toBe('auto_execute');

    const snapshots = await api.listSnapshots({ symbol: 'VTI', limit: 1 });
    expect(snapshots).toHaveLength(1);
  });

  it('invokes mutations for order lifecycle and watchlist operations', async () => {
    const { client, mutation } = buildClient();
    const api = new InvestingApi(client);

    const submitted = await api.submitOrder({
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbol: 'VTI',
      instrumentType: 'etf',
      side: 'buy',
      quantity: 1,
    });
    expect(submitted.status).toBe('awaiting_parent');

    const approved = await api.approveOrder({ organizationId: 'org-1', orderId: 'order-1' });
    expect(approved.status).toBe('executed');

    const canceled = await api.cancelOrder({ organizationId: 'org-1', orderId: 'order-1' });
    expect(canceled.status).toBe('canceled');

    const watchlistEntry = await api.upsertWatchlist({
      organizationId: 'org-1',
      profileId: 'user-1',
      symbol: 'AAPL',
      instrumentType: 'equity',
    });
    expect(watchlistEntry.symbol).toBe('AAPL');

    await api.removeWatchlist({ organizationId: 'org-1', profileId: 'user-1', symbol: 'AAPL' });

    expect(mutation).toHaveBeenCalledTimes(5);
  });
});
