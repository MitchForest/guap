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

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts?.[0]?.providerAccountId).toBe('virtual-checking');
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions?.[0]?.metadata?.merchantName).toBe('Corner Market');
  });
});
