type GuardrailSummary = {
  approvalPolicy: 'auto' | 'parent_required' | 'admin_only';
  autoApproveUpToCents: number | null;
};

export type GuardrailReasonCode =
  | 'parent_required'
  | 'admin_required'
  | 'above_auto_limit'
  | 'manual_review';

export type GuardrailReason = {
  code: GuardrailReasonCode;
  limitCents: number | null;
};

export const deriveGuardrailReason = (
  summary: GuardrailSummary | null | undefined,
  amountCents: number | null | undefined
): GuardrailReason | null => {
  if (!summary) {
    return null;
  }

  const policy = summary.approvalPolicy ?? 'parent_required';
  const limit =
    typeof summary.autoApproveUpToCents === 'number'
      ? Math.max(0, Math.round(summary.autoApproveUpToCents))
      : null;
  const amount = typeof amountCents === 'number' ? Math.max(0, Math.round(amountCents)) : null;

  if (policy === 'admin_only') {
    return {
      code: 'admin_required',
      limitCents: limit,
    };
  }

  if (policy === 'parent_required') {
    return {
      code: 'parent_required',
      limitCents: limit,
    };
  }

  if (policy === 'auto') {
    if (limit != null && amount != null && amount > limit) {
      return {
        code: 'above_auto_limit',
        limitCents: limit,
      };
    }
    return {
      code: 'manual_review',
      limitCents: limit,
    };
  }

  return {
    code: 'manual_review',
    limitCents: limit,
  };
};

