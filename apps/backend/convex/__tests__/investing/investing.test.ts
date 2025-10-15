import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
  ensureRole: vi.fn(),
  OWNER_ADMIN_ROLES: ['owner', 'admin'],
}));

vi.mock('../../domains/events/services', () => ({
  logEvent: vi.fn(),
}));

import { virtualProvider } from '@guap/providers';
import { createMockDb } from '../helpers/mockDb';
import {
  submitOrderHandler,
  approveOrderHandler,
  cancelOrderHandler,
  upsertWatchlistEntryHandler,
  removeWatchlistEntryHandler,
} from '../../domains/investing/mutations';
import { listPositionsHandler, getGuardrailSummaryHandler, listWatchlistEntriesHandler } from '../../domains/investing/queries';
import { ensureOrganizationAccess, ensureRole } from '../../core/session';
import { logEvent } from '../../domains/events/services';

const organizationId = 'org-1';
const profileId = 'user-1';

const ctxWithDb = (db: ReturnType<typeof createMockDb>) => ({ db }) as any;

const baseAccount = (db: ReturnType<typeof createMockDb>) => {
  const timestamp = Date.now();
  const accountId = db.insert('financialAccounts', {
    organizationId,
    moneyMapNodeId: db.insert('moneyMapNodes', {
      mapId: db.insert('moneyMaps', {
        organizationId,
        name: 'Invest Map',
        description: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      key: 'utma-node',
      kind: 'account',
      label: 'UTMA',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    name: 'UTMA',
    kind: 'utma',
    status: 'active',
    currency: 'USD',
    balance: { cents: 3_950_00, currency: 'USD' },
    available: { cents: 3_950_00, currency: 'USD' },
    provider: 'virtual',
    providerAccountId: 'virtual-utma',
    lastSyncedAt: timestamp,
    metadata: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  db.insert('transferGuardrails', {
    organizationId,
    scope: { type: 'account', accountId },
    intent: 'invest',
    direction: { sourceNodeId: null, destinationNodeId: null },
    approvalPolicy: 'auto',
    autoApproveUpToCents: 100_000,
    dailyLimitCents: null,
    weeklyLimitCents: null,
    allowedInstrumentKinds: ['etf', 'equity'],
    blockedSymbols: [],
    maxOrderAmountCents: null,
    requireApprovalForSell: false,
    allowedRolesToInitiate: ['owner', 'admin', 'member'],
    createdByProfileId: profileId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return accountId;
};

describe('investing domain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    vi.mocked(ensureOrganizationAccess).mockResolvedValue({
      activeOrganizationId: organizationId,
      role: 'admin',
      userId: profileId,
    });
    vi.mocked(ensureRole).mockImplementation(() => {});
    vi.mocked(logEvent).mockResolvedValue(undefined as any);
  });

  it('auto-executes orders when guardrail allows', async () => {
    const db = createMockDb();
    const accountId = baseAccount(db);
    const ctx = ctxWithDb(db);

    const result = await submitOrderHandler(ctx, {
      organizationId,
      accountId,
      symbol: 'VTI',
      instrumentType: 'etf',
      side: 'buy',
      quantity: 1,
    });

    expect(result?.status).toBe('executed');
    const positions = await listPositionsHandler(ctx, { organizationId });
    expect(positions.some((position: any) => position.symbol === 'VTI')).toBe(true);
  });

  it('requires approval when exceeding auto limit', async () => {
    const db = createMockDb();
    const accountId = baseAccount(db);
    const ctx = ctxWithDb(db);

    // Adjust guardrail to enforce approval above $50
    const guardrail = db
      .getTable('transferGuardrails')
      .find((record) => record.intent === 'invest');
    if (guardrail) {
      db.patch(guardrail._id, { maxOrderAmountCents: 5_000 });
    }

    const order = await submitOrderHandler(ctx, {
      organizationId,
      accountId,
      symbol: 'VTI',
      instrumentType: 'etf',
      side: 'buy',
      quantity: 1,
    });

    expect(order?.status).toBe('awaiting_parent');
  });

  it('approves and executes pending orders', async () => {
    const db = createMockDb();
    const accountId = baseAccount(db);
    const ctx = ctxWithDb(db);
    const guardrail = db
      .getTable('transferGuardrails')
      .find((record) => record.intent === 'invest');
    if (guardrail) {
      db.patch(guardrail._id, { maxOrderAmountCents: 5_000 });
    }

    const order = await submitOrderHandler(ctx, {
      organizationId,
      accountId,
      symbol: 'VTI',
      instrumentType: 'etf',
      side: 'buy',
      quantity: 1,
    });

    expect(order?.status).toBe('awaiting_parent');

    const approved = await approveOrderHandler(ctx, {
      organizationId,
      orderId: order!._id,
    });

    expect(approved?.status).toBe('executed');
    expect(approved?.approvedByProfileId).toBe(profileId);
  });

  it('cancels pending orders', async () => {
    const db = createMockDb();
    const accountId = baseAccount(db);
    const ctx = ctxWithDb(db);
    const guardrail = db
      .getTable('transferGuardrails')
      .find((record) => record.intent === 'invest');
    if (guardrail) {
      db.patch(guardrail._id, { maxOrderAmountCents: 5_000 });
    }

    const order = await submitOrderHandler(ctx, {
      organizationId,
      accountId,
      symbol: 'VTI',
      instrumentType: 'etf',
      side: 'buy',
      quantity: 1,
    });

    const canceled = await cancelOrderHandler(ctx, {
      organizationId,
      orderId: order!._id,
      reason: 'user_request',
    });

    expect(canceled?.status).toBe('canceled');
    expect(canceled?.failureReason).toBe('user_request');
  });

  it('manages watchlist entries', async () => {
    const db = createMockDb();
    const ctx = ctxWithDb(db);

    await upsertWatchlistEntryHandler(ctx, {
      organizationId,
      profileId,
      symbol: 'AAPL',
      instrumentType: 'equity',
      notes: 'Keep an eye on earnings',
    });

    let watchlist = await ctx.db
      .query('watchlistEntries')
      .withIndex('by_organization_profile', (q: any) =>
        q.eq('organizationId', organizationId).eq('profileId', profileId)
      )
      .collect();

    expect(watchlist).toHaveLength(1);
    expect(watchlist[0]?.symbol).toBe('AAPL');

    await removeWatchlistEntryHandler(ctx, {
      organizationId,
      profileId,
      symbol: 'AAPL',
    });

    watchlist = await ctx.db
      .query('watchlistEntries')
      .withIndex('by_organization_profile', (q: any) =>
        q.eq('organizationId', organizationId).eq('profileId', profileId)
      )
      .collect();

    expect(watchlist).toHaveLength(0);
  });
  it('filters watchlist entries by profile', async () => {
    const db = createMockDb();
    const accountId = baseAccount(db);
    const ctx = ctxWithDb(db);

    await upsertWatchlistEntryHandler(ctx, {
      organizationId,
      profileId,
      symbol: 'VTI',
      instrumentType: 'etf',
    });
    await upsertWatchlistEntryHandler(ctx, {
      organizationId,
      profileId: 'other-profile',
      symbol: 'AAPL',
      instrumentType: 'equity',
    });

    const filtered = await listWatchlistEntriesHandler(ctx, {
      organizationId,
      profileId,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.symbol).toBe('VTI');

    const allEntries = await listWatchlistEntriesHandler(ctx, {
      organizationId,
    });
    expect(allEntries).toHaveLength(2);

    // prevent unused variables lint for accountId
    expect(accountId).toBeTruthy();
  });

  it('normalizes legacy guardrail instrument kinds', async () => {
    const db = createMockDb();
    const accountId = baseAccount(db);
    const guardrail = db
      .getTable('transferGuardrails')
      .find((record) => record.intent === 'invest');

    if (guardrail) {
      db.patch(guardrail._id, { allowedInstrumentKinds: ['stock'] });
    }

    const ctx = ctxWithDb(db);
    const result = await getGuardrailSummaryHandler(ctx, {
      organizationId,
      accountId,
    });

    expect(result.summary.allowedInstrumentKinds).toEqual(['equity']);
  });

});