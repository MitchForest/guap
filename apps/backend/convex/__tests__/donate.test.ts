import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
  ensureRole: vi.fn(),
  OWNER_ADMIN_ROLES: ['owner', 'admin'],
}));

vi.mock('../domains/events/services', () => ({
  logEvent: vi.fn(),
}));

import { createMockDb } from './helpers/mockDb';
import { scheduleDonationImpl, updateGuardrailImpl } from '../domains/donate/mutations';
import { updateStatusImpl } from '../domains/transfers/mutations';
import {
  listHistoryHandler,
  overviewHandler,
} from '../domains/donate/queries';
import { ensureOrganizationAccess, ensureRole } from '../core/session';
import type { SessionSnapshot } from '../core/session';
import { logEvent } from '../domains/events/services';

const organizationId = 'org-donate';
const session: SessionSnapshot = {
  userId: 'profile-1',
  role: 'owner',
  activeOrganizationId: organizationId,
};
const mockedEnsureOrganizationAccess = vi.mocked(ensureOrganizationAccess);
const mockedEnsureRole = vi.mocked(ensureRole);
const mockedLogEvent = vi.mocked(logEvent);

const amount = (cents: number) => ({ cents, currency: 'USD' as const });

const seedDonationEnvironment = (db: ReturnType<typeof createMockDb>) => {
  const now = Date.now();
  const mapId = db.insert('moneyMaps', {
    organizationId,
    name: 'Household Map',
    description: null,
    createdAt: now,
    updatedAt: now,
  });

  const donationNodeId = db.insert('moneyMapNodes', {
    mapId,
    key: 'donation-node',
    kind: 'account',
    label: 'Giving Account',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const donationAccountId = db.insert('financialAccounts', {
    organizationId,
    moneyMapNodeId: donationNodeId,
    name: 'Virtual Giving',
    kind: 'donation',
    status: 'active',
    currency: 'USD',
    balance: amount(2_000_00),
    available: amount(2_000_00),
    provider: 'virtual',
    providerAccountId: 'acct-donate',
    lastSyncedAt: now,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  });

  const sourceAccountId = db.insert('financialAccounts', {
    organizationId,
    moneyMapNodeId: donationNodeId,
    name: 'Checking',
    kind: 'checking',
    status: 'active',
    currency: 'USD',
    balance: amount(5_000_00),
    available: amount(5_000_00),
    provider: 'virtual',
    providerAccountId: 'acct-checking',
    lastSyncedAt: now,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  });

  const guardrailId = db.insert('transferGuardrails', {
    organizationId,
    scope: { type: 'money_map_node', nodeId: donationNodeId },
    intent: 'donate',
    direction: { sourceNodeId: null, destinationNodeId: donationNodeId },
    approvalPolicy: 'auto',
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

  return { donationAccountId, sourceAccountId, donationNodeId, guardrailId };
};

describe('donate domain', () => {
  beforeEach(() => {
    mockedEnsureOrganizationAccess.mockResolvedValue(session);
    mockedEnsureRole.mockImplementation(() => undefined);
    mockedLogEvent.mockClear();
  });

  it('auto executes donations within guardrail thresholds', async () => {
    const db = createMockDb();
    const { donationAccountId, sourceAccountId } = seedDonationEnvironment(db);
    const ctx = { db };

    const result = await scheduleDonationImpl(
      ctx,
      {
        organizationId,
        causeId: 'coastal-cleanup',
        sourceAccountId,
        destinationAccountId: donationAccountId,
        amount: amount(50_00),
        memo: 'Beach day fundraiser',
        scheduledFor: null,
        recurringCadence: null,
      },
      session
    );

    expect(result.autoExecuted).toBe(true);
    expect(result.transfer.status).toBe('executed');
    expect(result.guardrail.approvalPolicy).toBe('auto');
    expect(mockedLogEvent).toHaveBeenCalledTimes(2);
    expect(result.cause.id).toBe('coastal-cleanup');
  });

  it('keeps donations pending when guardrails require approval', async () => {
    const db = createMockDb();
    const { donationAccountId, sourceAccountId, guardrailId } =
      seedDonationEnvironment(db);
    const now = Date.now();

    db.patch(guardrailId, {
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      updatedAt: now,
    });

    const ctx = { db };
    mockedLogEvent.mockClear();

    const result = await scheduleDonationImpl(
      ctx,
      {
        organizationId,
        causeId: 'stem-toolkit',
        sourceAccountId,
        destinationAccountId: donationAccountId,
        amount: amount(150_00),
        memo: undefined,
        scheduledFor: null,
        recurringCadence: null,
      },
      session
    );

    expect(result.autoExecuted).toBe(false);
    expect(result.transfer.status).toBe('pending_approval');
    expect(mockedLogEvent).toHaveBeenCalledTimes(1);

    mockedLogEvent.mockClear();
    await updateStatusImpl(
      ctx,
      { transferId: result.transfer._id as any, status: 'executed' },
      session
    );

    expect(
      mockedLogEvent.mock.calls.some(([, payload]) => payload.eventKind === 'donation_completed')
    ).toBe(true);
  });

  it('summarizes donation overview with history and upcoming entries', async () => {
    const db = createMockDb();
    const { donationAccountId, sourceAccountId, donationNodeId } = seedDonationEnvironment(db);
    const now = Date.now();

    // Seed monthly budget for donations
    const periodKey = new Date().toISOString().slice(0, 7);
    db.insert('budgets', {
      organizationId,
      moneyMapNodeId: donationNodeId,
      periodKey,
      plannedAmount: amount(200_00),
      rollover: false,
      capAmount: null,
      createdByProfileId: 'system',
      createdAt: now,
      archivedAt: null,
    });

    // Executed donation
    db.insert('transfers', {
      organizationId,
      intent: 'donate',
      sourceAccountId,
      destinationAccountId: donationAccountId,
      amount: amount(80_00),
      requestedByProfileId: 'profile-1',
      approvedByProfileId: 'profile-1',
      status: 'executed',
      goalId: null,
      orderId: null,
      requestedAt: now - 2_000,
      approvedAt: now - 1_800,
      executedAt: now - 1_700,
      metadata: {
        causeId: 'community-pantry',
        causeName: 'Community Pantry Network',
      },
      createdAt: now - 2_200,
      updatedAt: now - 1_700,
    });

    // Pending scheduled donation
    db.insert('transfers', {
      organizationId,
      intent: 'donate',
      sourceAccountId,
      destinationAccountId: donationAccountId,
      amount: amount(60_00),
      requestedByProfileId: 'profile-2',
      approvedByProfileId: null,
      status: 'pending_approval',
      goalId: null,
      orderId: null,
      requestedAt: now,
      approvedAt: null,
      executedAt: null,
      metadata: {
        causeId: 'coastal-cleanup',
        causeName: 'Coastal Cleanup Fund',
        scheduledFor: now + 86_400_000,
      },
      createdAt: now - 100,
      updatedAt: now,
    });

    const ctx = { db };

    const overview = await overviewHandler(ctx, {
      organizationId,
      historyLimit: 10,
    });

    expect(overview.causes.length).toBeGreaterThanOrEqual(3);
    expect(overview.summary.yearToDate.cents).toBeGreaterThan(0);
    expect(overview.history).toHaveLength(2);
    expect(overview.upcoming).toHaveLength(1);
    expect(overview.guardrail).toBeDefined();

    const history = await listHistoryHandler(ctx, {
      organizationId,
      limit: 5,
    });

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].causeName).toBeDefined();
  });
  it('updates donation guardrail thresholds', async () => {
    const db = createMockDb();
    const { donationAccountId, sourceAccountId } = seedDonationEnvironment(db);
    const ctx = { db } as any;

    expect(db.get(donationAccountId as any)).not.toBeNull();

    const summary = await updateGuardrailImpl(
      ctx,
      {
        organizationId,
        accountId: donationAccountId,
        approvalPolicy: 'auto',
        autoApproveUpToCents: 12_500,
      },
      session
    );

    expect(summary.approvalPolicy).toBe('auto');
    expect(summary.autoApproveUpToCents).toBe(12_500);

    const result = await scheduleDonationImpl(
      ctx,
      {
        organizationId,
        causeId: 'coastal-cleanup',
        sourceAccountId,
        destinationAccountId: donationAccountId,
        amount: amount(12_00),
        memo: undefined,
        scheduledFor: null,
        recurringCadence: null,
      },
      session
    );

    expect(result.autoExecuted).toBe(true);
  });
});
