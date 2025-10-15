import type { SavingsGuardrailSummary } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';

export const describeGuardrail = (
  guardrail: SavingsGuardrailSummary,
  direction: 'deposit' | 'withdrawal'
) => {
  const label = direction === 'deposit' ? 'Deposits' : 'Withdrawals';
  if (guardrail.approvalPolicy === 'auto') {
    if (guardrail.autoApproveUpToCents != null) {
      return `${label} auto-approve up to ${formatCurrency(
        guardrail.autoApproveUpToCents
      )}; larger amounts require review.`;
    }
    return `${label} auto-approve immediately.`;
  }
  if (guardrail.approvalPolicy === 'admin_only') {
    return `${label} require an admin to approve.`;
  }
  return `${label} require parent approval before funds move.`;
};
