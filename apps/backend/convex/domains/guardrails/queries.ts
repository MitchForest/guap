import { z } from 'zod';
import { TransferIntentValues } from '@guap/types';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const ListGuardrailsArgs = {
  organizationId: z.string(),
} as const;

const INTENT_VALUES: readonly string[] = TransferIntentValues;

const resolveScopeLabel = (scope: any, context: { account?: any; node?: any }) => {
  if (!scope || scope.type === 'organization') {
    return 'Organization';
  }
  if (scope.type === 'account') {
    return context.account?.name ?? 'Account';
  }
  if (scope.type === 'money_map_node') {
    return context.node?.label ?? 'Money Map node';
  }
  return 'Unknown scope';
};

export const listGuardrailsHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListGuardrailsArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);

  const guardrails: any[] = [];
  for (const intent of INTENT_VALUES) {
    const rows = await ctx.db
      .query('transferGuardrails')
      .withIndex('by_organization_intent', (q: any) =>
        q.eq('organizationId', args.organizationId).eq('intent', intent)
      )
      .collect();
    guardrails.push(...rows);
  }

  const results = [];
  for (const guardrail of guardrails) {
    let account: any = null;
    let node: any = null;

    if (guardrail.scope?.type === 'account' && guardrail.scope.accountId) {
      account = await ctx.db.get(guardrail.scope.accountId);
    }

    if (guardrail.scope?.type === 'money_map_node' && guardrail.scope.nodeId) {
      node = await ctx.db.get(guardrail.scope.nodeId);
    }

    const approvalPolicy = guardrail.approvalPolicy ?? 'parent_required';
    const autoApproveUpToCents =
      typeof guardrail.autoApproveUpToCents === 'number'
        ? guardrail.autoApproveUpToCents
        : null;
    const maxOrderAmountCents =
      typeof guardrail.maxOrderAmountCents === 'number'
        ? guardrail.maxOrderAmountCents
        : null;

    results.push({
      id: guardrail._id,
      intent: guardrail.intent,
      approvalPolicy,
      autoApproveUpToCents,
      direction: guardrail.direction ?? null,
      maxOrderAmountCents,
      requireApprovalForSell:
        typeof guardrail.requireApprovalForSell === 'boolean'
          ? guardrail.requireApprovalForSell
          : null,
      allowedInstrumentKinds: guardrail.allowedInstrumentKinds ?? null,
      blockedSymbols: guardrail.blockedSymbols ?? null,
      createdAt: guardrail.createdAt,
      updatedAt: guardrail.updatedAt,
      scope: {
        type: guardrail.scope?.type ?? 'organization',
        label: resolveScopeLabel(guardrail.scope, { account, node }),
        accountId: guardrail.scope?.type === 'account' ? guardrail.scope.accountId : null,
        accountKind: account?.kind ?? null,
        nodeId: guardrail.scope?.type === 'money_map_node' ? guardrail.scope.nodeId : null,
        nodeLabel: node?.label ?? null,
        nodeKind: node?.kind ?? null,
      },
    });
  }

  results.sort((a, b) => b.updatedAt - a.updatedAt);
  return results;
};

export const listForOrganization = defineQuery({
  args: ListGuardrailsArgs,
  handler: listGuardrailsHandler,
});
