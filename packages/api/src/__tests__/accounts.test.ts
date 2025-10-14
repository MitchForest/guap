import { describe, expect, it, vi } from 'vitest';
import { AccountsApi } from '../domains/accounts/client';

const makeClient = (overrides: Partial<{ query: any; mutation: any }> = {}) => {
  return {
    query: vi.fn(),
    mutation: vi.fn(),
    ...overrides,
  } as any;
};

describe('AccountsApi', () => {
  const baseAccount = {
    _id: 'acc-1',
    organizationId: 'org-1',
    moneyMapNodeId: 'node-1',
    name: 'Checking',
    kind: 'checking',
    status: 'active',
    currency: 'USD',
    balance: { cents: 12300, currency: 'USD' },
    available: { cents: 12000, currency: 'USD' },
    provider: 'virtual',
    providerAccountId: 'virtual-checking',
    lastSyncedAt: Date.now(),
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('parses list responses', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValue([baseAccount]),
    });
    const api = new AccountsApi(client);
    const accounts = await api.list('org-1');
    expect(accounts).toHaveLength(1);
    expect(client.query).toHaveBeenCalledWith('domains/accounts/queries:listForOrganization', {
      organizationId: 'org-1',
    });
  });

  it('throws when response shape is invalid', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValue([{ ...baseAccount, moneyMapNodeId: undefined }]),
    });
    const api = new AccountsApi(client);
    await expect(api.list('org-1')).rejects.toThrow();
  });

  it('validates sync payloads', async () => {
    const client = makeClient({
      mutation: vi.fn().mockResolvedValue({
        provider: 'virtual',
        createdAccountIds: ['acc-1'],
        updatedAccountIds: [],
        transactions: { created: 3, updated: 0 },
      }),
    });
    const api = new AccountsApi(client);
    const result = await api.sync({ organizationId: 'org-1' });
    expect(result.createdAccountIds).toEqual(['acc-1']);
    expect(client.mutation).toHaveBeenCalledWith('domains/accounts/mutations:syncAccounts', {
      organizationId: 'org-1',
    });
  });
});
