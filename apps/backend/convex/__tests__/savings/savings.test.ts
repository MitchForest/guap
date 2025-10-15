import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/session', () => ({
  ensureOrganizationAccess: vi.fn(),
  ensureRole: vi.fn(),
  OWNER_ADMIN_ROLES: ['owner', 'admin'],
}));

vi.mock('../../domains/events/services', () => ({
  logEvent: vi.fn(),
}));

import { createMockDb } from '../helpers/mockDb';
import { createGoalImpl, initiateTransferImpl } from '../../domains/savings/mutations';
import { listGoalsHandler, getGoalHandler, listTransfersForGoalHandler } from '../../domains/savings/queries';
import { ensureOrganizationAccess, ensureRole } from '../../core/session';
import { logEvent } from '../../domains/events/services';

const organizationId = 'org-1';
const mockedEnsureOrganizationAccess = vi.mocked(ensureOrganizationAccess);
const session = { userId: 'user-1', role: 'owner', activeOrganizationId: organizationId };

const amount = (cents: number) => ({ cents, currency: 'USD' as const });

describe('savings domain', () => {
  beforeEach(() => {
    vi.mocked(logEvent).mockClear();
  });

  it('rejects non-goal nodes or cross-organization linkage', async () => {
    const db = createMockDb();
    const timestamp = Date.now();

    const otherMapId = db.insert('moneyMaps', {
      organizationId: 'org-other',
      name: 'Other Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const foreignNodeId = db.insert('moneyMapNodes', {
      mapId: otherMapId,
      key: 'foreign-goal',
      kind: 'goal',
      label: 'Foreign Goal',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const localMapId = db.insert('moneyMaps', {
      organizationId,
      name: 'Household Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const accountNodeId = db.insert('moneyMapNodes', {
      mapId: localMapId,
      key: 'not-goal',
      kind: 'account',
      label: 'Checking Node',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const accountId = db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: accountNodeId,
      name: 'HYSA',
      kind: 'hysa',
      status: 'active',
      currency: 'USD',
      balance: amount(100_00),
      available: amount(100_00),
      provider: 'virtual',
      providerAccountId: 'acct-hysa',
      lastSyncedAt: timestamp,
      metadata: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const ctx = { db } as any;

    await expect(() =>
      createGoalImpl(
        ctx,
        {
          organizationId,
          moneyMapNodeId: foreignNodeId,
          accountId,
          name: 'Invalid Link',
          targetAmount: amount(200_00),
          startingAmount: amount(0),
          targetDate: null,
        },
        session
      )
    ).rejects.toThrow('Money Map does not belong to organization');

    await expect(() =>
      createGoalImpl(
        ctx,
        {
          organizationId,
          moneyMapNodeId: accountNodeId,
          accountId,
          name: 'Wrong Kind',
          targetAmount: amount(200_00),
          startingAmount: amount(0),
          targetDate: null,
        },
        session
      )
    ).rejects.toThrow('Savings goals must be linked to Money Map goal nodes');
  });

  it('creates a goal and seeds a guardrail', async () => {
    const db = createMockDb();
    const timestamp = Date.now();

    const mapId = db.insert('moneyMaps', {
      organizationId,
      name: 'Family Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const nodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'goal-node',
      kind: 'goal',
      label: 'New Bike',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const accountId = db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: nodeId,
      name: 'HYSA',
      kind: 'hysa',
      status: 'active',
      currency: 'USD',
      balance: amount(150_00),
      available: amount(150_00),
      provider: 'virtual',
      providerAccountId: 'acct-hysa',
      lastSyncedAt: timestamp,
      metadata: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const ctx = { db } as any;

    const result = await createGoalImpl(
      ctx,
      {
        organizationId,
        moneyMapNodeId: nodeId,
        accountId,
        name: 'Bike Savings',
        targetAmount: amount(500_00),
        startingAmount: amount(0),
        targetDate: null,
      },
      session
    );

    expect(result?.goal?.name).toBe('Bike Savings');
    expect(db.getTable('savingsGoals')).toHaveLength(1);
    const guardrails = db.getTable('transferGuardrails');
    expect(guardrails).toHaveLength(2);
    const depositGuardrail = guardrails.find(
      (guardrail) => guardrail.direction?.destinationNodeId === nodeId
    );
    const withdrawalGuardrail = guardrails.find(
      (guardrail) => guardrail.direction?.sourceNodeId === nodeId
    );
    expect(depositGuardrail?.approvalPolicy).toBe('auto');
    expect(withdrawalGuardrail?.approvalPolicy).toBe('parent_required');
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'goal_created',
    }));
  });

  it('initiates a transfer that auto-executes under guardrail', async () => {
    const db = createMockDb();
    const timestamp = Date.now();

    const mapId = db.insert('moneyMaps', {
      organizationId,
      name: 'Family Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const goalNodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'goal-node',
      kind: 'goal',
      label: 'College Fund',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const goalAccountId = db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: goalNodeId,
      name: 'HYSA',
      kind: 'hysa',
      status: 'active',
      currency: 'USD',
      balance: amount(500_00),
      available: amount(500_00),
      provider: 'virtual',
      providerAccountId: 'acct-hysa',
      lastSyncedAt: timestamp,
      metadata: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const sourceNodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'checking-node',
      kind: 'account',
      label: 'Checking',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const sourceAccountId = db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: sourceNodeId,
      name: 'Checking',
      kind: 'checking',
      status: 'active',
      currency: 'USD',
      balance: amount(800_00),
      available: amount(800_00),
      provider: 'virtual',
      providerAccountId: 'acct-checking',
      lastSyncedAt: timestamp,
      metadata: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const ctx = { db } as any;

    const createdGoal = await createGoalImpl(
      ctx,
      {
        organizationId,
        moneyMapNodeId: goalNodeId,
        accountId: goalAccountId,
        name: 'College Fund',
        targetAmount: amount(600_00),
        startingAmount: amount(100_00),
        targetDate: null,
      },
      session
    );

    expect(createdGoal).not.toBeNull();

    const response = await initiateTransferImpl(
      ctx,
      {
        organizationId,
        goalId: createdGoal!.goal._id,
        sourceAccountId,
        amount: amount(200_00),
        memo: 'Weekly contribution',
      },
      session
    );

    const transfers = db.getTable('transfers');
    expect(transfers).toHaveLength(1);
    expect(transfers[0].status).toBe('executed');

    expect(response.progress.percentageComplete).toBeGreaterThan(0);
    expect(response.guardrail.approvalPolicy).toBe('auto');
    expect(response.direction).toBe('deposit');
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'transfer_requested',
    }));
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'transfer_executed',
    }));
  });

  it('queues a transfer when guardrail requires approval', async () => {
    const db = createMockDb();
    const timestamp = Date.now();

    const mapId = db.insert('moneyMaps', {
      organizationId,
      name: 'Family Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const goalNodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'goal-node',
      kind: 'goal',
      label: 'Study Abroad',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const goalAccountId = db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: goalNodeId,
      name: 'HYSA',
      kind: 'hysa',
      status: 'active',
      currency: 'USD',
      balance: amount(200_00),
      available: amount(200_00),
      provider: 'virtual',
      providerAccountId: 'acct-hysa',
      lastSyncedAt: timestamp,
      metadata: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const checkingNodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'checking-node',
      kind: 'account',
      label: 'Allowance Checking',
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const sourceAccountId = db.insert('financialAccounts', {
      organizationId,
      moneyMapNodeId: checkingNodeId,
      name: 'Allowance Checking',
      kind: 'checking',
      status: 'active',
      currency: 'USD',
      balance: amount(400_00),
      available: amount(400_00),
      provider: 'virtual',
      providerAccountId: 'acct-checking',
      lastSyncedAt: timestamp,
      metadata: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const ctx = { db } as any;

    const goal = await createGoalImpl(
      ctx,
      {
        organizationId,
        moneyMapNodeId: goalNodeId,
        accountId: goalAccountId,
        name: 'Study Abroad',
        targetAmount: amount(1_200_00),
        startingAmount: amount(100_00),
        targetDate: null,
      },
      session
    );

    const depositGuardrail = db
      .getTable('transferGuardrails')
      .find((guardrail) => guardrail.direction?.destinationNodeId === goalNodeId);

    if (!depositGuardrail) {
      throw new Error('Expected deposit guardrail to exist');
    }

    db.patch(depositGuardrail._id, {
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
    });

    vi.mocked(logEvent).mockClear();

    const result = await initiateTransferImpl(
      ctx,
      {
        organizationId,
        goalId: goal!.goal._id,
        sourceAccountId,
        amount: amount(300_00),
        memo: 'Semester contribution',
      },
      session
    );

    const transfers = db.getTable('transfers');
    expect(transfers).toHaveLength(1);
    expect(transfers[0].status).toBe('pending_approval');
    expect(result.transfer.status).toBe('pending_approval');
    expect(result.guardrail.approvalPolicy).toBe('parent_required');
    expect(result.direction).toBe('deposit');
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKind: 'transfer_requested',
    }));
  });

  describe('query handlers', () => {
    const createContext = () => ({ db: createMockDb() });

    const seedGoal = async (db: ReturnType<typeof createMockDb>) => {
      const timestamp = Date.now();

      const mapId = db.insert('moneyMaps', {
        organizationId,
        name: 'Household Map',
        description: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const goalNodeId = db.insert('moneyMapNodes', {
        mapId,
        key: 'goal-node',
        kind: 'goal',
        label: 'Emergency Fund',
        metadata: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const accountId = db.insert('financialAccounts', {
        organizationId,
        moneyMapNodeId: goalNodeId,
        name: 'Emergency HYSA',
        kind: 'hysa',
        status: 'active',
        currency: 'USD',
        balance: amount(400_00),
        available: amount(400_00),
        provider: 'virtual',
        providerAccountId: 'acct-hysa',
        lastSyncedAt: timestamp,
        metadata: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const ctx = { db } as any;
      const goal = await createGoalImpl(
        ctx,
        {
          organizationId,
          moneyMapNodeId: goalNodeId,
          accountId,
          name: 'Emergency Fund',
          targetAmount: amount(1_000_00),
          startingAmount: amount(200_00),
          targetDate: null,
        },
        session
      );

      return { goal: goal!, accountId, goalNodeId };
    };

    it('returns guardrail summaries and balance-driven progress', async () => {
      mockedEnsureOrganizationAccess.mockResolvedValue({
        activeOrganizationId: organizationId,
        role: 'owner',
        userId: 'user-1',
      });

      const { db } = createContext();
      const { goal, accountId } = await seedGoal(db);

      db.patch(accountId, {
        balance: amount(650_00),
      });

      const results = await listGoalsHandler({ db } as any, {
        organizationId,
      });

      expect(results).toHaveLength(1);
      expect(results[0].progress.currentAmount.cents).toBe(650_00);
      expect(results[0].guardrails.deposit.approvalPolicy).toBe('auto');
      expect(results[0].guardrails.withdrawal.approvalPolicy).toBe('parent_required');

      const record = await getGoalHandler({ db } as any, { goalId: goal.goal._id });
      expect(record?.progress.currentAmount.cents).toBe(650_00);
      expect(record?.guardrails.deposit.approvalPolicy).toBe('auto');
    });

    it('lists transfers filtered by status', async () => {
      mockedEnsureOrganizationAccess.mockResolvedValue({
        activeOrganizationId: organizationId,
        role: 'owner',
        userId: 'user-1',
      });

      const { db } = createContext();
      const { goal } = await seedGoal(db);

      db.insert('transfers', {
        organizationId,
        intent: 'save',
        sourceAccountId: 'acct-checking',
        destinationAccountId: goal.goal.accountId,
        amount: amount(50_00),
        requestedByProfileId: 'user-1',
        approvedByProfileId: null,
        status: 'pending_approval',
        goalId: goal.goal._id,
        orderId: null,
        requestedAt: Date.now(),
        approvedAt: null,
        executedAt: null,
        metadata: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert('transfers', {
        organizationId,
        intent: 'save',
        sourceAccountId: 'acct-checking',
        destinationAccountId: goal.goal.accountId,
        amount: amount(75_00),
        requestedByProfileId: 'user-1',
        approvedByProfileId: 'user-2',
        status: 'executed',
        goalId: goal.goal._id,
        orderId: null,
        requestedAt: Date.now(),
        approvedAt: Date.now(),
        executedAt: Date.now(),
        metadata: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const pending = await listTransfersForGoalHandler({ db } as any, {
        organizationId,
        goalId: goal.goal._id,
        status: 'pending_approval',
      });

      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending_approval');
    });
  });
});
