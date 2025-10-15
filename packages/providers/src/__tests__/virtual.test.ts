import { describe, expect, it } from 'vitest';
import { virtualProvider } from '../virtual';

describe('virtual provider', () => {
  it('returns deterministic accounts and transactions', async () => {
    const result = await virtualProvider.sync({
      householdId: 'house-1',
      organizationId: 'org-1',
      profileId: 'user-1',
      providerConfig: undefined,
      forceRefresh: false,
    });

    expect(result.accounts).toHaveLength(4);
    expect(result.accounts?.[0]?.providerAccountId).toBe('virtual-checking');
    expect(result.accounts?.some((account) => account.providerAccountId === 'virtual-credit')).toBe(true);
    expect(result.transactions).toHaveLength(4);
    expect(result.transactions?.[0]?.metadata?.merchantName).toBe('Corner Market');
    expect(result.positions).toBeTruthy();
    expect(result.positions?.some((position) => position.symbol === 'VTI')).toBe(true);
    expect(result.quotes?.some((quote) => quote.symbol === 'AAPL')).toBe(true);
  });

  it('provides quotes for requested symbols', async () => {
    const quotes = await virtualProvider.getQuotes(['VTI', 'AAPL']);
    expect(quotes).toHaveLength(2);
    const vti = quotes.find((quote) => quote.symbol === 'VTI');
    expect(vti?.price.cents).toBeGreaterThan(0);
  });

  it('simulates investment order execution', async () => {
    const fill = await virtualProvider.executeInvestmentOrder({
      organizationId: 'org-1',
      accountId: 'virtual-utma',
      symbol: 'VTI',
      instrumentType: 'etf',
      side: 'buy',
      quantity: 1.5,
    });

    expect(fill.symbol).toBe('VTI');
    expect(fill.price.cents).toBeGreaterThan(0);
    expect(fill.quantity).toBeCloseTo(1.5);
  });
});
