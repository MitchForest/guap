import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
}));

import { createMockDb } from './helpers/mockDb';
import { listGuardrailsHandler } from '../domains/guardrails/queries';
import { ensureOrganizationAccess } from '../core/session';

const mockedEnsureOrganizationAccess = vi.mocked(ensureOrganizationAccess);

const amount = (cents: number) => ({ cents, currency: 'USD' as const });

describe('guardrails query', () => {
  beforeEach(() => {
    mockedEnsureOrganizationAccess.mockResolvedValue({
      activeOrganizationId: 'org-1',
      role: 'owner',
      userId: 'profile-1',
    });
  });

  it('returns guardrails with scope labels and limits', async () => {
    const db = createMockDb();
    const now = Date.now();

    const mapId = db.insert('moneyMaps', {
      organizationId: 'org-1',
      name: 'Map',
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    const nodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'save-node',
      kind: 'goal',
      label: 'Emergency Fund',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    const accountId = db.insert('financialAccounts', {
      organizationId: 'org-1',
      moneyMapNodeId: nodeId,
      name: 'Checking',
      kind: 'checking',
      status: 'active',
      currency: 'USD',
      balance: amount(5_000_00),
      available: amount(5_000_00),
      provider: 'virtual',
      providerAccountId: 'acct-1',
      lastSyncedAt: now,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    });

    db.insert('transferGuardrails', {
      organizationId: 'org-1',
      scope: { type: 'organization' },
      intent: 'donate',
      direction: { sourceNodeId: null, destinationNodeId: null },
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: 'system',
      createdAt: now,
      updatedAt: now,
    });

    db.insert('transferGuardrails', {
      organizationId: 'org-1',
      scope: { type: 'money_map_node', nodeId },
      intent: 'save',
      direction: { sourceNodeId: null, destinationNodeId: nodeId },
      approvalPolicy: 'auto',
      autoApproveUpToCents: 50_00,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: 'system',
      createdAt: now,
      updatedAt: now,
    });

    db.insert('transferGuardrails', {
      organizationId: 'org-1',
      scope: { type: 'account', accountId },
      intent: 'invest',
      direction: { sourceNodeId: nodeId, destinationNodeId: null },
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: ['etf', 'equity'],
      blockedSymbols: ['GME'],
      maxOrderAmountCents: 2_500_00,
      requireApprovalForSell: true,
      allowedRolesToInitiate: ['owner', 'admin'],
      createdByProfileId: 'system',
      createdAt: now,
      updatedAt: now,
    });

    const result = await listGuardrailsHandler({ db }, { organizationId: 'org-1' });
    expect(result).toHaveLength(3);

    const investGuardrail = result.find((entry: any) => entry.intent === 'invest');
    expect(investGuardrail?.scope.label).toBe('Checking');
    expect(investGuardrail?.maxOrderAmountCents).toBe(2_500_00);
    expect(investGuardrail?.allowedInstrumentKinds).toEqual(['etf', 'equity']);

    const saveGuardrail = result.find((entry: any) => entry.intent === 'save');
    expect(saveGuardrail?.scope.label).toBe('Emergency Fund');
    expect(saveGuardrail?.autoApproveUpToCents).toBe(50_00);
  });
});

