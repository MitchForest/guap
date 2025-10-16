import { formatCurrency } from './format';

export type GuardrailMetadata = {
  approvalPolicy?: 'auto' | 'parent_required' | 'admin_only' | string | null;
  autoApproveUpToCents?: number | null;
  reasonCode?: string | null;
  reasonLimitCents?: number | null;
};

export const guardrailReasonLabel = (metadata: GuardrailMetadata | null | undefined) => {
  if (!metadata) {
    return null;
  }

  const code = metadata.reasonCode ?? null;
  const limit = metadata.reasonLimitCents ?? null;

  switch (code) {
    case 'admin_required':
      return 'Admin approval required';
    case 'parent_required':
      return 'Parent approval required';
    case 'above_auto_limit':
      return limit != null ? `Above auto limit of ${formatCurrency(limit)}` : 'Above auto limit';
    case 'manual_review':
      return 'Awaiting manual review';
    default: {
      if (metadata.approvalPolicy === 'admin_only') {
        return 'Admin approval required';
      }
      if (metadata.approvalPolicy === 'parent_required') {
        return 'Parent approval required';
      }
      if (
        metadata.approvalPolicy === 'auto' &&
        metadata.autoApproveUpToCents != null
      ) {
        return `Above auto limit of ${formatCurrency(metadata.autoApproveUpToCents)}`;
      }
      return null;
    }
  }
};

