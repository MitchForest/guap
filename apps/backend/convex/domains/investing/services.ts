import type { CurrencyAmount } from '@guap/types';

type GuardrailRecord = {
  _id: string;
  approvalPolicy: 'auto' | 'parent_required' | 'admin_only';
  maxOrderAmountCents: number | null;
  blockedSymbols?: string[] | null;
  allowedInstrumentKinds?: Array<string> | null;
  requireApprovalForSell?: boolean | null;
  scope?: {
    type: 'organization' | 'money_map_node' | 'account';
    nodeId?: string;
    accountId?: string;
  };
};

type InstrumentGuardrailKind = 'equity' | 'etf' | 'cash';

export type GuardrailSummary = {
  approvalPolicy: 'auto' | 'parent_required' | 'admin_only';
  maxOrderAmountCents: number | null;
  blockedSymbols: string[];
  allowedInstrumentKinds: InstrumentGuardrailKind[];
  requireApprovalForSell: boolean;
  scope: GuardrailRecord['scope'] | null;
};

export type GuardrailEvaluation =
  | {
      decision: 'auto_execute';
      summary: GuardrailSummary;
      guardrailId: string | null;
    }
  | {
      decision: 'needs_parent';
      summary: GuardrailSummary;
      guardrailId: string | null;
      reason?: string;
    }
  | {
      decision: 'needs_admin';
      summary: GuardrailSummary;
      guardrailId: string | null;
      reason?: string;
    }
  | {
      decision: 'blocked';
      summary: GuardrailSummary;
      guardrailId: string | null;
      reason: string;
    };

const DEFAULT_SUMMARY: GuardrailSummary = {
  approvalPolicy: 'parent_required',
  maxOrderAmountCents: null,
  blockedSymbols: [],
  allowedInstrumentKinds: [],
  requireApprovalForSell: false,
  scope: null,
};

const normalizeSummary = (guardrail: GuardrailRecord | null): GuardrailSummary => {
  const normalizeInstrumentKind = (value: unknown): InstrumentGuardrailKind | null => {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'stock') {
      return 'equity';
    }
    if (normalized === 'bond') {
      return 'cash';
    }
    if (normalized === 'equity' || normalized === 'etf' || normalized === 'cash') {
      return normalized as InstrumentGuardrailKind;
    }
    return null;
  };

  if (!guardrail) {
    return DEFAULT_SUMMARY;
  }
  return {
    approvalPolicy: guardrail.approvalPolicy ?? 'parent_required',
    maxOrderAmountCents:
      typeof guardrail.maxOrderAmountCents === 'number' ? Math.round(guardrail.maxOrderAmountCents) : null,
    blockedSymbols: (guardrail.blockedSymbols ?? []).map((symbol) => symbol.toUpperCase()),
    allowedInstrumentKinds: (guardrail.allowedInstrumentKinds ?? [])
      .map((kind) => normalizeInstrumentKind(kind))
      .filter((kind): kind is InstrumentGuardrailKind => kind !== null),
    requireApprovalForSell: Boolean(guardrail.requireApprovalForSell),
    scope: guardrail.scope ?? null,
  };
};

export const summarizeGuardrail = (guardrail: GuardrailRecord | null): GuardrailSummary =>
  normalizeSummary(guardrail);

const preferGuardrail = (guardrails: GuardrailRecord[], predicate: (value: GuardrailRecord) => boolean) =>
  guardrails.find((guardrail) => predicate(guardrail)) ?? null;

export const resolveGuardrailForAccount = (params: {
  guardrails: GuardrailRecord[];
  account: any;
}): GuardrailRecord | null => {
  const { guardrails, account } = params;
  const accountGuardrail = preferGuardrail(
    guardrails,
    (record) => record.scope?.type === 'account' && record.scope?.accountId === account._id
  );
  if (accountGuardrail) {
    return accountGuardrail;
  }
  const nodeGuardrail =
    account.moneyMapNodeId != null
      ? preferGuardrail(
          guardrails,
          (record) => record.scope?.type === 'money_map_node' && record.scope?.nodeId === account.moneyMapNodeId
        )
      : null;
  if (nodeGuardrail) {
    return nodeGuardrail;
  }
  return preferGuardrail(guardrails, (record) => record.scope?.type === 'organization') ?? null;
};

export const evaluateGuardrailForOrder = (params: {
  guardrail: GuardrailRecord | null;
  symbol: string;
  instrumentType: string;
  side: 'buy' | 'sell';
  notionalCents: number;
}): GuardrailEvaluation => {
  const summary = normalizeSummary(params.guardrail);
  const guardrailId = params.guardrail?._id ?? null;
  const upperSymbol = params.symbol.toUpperCase();

  if (summary.blockedSymbols.includes(upperSymbol)) {
    return {
      decision: 'blocked',
      summary,
      guardrailId,
      reason: 'symbol_blocked',
    };
  }

  if (
    summary.allowedInstrumentKinds.length > 0 &&
    !summary.allowedInstrumentKinds.includes(params.instrumentType as InstrumentGuardrailKind)
  ) {
    return {
      decision: 'blocked',
      summary,
      guardrailId,
      reason: 'instrument_not_allowed',
    };
  }

  const approvalPolicy = summary.approvalPolicy ?? 'parent_required';
  const requiresSellApproval = summary.requireApprovalForSell && params.side === 'sell';
  const exceedsMax =
    typeof summary.maxOrderAmountCents === 'number' && summary.maxOrderAmountCents > 0
      ? params.notionalCents > summary.maxOrderAmountCents
      : false;

  if (approvalPolicy === 'admin_only' || requiresSellApproval) {
    return {
      decision: approvalPolicy === 'admin_only' ? 'needs_admin' : 'needs_parent',
      summary,
      guardrailId,
      reason: requiresSellApproval ? 'sell_requires_approval' : 'admin_policy',
    };
  }

  if (approvalPolicy === 'parent_required' || exceedsMax) {
    return {
      decision: 'needs_parent',
      summary,
      guardrailId,
      reason: exceedsMax ? 'exceeds_auto_limit' : 'parent_policy',
    };
  }

  return {
    decision: 'auto_execute',
    summary,
    guardrailId,
  };
};

export const applyFillToPosition = async (
  db: any,
  params: {
    organizationId: string;
    accountId: string;
    symbol: string;
    instrumentType: string;
    side: 'buy' | 'sell';
    quantity: number;
    unitPrice: CurrencyAmount;
  }
) => {
  if (params.quantity <= 0) {
    throw new Error('Quantity must be positive');
  }

  const existing = await db
    .query('investmentPositions')
    .withIndex('by_account_symbol', (q: any) =>
      q.eq('accountId', params.accountId).eq('symbol', params.symbol.toUpperCase())
    )
    .unique();

  const timestamp = Date.now();
  const unitPriceCents = Math.round(params.unitPrice.cents);
  const quantity = params.quantity;
  const notionalCents = Math.round(quantity * unitPriceCents);

  if (params.side === 'sell') {
    if (!existing || existing.quantity < quantity - 1e-6) {
      throw new Error('Insufficient quantity to sell');
    }
    const remainingQuantity = existing.quantity - quantity;
    const updatedFields: Record<string, unknown> = {
      quantity: Number(remainingQuantity.toFixed(6)),
      marketValue: {
        cents: Math.max(0, Math.round(remainingQuantity * unitPriceCents)),
        currency: params.unitPrice.currency,
      },
      lastPrice: params.unitPrice,
      lastPricedAt: timestamp,
      updatedAt: timestamp,
    };

    if (remainingQuantity <= 1e-6) {
      updatedFields.quantity = 0;
      updatedFields.marketValue = { cents: 0, currency: params.unitPrice.currency };
    }

    await db.patch(existing._id, updatedFields);
    return { positionId: existing._id, notionalCents };
  }

  const prevQuantity = existing?.quantity ?? 0;
  const prevCostBasisCents = existing ? Math.round(existing.averageCost.cents * existing.quantity) : 0;
  const combinedQuantity = prevQuantity + quantity;
  const combinedCostCents = prevCostBasisCents + notionalCents;
  const averageCostCents = combinedQuantity > 0 ? Math.round(combinedCostCents / combinedQuantity) : unitPriceCents;

  if (existing) {
    await db.patch(existing._id, {
      quantity: Number(combinedQuantity.toFixed(6)),
      averageCost: { cents: averageCostCents, currency: params.unitPrice.currency },
      marketValue: { cents: Math.round(combinedQuantity * unitPriceCents), currency: params.unitPrice.currency },
      lastPrice: params.unitPrice,
      lastPricedAt: timestamp,
      updatedAt: timestamp,
    });
    return { positionId: existing._id, notionalCents };
  }

  const positionId = await db.insert('investmentPositions', {
    organizationId: params.organizationId,
    accountId: params.accountId,
    symbol: params.symbol.toUpperCase(),
    instrumentType: params.instrumentType,
    quantity: Number(quantity.toFixed(6)),
    averageCost: { cents: averageCostCents, currency: params.unitPrice.currency },
    marketValue: { cents: Math.round(quantity * unitPriceCents), currency: params.unitPrice.currency },
    lastPrice: params.unitPrice,
    lastPricedAt: timestamp,
    metadata: null,
    updatedAt: timestamp,
  });

  return { positionId, notionalCents };
};
