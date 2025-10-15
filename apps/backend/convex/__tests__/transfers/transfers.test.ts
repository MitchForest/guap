import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransferRecord } from '@guap/types';

vi.mock('../../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
  ensureRole: vi.fn(),
  OWNER_ADMIN_ROLES: ['owner', 'admin'],
}));

vi.mock('../../domains/events/services', () => ({
  logEvent: vi.fn(),
}));

import { listTransfersImpl } from '../../domains/transfers/queries';
import { initiateSpendTransferImpl } from '../../domains/transfers/mutations';
import { ensureOrganizationAccess, ensureRole } from '../../core/session';
import { logEvent } from '../../domains/events/services';
import { createMockDb } from '../helpers/mockDb';

const organizationId = 'org-1';

const baseTransfer = (overrides: Partial<Record<string, unknown>> = {}) => ({
  organizationId,
  intent: 'manual',
  sourceAccountId: null,
  destinationAccountId: 'acct-1',
  amount: { cents: 5_000, currency: 'USD' },
  requestedByProfileId: 'user-1',
  approvedByProfileId: null,
  status: 'pending_approval',
  goalId: null,
  orderId: null,
  requestedAt: 0,
  approvedAt: null,
  executedAt: null,
  metadata: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('listTransfersImpl', () => {
  beforeEach(() => {
    vi.mocked(ensureOrganizationAccess).mockResolvedValue({
      activeOrganizationId: organizationId,
      role: 'owner',
      userId: 'user-1',
    });
    vi.mocked(ensureRole).mockImplementation(() => {});
    vi.mocked(logEvent).mockClear();
    vi.mocked(logEvent).mockResolvedValue(undefined);
  });

  it('returns transfers ordered by most recent requestedAt value', async () => {
    const db = createMockDb();
    db.insert('transfers', baseTransfer({ requestedAt: 5, createdAt: 5 }));
    db.insert('transfers', baseTransfer({ requestedAt: 20, createdAt: 20 }));
    db.insert('transfers', baseTransfer({ requestedAt: 10, createdAt: 10 }));

    const ctx = { db } as any;
    const result = await listTransfersImpl(ctx, { organizationId, limit: 10 });

    expect(result.map((transfer: TransferRecord) => transfer.requestedAt)).toEqual([20, 10, 5]);
    expect(ensureOrganizationAccess).toHaveBeenCalledWith(ctx, organizationId);
  });

  it('filters by status when provided', async () => {
    const db = createMockDb();
    db.insert('transfers', baseTransfer({ status: 'pending_approval', requestedAt: 1 }));
    db.insert('transfers', baseTransfer({ status: 'approved', requestedAt: 2 }));
    db.insert('transfers', baseTransfer({ status: 'approved', requestedAt: 3 }));

    const ctx = { db } as any;
    const result = await listTransfersImpl(ctx, {
      organizationId,
      status: 'approved',
      limit: 10,
    });

    expect(result).toHaveLength(2);
    expect(result.every((transfer: TransferRecord) => transfer.status === 'approved')).toBe(true);
  });
});

describe('initiateSpendTransfer', () => {
  const createAccount = (db: ReturnType<typeof createMockDb>, overrides: Record<string, unknown>) =>
    db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: null,
      name: 'Account',
      kind: 'checking',
      status: 'active',
      currency: 'USD',
      balance: { cents: 10_000, currency: 'USD' },
      available: { cents: 10_000, currency: 'USD' },
      provider: 'virtual',
      providerAccountId: null,
      lastSyncedAt: Date.now(),
      metadata: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });

  beforeEach(() => {
    vi.mocked(ensureOrganizationAccess).mockResolvedValue({
      activeOrganizationId: organizationId,
      role: 'owner',
      userId: 'user-1',
    });
    vi.mocked(ensureRole).mockImplementation(() => {});
    vi.mocked(logEvent).mockClear();
    vi.mocked(logEvent).mockResolvedValue(undefined);
  });

  it('executes transfer immediately when guardrail allows auto approval', async () => {
    const db = createMockDb();
    const nodeId = 'node-credit';
    const sourceAccountId = createAccount(db, { name: 'Checking' });
    const destinationAccountId = createAccount(db, {
      name: 'Credit Card',
      kind: 'credit',
      moneyMapNodeId: nodeId,
    });
    db.insert('transferGuardrails', {
      organizationId,
      scope: { type: 'money_map_node', nodeId },
      intent: 'spend',
      direction: { sourceNodeId: nodeId, destinationNodeId: null },
      approvalPolicy: 'auto',
      autoApproveUpToCents: 10_000,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: 'user-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const ctx = { db } as any;

    const result = await initiateSpendTransferImpl(
      ctx,
      {
        organizationId,
        sourceAccountId,
        destinationAccountId,
        amount: { cents: 5_000, currency: 'USD' },
      },
      { userId: 'user-1' }
    );

    expect(result.transfer?.status).toBe('executed');
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'transfer_requested',
    }));
    expect(logEvent).toHaveBeenCalledTimes(2);
    const transfers = db.getTable('transfers');
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.status).toBe('executed');
    const transactions = db.getTable('transactions');
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.transferId).toBe(transfers[0]?._id);
    expect(transactions[0]?.needsVsWants).toBeNull();
  });

  it('marks transfer pending when guardrail requires approval', async () => {
    const db = createMockDb();
    const nodeId = 'node-credit';
    const sourceAccountId = createAccount(db, { name: 'Checking' });
    const destinationAccountId = createAccount(db, {
      name: 'Credit Card',
      kind: 'credit',
      moneyMapNodeId: nodeId,
    });
    db.insert('transferGuardrails', {
      organizationId,
      scope: { type: 'money_map_node', nodeId },
      intent: 'spend',
      direction: { sourceNodeId: nodeId, destinationNodeId: null },
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: 'user-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const ctx = { db } as any;

    const result = await initiateSpendTransferImpl(
      ctx,
      {
        organizationId,
        sourceAccountId,
        destinationAccountId,
        amount: { cents: 50_000, currency: 'USD' },
        memo: 'Pay off card',
      },
      { userId: 'user-1' }
    );

    expect(result.transfer?.status).toBe('pending_approval');
    const transfers = db.getTable('transfers');
    expect(transfers[0]?.status).toBe('pending_approval');
    expect(logEvent).toHaveBeenCalledTimes(1);
    const transactions = db.getTable('transactions');
    expect(transactions).toHaveLength(0);
  });
});
