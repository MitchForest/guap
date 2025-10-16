import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  updateIncomeStreamImpl,
  skipIncomePayoutImpl,
  requestIncomePayoutImpl,
} from '../../domains/earn/mutations';

const mockDb = () => {
  const data = new Map<string, any>();
  return {
    get: vi.fn((id: string) => data.get(id) ?? null),
    patch: vi.fn((id: string, patch: Record<string, unknown>) => {
      const record = data.get(id);
      data.set(id, { ...record, ...patch });
    }),
    insert: vi.fn((table: string, value: any) => {
      const id = `${table}-${Math.random().toString(36).slice(2)}`;
      data.set(id, { ...value, _id: id });
      return id;
    }),
    query: vi.fn(() => ({
      withIndex: () => ({
        collect: async () => [],
      }),
    })),
    data,
  };
};

const session = { userId: 'profile-1', role: 'owner' } as any;

describe('earn mutations', () => {
  let ctx: any;
  let stream: any;

  beforeEach(() => {
    ctx = { db: mockDb() };
    ctx.db.data.set('account-1', {
      _id: 'account-1',
      organizationId: 'org-1',
      moneyMapNodeId: 'node-1',
      name: 'Checking',
    });
    stream = {
      _id: 'stream-1',
      organizationId: 'org-1',
      ownerProfileId: 'profile-1',
      name: 'Allowance',
      cadence: 'weekly',
      amount: { cents: 2000, currency: 'USD' },
      defaultDestinationAccountId: 'account-1',
      sourceAccountId: null,
      requiresApproval: false,
      autoSchedule: true,
      status: 'active',
      nextScheduledAt: Date.UTC(2025, 0, 5),
      lastPaidAt: null,
      createdByProfileId: 'profile-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    ctx.db.data.set(stream._id, stream);
    ctx.db.insert = vi.fn(() => 'transfer-1');
    ctx.db.query = vi.fn(() => ({
      withIndex: () => ({ collect: async () => [] }),
    }));
  });

  it('pauses and resumes stream scheduling', async () => {
    await updateIncomeStreamImpl(ctx, {
      organizationId: 'org-1',
      incomeStreamId: stream._id,
      status: 'paused',
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(stream._id, expect.objectContaining({
      status: 'paused',
      nextScheduledAt: null,
    }));

    ctx.db.patch.mockClear();

    await updateIncomeStreamImpl(ctx, {
      organizationId: 'org-1',
      incomeStreamId: stream._id,
      status: 'active',
    });

    const patchCall = ctx.db.patch.mock.calls[0]?.[1] as any;
    expect(patchCall.status).toBe('active');
    expect(typeof patchCall.nextScheduledAt).toBe('number');
    expect(patchCall.nextScheduledAt).toBeGreaterThan(stream.nextScheduledAt ?? 0);
  });

  it('logs skip events and advances schedule', async () => {
    await skipIncomePayoutImpl(
      ctx,
      {
        organizationId: 'org-1',
        incomeStreamId: stream._id,
      },
      session
    );

    const patchCall = ctx.db.patch.mock.calls[0]?.[1] as any;
    expect(typeof patchCall.nextScheduledAt).toBe('number');
  });

  it('creates payout transfer and updates stream on request', async () => {
    ctx.db.insert = vi.fn(() => 'transfer-123');

    await requestIncomePayoutImpl(
      ctx,
      {
        organizationId: 'org-1',
        incomeStreamId: stream._id,
      },
      session
    );

    expect(ctx.db.insert).toHaveBeenCalled();
    expect(ctx.db.patch).toHaveBeenCalledWith(stream._id, expect.objectContaining({
      lastPaidAt: expect.any(Number),
    }));
  });
});
