import { describe, expect, it } from 'vitest';
import { FinancialAccountRecordSchema } from '../domains/accounts';

describe('Financial account schema', () => {
  it('parses valid payloads', () => {
    const parsed = FinancialAccountRecordSchema.parse({
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
      metadata: { institution: 'Guap Virtual Bank' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(parsed.name).toBe('Checking');
  });

  it('rejects missing money map linkage', () => {
    expect(() =>
      FinancialAccountRecordSchema.parse({
        _id: 'acc-1',
        organizationId: 'org-1',
        name: 'Checking',
        kind: 'checking',
        status: 'active',
        currency: 'USD',
        balance: { cents: 0, currency: 'USD' },
        provider: 'virtual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).toThrow();
  });
});
