import { z } from 'zod';
import { GuardrailApprovalPolicySchema } from '../savings/schema';

export const GuardrailOverviewScopeSchema = z.object({
  type: z.enum(['organization', 'money_map_node', 'account']),
  label: z.string(),
  accountId: z.string().nullable(),
  accountKind: z.string().nullable(),
  nodeId: z.string().nullable(),
  nodeLabel: z.string().nullable(),
  nodeKind: z.string().nullable(),
});

export const GuardrailOverviewSchema = z.object({
  id: z.string(),
  intent: z.string(),
  approvalPolicy: GuardrailApprovalPolicySchema,
  autoApproveUpToCents: z.number().nullable(),
  maxOrderAmountCents: z.number().nullable(),
  requireApprovalForSell: z.boolean().nullable(),
  allowedInstrumentKinds: z.array(z.string()).nullable(),
  blockedSymbols: z.array(z.string()).nullable(),
  direction: z
    .object({
      sourceNodeId: z.string().nullable(),
      destinationNodeId: z.string().nullable(),
    })
    .nullable(),
  scope: GuardrailOverviewScopeSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type GuardrailOverview = z.infer<typeof GuardrailOverviewSchema>;
