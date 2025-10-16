import { describe, expect, it } from 'vitest';
import { guardrailReasonLabel } from './guardrails';

describe('guardrailReasonLabel', () => {
  it('returns null when metadata missing', () => {
    expect(guardrailReasonLabel(null)).toBeNull();
    expect(guardrailReasonLabel(undefined)).toBeNull();
  });

  it('maps known reason codes', () => {
    expect(
      guardrailReasonLabel({
        reasonCode: 'parent_required',
      })
    ).toBe('Parent approval required');

    expect(
      guardrailReasonLabel({
        reasonCode: 'admin_required',
      })
    ).toBe('Admin approval required');
  });

  it('formats auto limit descriptions', () => {
    expect(
      guardrailReasonLabel({
        reasonCode: 'above_auto_limit',
        reasonLimitCents: 5000,
      })
    ).toContain('$50.00');
  });

  it('falls back to approval policy when reason absent', () => {
    expect(
      guardrailReasonLabel({
        approvalPolicy: 'parent_required',
      })
    ).toBe('Parent approval required');

    expect(
      guardrailReasonLabel({
        approvalPolicy: 'auto',
        autoApproveUpToCents: 1000,
      })
    ).toBe('Above auto limit of $10.00');
  });
});

