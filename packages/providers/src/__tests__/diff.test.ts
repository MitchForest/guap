import { describe, expect, it } from 'vitest';
import type { ProviderSyncResult } from '../contracts';
import { diffProviderSync } from '../diff';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

const previousResult: ProviderSyncResult = {
  accounts: [
    {
      providerAccountId: 'acct-1',
      name: 'Checking',
      kind: 'checking',
      status: 'active',
      currency: 'USD',
      balance: usd(12_500),
      available: usd(12_500),
    },
    {
      providerAccountId: 'acct-2',
      name: 'Savings',
      kind: 'hysa',
      status: 'active',
      currency: 'USD',
      balance: usd(40_000),
      available: usd(40_000),
    },
  ],
  transactions: [
    {
      providerTransactionId: 'tx-1',
      accountId: 'acct-1',
      description: 'Deposit',
      amount: usd(2_000),
      postedAt: 1,
    },
  ],
  incomeStreams: [
    {
      providerIncomeId: 'income-1',
      label: 'Allowance',
      cadence: 'weekly',
      amount: usd(5_000),
    },
  ],
  users: [
    {
      providerUserId: 'user-1',
      displayName: 'Guardian One',
      role: 'guardian',
    },
  ],
};

describe('diffProviderSync', () => {
  it('computes created, updated, and removed entities', () => {
    const next: ProviderSyncResult = {
      accounts: [
        {
          providerAccountId: 'acct-1',
          name: 'Checking',
          kind: 'checking',
          status: 'active',
          currency: 'USD',
          balance: usd(13_000),
          available: usd(13_000),
        },
        {
          providerAccountId: 'acct-3',
          name: 'Brokerage',
          kind: 'brokerage',
          status: 'active',
          currency: 'USD',
          balance: usd(9_000),
          available: usd(9_000),
        },
      ],
      transactions: [
        {
          providerTransactionId: 'tx-2',
          accountId: 'acct-3',
          description: 'Transfer',
          amount: usd(500),
          postedAt: 2,
        },
      ],
      incomeStreams: [],
      users: [
        {
          providerUserId: 'user-1',
          displayName: 'Guardian One',
          role: 'guardian',
        },
        {
          providerUserId: 'user-2',
          displayName: 'Student Two',
          role: 'student',
        },
      ],
    };

    const diff = diffProviderSync(previousResult, next);

    expect(diff.accounts.created.map((item) => item.providerAccountId)).toEqual(['acct-3']);
    expect(diff.accounts.updated).toHaveLength(1);
    expect(diff.accounts.updated[0].previous.providerAccountId).toBe('acct-1');
    expect(diff.accounts.updated[0].next.balance.cents).toBe(13_000);
    expect(diff.accounts.removed.map((item) => item.providerAccountId)).toEqual(['acct-2']);

    expect(diff.transactions.created.map((item) => item.providerTransactionId)).toEqual(['tx-2']);
    expect(diff.transactions.removed.map((item) => item.providerTransactionId)).toEqual(['tx-1']);

    expect(diff.incomeStreams.created).toHaveLength(0);
    expect(diff.incomeStreams.removed.map((item) => item.providerIncomeId)).toEqual(['income-1']);

    expect(diff.users.created.map((item) => item.providerUserId)).toEqual(['user-2']);
    expect(diff.users.updated).toHaveLength(0);
    expect(diff.users.removed).toHaveLength(0);
  });

  it('returns empty diffs when nothing changed', () => {
    const diff = diffProviderSync(previousResult, { ...previousResult });

    expect(diff.accounts).toEqual({ created: [], updated: [], removed: [] });
    expect(diff.transactions).toEqual({ created: [], updated: [], removed: [] });
    expect(diff.incomeStreams).toEqual({ created: [], updated: [], removed: [] });
    expect(diff.users).toEqual({ created: [], updated: [], removed: [] });
  });

  it('treats undefined previous state as empty collections', () => {
    const next: ProviderSyncResult = {
      accounts: previousResult.accounts,
      transactions: previousResult.transactions,
      incomeStreams: previousResult.incomeStreams,
      users: previousResult.users,
    };

    const diff = diffProviderSync(undefined, next);

    expect(diff.accounts.created).toHaveLength(next.accounts.length);
    expect(diff.accounts.updated).toHaveLength(0);
    expect(diff.accounts.removed).toHaveLength(0);
    expect(diff.incomeStreams.created).toHaveLength(1);
    expect(diff.transactions.created).toHaveLength(1);
    expect(diff.users.created).toHaveLength(1);
  });
});
