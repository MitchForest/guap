import { describe, expect, it } from 'vitest';
import type { Id } from '@guap/api/codegen/dataModel';
import {
  calculateMonthlyAmount,
  deriveNextScheduledAt,
  evaluateEarnGuardrail,
  buildEarnProjections,
} from '../../domains/earn/services';

const mockDbWithGuardrails = (guardrails: any[]) => ({
  query: () => ({
    withIndex: () => ({
      collect: async () => guardrails,
    }),
  }),
});

const baseStream: any = {
  _id: 'stream-1' as Id<'incomeStreams'>,
  organizationId: 'org-1',
  ownerProfileId: 'profile-1',
  name: 'Weekly Allowance',
  cadence: 'weekly' as const,
  amount: { cents: 2_000, currency: 'USD' },
  defaultDestinationAccountId: null,
  sourceAccountId: null,
  requiresApproval: false,
  autoSchedule: true,
  status: 'active',
  nextScheduledAt: null,
  lastPaidAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  updatedAt: Date.now(),
};

describe('earn services', () => {
  it('calculates monthly amount from cadence', () => {
    expect(calculateMonthlyAmount(100, 'weekly')).toBe(400);
    expect(calculateMonthlyAmount(100, 'yearly')).toBe(8);
    expect(calculateMonthlyAmount(100, 'monthly')).toBe(100);
  });

  it('derives next scheduled date respecting cadence', () => {
    const next = deriveNextScheduledAt(baseStream, { now: Date.UTC(2025, 0, 1) });
    const date = new Date(next);
    expect(date.getUTCDate()).toBeGreaterThan(1);
  });

  it('evaluates earn guardrails with auto approval', async () => {
    const db = mockDbWithGuardrails([
      {
        scope: { type: 'organization' as const },
        approvalPolicy: 'auto',
        autoApproveUpToCents: 5_000,
      },
    ]);

    const result = await evaluateEarnGuardrail(db, {
      organizationId: 'org-1',
      destinationAccountId: null,
      destinationNodeId: null,
      amountCents: 2_000,
      streamRequiresApproval: false,
    });

    expect(result.decision).toBe('execute');
    expect(result.summary.approvalPolicy).toBe('auto');
  });

  it('builds sorted projections for upcoming payouts', () => {
    const now = Date.UTC(2025, 0, 1);
    const projections = buildEarnProjections([
      {
        ...baseStream,
        _id: 'stream-a' as Id<'incomeStreams'>,
        nextScheduledAt: now + 3 * 24 * 60 * 60 * 1000,
      },
      {
        ...baseStream,
        _id: 'stream-b' as Id<'incomeStreams'>,
        name: 'Monthly chore',
        cadence: 'monthly',
        amount: { cents: 4_000, currency: 'USD' },
        nextScheduledAt: now + 10 * 24 * 60 * 60 * 1000,
      },
    ], {
      now,
      perStream: 1,
      limit: 3,
    });

    expect(projections.length).toBe(2);
    expect(projections[0].streamId).toBe('stream-a');
    expect(projections[1].streamId).toBe('stream-b');
  });
});

