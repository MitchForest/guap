import { describe, expect, it } from 'vitest';
import {
  calculateBudgetActuals,
  resolvePeriodRange,
  summarizeBudgets,
  updateBudgetGuardrail,
} from '../../domains/budgets/services';
import { createMockDb } from '../helpers/mockDb';

const currency = (cents: number) => ({ cents, currency: 'USD' });

describe('budgets services', () => {
  it('resolves period range boundaries', () => {
    const range = resolvePeriodRange('2025-03');
    const start = new Date(Date.UTC(2025, 2, 1)).getTime();
    const end = new Date(Date.UTC(2025, 3, 1)).getTime();
    expect(range).toEqual({ start, end });
  });

  it('calculates actuals and percent used with guardrail event check', async () => {
    const budget = {
      _id: 'budget-1',
      organizationId: 'org-1',
      moneyMapNodeId: 'node-1',
      periodKey: '2025-03',
      plannedAmount: currency(100_00),
      rollover: false,
      capAmount: null,
      createdByProfileId: 'user-1',
      createdAt: Date.now(),
      archivedAt: null,
    };

    const node = {
      _id: 'node-1',
      metadata: {
        category: 'groceries',
      },
    };

    const transactions = [
      {
        organizationId: 'org-1',
        moneyMapNodeId: 'node-1',
        categoryKey: 'groceries',
        direction: 'debit',
        amount: currency(30_00),
        occurredAt: new Date(Date.UTC(2025, 2, 5)).getTime(),
      },
      {
        organizationId: 'org-1',
        moneyMapNodeId: 'node-1',
        categoryKey: 'groceries',
        direction: 'debit',
        amount: currency(50_00),
        occurredAt: new Date(Date.UTC(2025, 2, 10)).getTime(),
      },
    ];

    const queryChain = (results: unknown[], allowOrder = true) => {
      const chain: any = {
        withIndex: () => chain,
        collect: async () => results,
      };
      if (allowOrder) {
        chain.order = () => chain;
      }
      return chain;
    };

    const db = {
      query: (table: string) => {
        if (table === 'transactions') {
          return queryChain(transactions, true);
        }
        if (table === 'eventsJournal') {
          return queryChain([], false);
        }
        if (table === 'transferGuardrails') {
          return queryChain([], false);
        }
        throw new Error(`Unexpected table query: ${table}`);
      },
    };

    const actuals = await calculateBudgetActuals(db, budget, { node });
    expect(actuals.spentAmount).toEqual(currency(80_00));
    expect(actuals.remainingAmount).toEqual(currency(20_00));
    expect(actuals.percentageUsed).toBeCloseTo(0.8);
    expect(actuals.transactionsCount).toBe(2);
    expect(actuals.overspent).toBe(false);
  });

  it('summarizes multiple budgets', () => {
    const summary = summarizeBudgets([
      {
        budget: {
          _id: 'budget-1',
          organizationId: 'org-1',
          moneyMapNodeId: 'node-1',
          periodKey: '2025-03',
          plannedAmount: currency(100_00),
          rollover: false,
          capAmount: null,
          createdByProfileId: 'user-1',
          createdAt: Date.now(),
          archivedAt: null,
        },
        actuals: {
          spentAmount: currency(60_00),
          remainingAmount: currency(40_00),
          percentageUsed: 0.6,
          transactionsCount: 3,
          overspent: false,
          lastTransactionAt: null,
        },
        guardrail: null,
      },
      {
        budget: {
          _id: 'budget-2',
          organizationId: 'org-1',
          moneyMapNodeId: 'node-2',
          periodKey: '2025-03',
          plannedAmount: currency(50_00),
          rollover: false,
          capAmount: null,
          createdByProfileId: 'user-1',
          createdAt: Date.now(),
          archivedAt: null,
        },
        actuals: {
          spentAmount: currency(55_00),
          remainingAmount: currency(0),
          percentageUsed: 1.1,
          transactionsCount: 2,
          overspent: true,
          lastTransactionAt: null,
        },
        guardrail: null,
      },
    ]);

    expect(summary.totalPlanned.cents).toBe(150_00);
    expect(summary.totalSpent.cents).toBe(115_00);
    expect(summary.totalRemaining.cents).toBe(35_00);
    expect(summary.overspentBudgets).toBe(1);
    expect(summary.periodKey).toBe('2025-03');
  });

  it('updates guardrail policy based on auto-approve limit', async () => {
    const db = createMockDb();
    const timestamp = Date.now();
    const mapId = db.insert('moneyMaps', {
      organizationId: 'org-autop',
      name: 'Map',
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const nodeId = db.insert('moneyMapNodes', {
      mapId,
      key: 'spend-node',
      kind: 'pod',
      label: 'Dining',
      metadata: { category: 'dining' },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    db.insert('budgets', {
      organizationId: 'org-autop',
      moneyMapNodeId: nodeId as any,
      periodKey: '2025-03',
      plannedAmount: currency(1_000_00),
      rollover: false,
      capAmount: null,
      createdByProfileId: 'user-1',
      createdAt: timestamp,
      archivedAt: null,
    });
    db.insert('transferGuardrails', {
      organizationId: 'org-autop',
      scope: { type: 'money_map_node', nodeId: nodeId as any },
      intent: 'spend',
      direction: { sourceNodeId: nodeId as any, destinationNodeId: null },
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      dailyLimitCents: null,
      weeklyLimitCents: null,
      allowedInstrumentKinds: null,
      blockedSymbols: [],
      maxOrderAmountCents: null,
      requireApprovalForSell: null,
      allowedRolesToInitiate: ['owner', 'admin', 'member'],
      createdByProfileId: 'user-1',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await updateBudgetGuardrail(db, {
      organizationId: 'org-autop',
      moneyMapNodeId: nodeId as any,
      autoApproveUpToCents: 25_00,
    });

    const guardrailRecord = db.getTable('transferGuardrails')[0];
    expect(guardrailRecord.approvalPolicy).toBe('auto');
    expect(guardrailRecord.autoApproveUpToCents).toBe(25_00);

    await updateBudgetGuardrail(db, {
      organizationId: 'org-autop',
      moneyMapNodeId: nodeId as any,
      autoApproveUpToCents: null,
    });

    const updatedGuardrail = db.getTable('transferGuardrails')[0];
    expect(updatedGuardrail.approvalPolicy).toBe('parent_required');
    expect(updatedGuardrail.autoApproveUpToCents).toBeNull();
  });
});
