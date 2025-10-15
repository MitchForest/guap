import { describe, expect, it } from 'vitest';
import type { SavingsGuardrailSummary } from '@guap/api';
import { describeGuardrail } from '../features/save/utils/guardrails';
import { formatCurrency } from '~/shared/utils/format';

describe('TransferModal guardrail messaging', () => {
  const guardrail = (overrides: Partial<SavingsGuardrailSummary>): SavingsGuardrailSummary => ({
    approvalPolicy: 'parent_required',
    autoApproveUpToCents: null,
    scope: null,
    ...overrides,
  });

  it('describes auto approval with limits', () => {
    const summary = guardrail({ approvalPolicy: 'auto', autoApproveUpToCents: 25_00 });
    const message = describeGuardrail(summary, 'deposit');
    expect(message).toContain('Deposits auto-approve');
    expect(message).toContain(formatCurrency(25_00));
  });

  it('notes parent review when required', () => {
    const summary = guardrail({ approvalPolicy: 'parent_required' });
    const message = describeGuardrail(summary, 'withdrawal');
    expect(message).toContain('Withdrawals require parent approval');
  });

  it('calls out admin guardrails', () => {
    const summary = guardrail({ approvalPolicy: 'admin_only' });
    const message = describeGuardrail(summary, 'deposit');
    expect(message.toLowerCase()).toContain('admin');
  });
});
