type GuardrailSummary = {
  approvalPolicy: 'auto' | 'parent_required' | 'admin_only';
  autoApproveUpToCents: number | null;
  scope: string | null;
};

const summarizeGuardrail = (guardrail: any | null): GuardrailSummary => {
  if (!guardrail) {
    return {
      approvalPolicy: 'parent_required',
      autoApproveUpToCents: null,
      scope: null,
    };
  }

  return {
    approvalPolicy: guardrail.approvalPolicy ?? 'parent_required',
    autoApproveUpToCents:
      typeof guardrail.autoApproveUpToCents === 'number' ? guardrail.autoApproveUpToCents : null,
    scope: guardrail.scope?.type ?? null,
  };
};

export const evaluateGuardrailForSpend = async (
  db: any,
  params: {
    organizationId: string;
    destinationAccountId: string;
    amountCents: number;
  }
) => {
  const [guardrails, destinationAccount] = await Promise.all([
    db
      .query('transferGuardrails')
      .withIndex('by_organization_intent', (q: any) =>
        q.eq('organizationId', params.organizationId).eq('intent', 'spend')
      )
      .collect(),
    db.get(params.destinationAccountId),
  ]);

  const accountGuardrail = guardrails.find(
    (record: any) =>
      record.scope?.type === 'account' && record.scope.accountId === params.destinationAccountId
  );

  const nodeGuardrail =
    destinationAccount && destinationAccount.moneyMapNodeId
      ? guardrails.find(
          (record: any) =>
            record.scope?.type === 'money_map_node' &&
            record.scope.nodeId === destinationAccount.moneyMapNodeId
        )
      : null;

  const organizationGuardrail = guardrails.find(
    (record: any) => record.scope?.type === 'organization'
  );

  const guardrail = accountGuardrail ?? nodeGuardrail ?? organizationGuardrail ?? null;
  const summary = summarizeGuardrail(guardrail);
  const autoLimit =
    summary.autoApproveUpToCents == null ? null : Math.round(summary.autoApproveUpToCents);
  const shouldExecute =
    summary.approvalPolicy === 'auto' && (autoLimit == null || params.amountCents <= autoLimit);

  return {
    guardrailSummary: summary,
    shouldExecute,
  };
};
