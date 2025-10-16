import { describe, expect, it } from 'vitest';
import type { DonationGuardrailSummary } from '@guap/api';
import { guardrailDescription } from '../features/donate/components/DonateHero';
import { formatCurrency } from '~/shared/utils/format';

const guardrail = (
  overrides: Partial<DonationGuardrailSummary>
): DonationGuardrailSummary => ({
  approvalPolicy: 'parent_required',
  autoApproveUpToCents: null,
  scope: null,
  ...overrides,
});

describe('guardrailDescription', () => {
  it('describes unrestricted auto approval', () => {
    const summary = guardrail({ approvalPolicy: 'auto' });
    expect(guardrailDescription(summary)).toContain('Auto-approves donation submissions');
  });

  it('notes auto approval thresholds when provided', () => {
    const summary = guardrail({ approvalPolicy: 'auto', autoApproveUpToCents: 45_00 });
    const description = guardrailDescription(summary);
    expect(description).toContain(formatCurrency(45_00));
  });

  it('calls out admin review policies', () => {
    const summary = guardrail({ approvalPolicy: 'admin_only' });
    expect(guardrailDescription(summary).toLowerCase()).toContain('admin');
  });
});
