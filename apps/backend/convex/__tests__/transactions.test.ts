import { describe, expect, it, vi, beforeEach } from 'vitest';

const ensureOrganizationAccessMock = vi.hoisted(() => vi.fn());

vi.mock('../core/session', () => ({
  ensureOrganizationAccess: ensureOrganizationAccessMock,
}));

import { listTransactionsImpl } from '../domains/transactions/queries';

class MockQuery {
  constructor(private readonly rows: any[]) {}

  withIndex(_index: string, callback: (q: any) => any) {
    callback({ eq: () => this });
    return this;
  }

  order() {
    this.rows.reverse();
    return this;
  }

  take(limit: number) {
    return this.rows.slice(0, limit);
  }

  collect() {
    return [...this.rows];
  }
}

describe('transactions queries', () => {
  beforeEach(() => {
    ensureOrganizationAccessMock.mockResolvedValue({ organizationId: 'org-1' });
  });

  it('filters by account when provided', async () => {
    const rows = [
      { _id: 't-1', organizationId: 'org-1', accountId: 'acc-1', direction: 'debit', status: 'posted', needsVsWants: null },
      { _id: 't-2', organizationId: 'org-1', accountId: 'acc-2', direction: 'credit', status: 'posted', needsVsWants: null },
    ];

    const ctx = {
      db: {
        query: () => new MockQuery(rows),
      },
    } as any;

    const result = await listTransactionsImpl(ctx, {
      organizationId: 'org-1',
      accountId: 'acc-1',
      limit: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?._id).toBe('t-1');
  });

  it('applies direction and status filters', async () => {
    const rows = [
      { _id: 't-1', organizationId: 'org-1', accountId: 'acc-1', direction: 'debit', status: 'posted', needsVsWants: 'needs' },
      { _id: 't-2', organizationId: 'org-1', accountId: 'acc-1', direction: 'credit', status: 'pending', needsVsWants: 'wants' },
    ];

    const ctx = {
      db: {
        query: () => new MockQuery(rows),
      },
    } as any;

    const result = await listTransactionsImpl(ctx, {
      organizationId: 'org-1',
      direction: 'credit',
      status: 'pending',
      needsVsWants: 'wants',
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?._id).toBe('t-2');
    expect(result[0]?.direction).toBe('credit');
  });
});
