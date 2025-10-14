import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
}));

import { listTransfersImpl } from '../../domains/transfers/queries';
import { ensureOrganizationAccess } from '../../core/session';
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
  });

  it('returns transfers ordered by most recent requestedAt value', async () => {
    const db = createMockDb();
    db.insert('transfers', baseTransfer({ requestedAt: 5, createdAt: 5 }));
    db.insert('transfers', baseTransfer({ requestedAt: 20, createdAt: 20 }));
    db.insert('transfers', baseTransfer({ requestedAt: 10, createdAt: 10 }));

    const ctx = { db } as any;
    const result = await listTransfersImpl(ctx, { organizationId, limit: 10 });

    expect(result.map((transfer) => transfer.requestedAt)).toEqual([20, 10, 5]);
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
    expect(result.every((transfer) => transfer.status === 'approved')).toBe(true);
  });
});
