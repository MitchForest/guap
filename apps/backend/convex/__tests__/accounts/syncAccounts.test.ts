import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { virtualProvider } from '@guap/providers';

vi.mock('../../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
  ensureRole: vi.fn(),
  OWNER_ADMIN_ROLES: ['owner', 'admin'],
}));

vi.mock('../../domains/events/services', () => ({
  logEvent: vi.fn(),
}));

import { syncAccountsImpl, type SyncAccountsInput } from '../../domains/accounts/mutations';
import { ensureOrganizationAccess, ensureRole } from '../../core/session';
import { logEvent } from '../../domains/events/services';
import { createMockDb } from '../helpers/mockDb';

const organizationId = 'org-1';

const baseAccount = (overrides: Partial<Record<string, unknown>> = {}) => ({
  providerAccountId: 'acct-1',
  name: 'Virtual Checking',
  kind: 'checking',
  status: 'active',
  currency: 'USD',
  balance: { cents: 125_00, currency: 'USD' },
  available: { cents: 125_00, currency: 'USD' },
  metadata: {},
  ...overrides,
});

const baseTransaction = (overrides: Partial<Record<string, unknown>> = {}) => ({
  providerTransactionId: 'txn-1',
  accountId: 'acct-1',
  description: 'Allowance Deposit',
  amount: { cents: 50_00, currency: 'USD' },
  postedAt: Date.now(),
  metadata: { merchantName: 'Allowance', categoryKey: 'income' },
  ...overrides,
});

describe('syncAccountsImpl', () => {
  let syncSpy: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    syncSpy = vi.spyOn(virtualProvider, 'sync');
    vi.mocked(ensureOrganizationAccess).mockResolvedValue({
      activeOrganizationId: organizationId,
      role: 'owner',
      userId: 'user-1',
    });
    vi.mocked(ensureRole).mockImplementation(() => {});
    vi.mocked(logEvent).mockImplementation(async () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    syncSpy.mockRestore();
  });

  const runSync = async (db: ReturnType<typeof createMockDb>, input?: Partial<SyncAccountsInput>) => {
    const ctx = { db } as any;
    await syncAccountsImpl(ctx, {
      organizationId,
      ...input,
    });
  };

  it('creates money map, account nodes, guardrails, and snapshots for new provider accounts', async () => {
    const db = createMockDb();
    syncSpy.mockResolvedValue({
      accounts: [
        baseAccount({ providerAccountId: 'acct-1', name: 'Checking' }),
        baseAccount({ providerAccountId: 'acct-2', name: 'Savings', kind: 'hysa' }),
      ],
      transactions: [baseTransaction({ accountId: 'acct-1' })],
    });

    await runSync(db);

    expect(db.getTable('moneyMaps')).toHaveLength(1);
    const moneyMapNodes = db
      .getTable('moneyMapNodes')
      .filter((node) => node.kind === 'account');
    expect(moneyMapNodes).toHaveLength(2);

    expect(db.getTable('financialAccounts')).toHaveLength(2);
    expect(db.getTable('accountSnapshots')).toHaveLength(2);
    expect(db.getTable('transferGuardrails')).toHaveLength(2);
    expect(db.getTable('transactions')).toHaveLength(1);

    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'account_synced',
    }));
  });

  it('does not duplicate guardrails or category rules across subsequent syncs', async () => {
    const db = createMockDb();
    const account = baseAccount({ providerAccountId: 'acct-guardrail', name: 'Checking' });
    syncSpy.mockResolvedValue({ accounts: [account], transactions: [] });

    await runSync(db);
    expect(db.getTable('transferGuardrails')).toHaveLength(1);
    expect(db.getTable('categoryRules')).toHaveLength(3);

    vi.mocked(logEvent).mockClear();
    await runSync(db, { force: true });

    expect(db.getTable('transferGuardrails')).toHaveLength(1);
    expect(db.getTable('categoryRules')).toHaveLength(3);
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'account_synced',
    }));
  });

  it('derives keyword category rules from Money Map pods when none exist', async () => {
    const db = createMockDb();
    const timestamp = Date.now();
    const mapId = db.insert('moneyMaps', {
      organizationId,
      name: 'Family Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    db.insert('moneyMapNodes', {
      mapId,
      key: 'allowance-pod',
      kind: 'pod',
      label: 'Allowance',
      metadata: { category: 'allowance', needsVsWants: 'needs' },
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    db.insert('moneyMapNodes', {
      mapId,
      key: 'snacks-pod',
      kind: 'pod',
      label: 'Snacks & Treats',
      metadata: { needsVsWants: 'wants' },
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    syncSpy.mockResolvedValue({
      accounts: [baseAccount({ providerAccountId: 'acct-3', name: 'Student Checking' })],
      transactions: [],
    });

    await runSync(db);

    const categoryRules = db.getTable('categoryRules');
    expect(categoryRules).toHaveLength(2);
    expect(categoryRules.every((rule) => rule.matchType === 'keywords')).toBe(true);
    expect(categoryRules.map((rule) => rule.pattern)).toEqual(
      expect.arrayContaining(['Allowance', 'Snacks & Treats'])
    );
  });
});
