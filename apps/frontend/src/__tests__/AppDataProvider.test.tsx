import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createEffect, createRoot } from 'solid-js';

const mocks = vi.hoisted(() => ({
  mockSync: vi.fn(),
  mockListAccounts: vi.fn(),
  mockListChangeRequests: vi.fn(),
}));

vi.mock('~/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: () => ({
      authId: 'auth-1',
      profileId: 'profile-1',
      displayName: 'Taylor',
      householdId: 'house-1',
    }),
    isAuthenticated: () => true,
    isLoading: () => false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    error: () => null,
  }),
}));

vi.mock('~/shared/services/guapApi', () => ({
  guapApi: {
    accounts: {
      sync: mocks.mockSync,
      list: mocks.mockListAccounts,
    },
    listChangeRequests: mocks.mockListChangeRequests,
  },
}));

import { AppDataProvider, useAppData } from '../app/contexts/AppDataContext';

const TestObserver = (done: () => void) => {
  const { accounts } = useAppData();
  createEffect(() => {
    if (accounts().length > 0) {
      done();
    }
  });
  return null;
};

describe('AppDataProvider', () => {
  beforeEach(() => {
    mocks.mockSync.mockResolvedValue({
      provider: 'virtual',
      createdAccountIds: ['acc-1'],
      updatedAccountIds: [],
      transactions: { created: 3, updated: 0 },
    });
    mocks.mockListAccounts.mockResolvedValue([
      {
        _id: 'acc-1',
        organizationId: 'house-1',
        moneyMapNodeId: 'node-1',
        name: 'Checking',
        kind: 'checking',
        status: 'active',
        currency: 'USD',
        balance: { cents: 12500, currency: 'USD' },
        available: { cents: 12500, currency: 'USD' },
        provider: 'virtual',
        providerAccountId: 'virtual-checking',
        lastSyncedAt: Date.now(),
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    mocks.mockListChangeRequests.mockResolvedValue([]);
  });

  it('hydrates accounts for the active household', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        AppDataProvider({
          get children() {
            return TestObserver(() => {
              resolve();
              dispose();
            });
          },
        } as any);
      });
    });

    expect(mocks.mockSync).toHaveBeenCalledWith({ organizationId: 'house-1' });
    expect(mocks.mockListAccounts).toHaveBeenCalled();
  });
});
