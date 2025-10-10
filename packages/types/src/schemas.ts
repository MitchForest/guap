import { z } from 'zod';

export const UserRoleValues = ['kid', 'guardian'] as const;
export const UserRoleSchema = z.enum(UserRoleValues);
export const MembershipRoleValues = ['kid', 'guardian', 'manager'] as const;
export const MembershipRoleSchema = z.enum(MembershipRoleValues);
export const MembershipStatusValues = ['active', 'invited', 'left'] as const;
export const MembershipStatusSchema = z.enum(MembershipStatusValues);

export const AccountKindValues = [
  'checking',
  'hysa',
  'utma',
  'brokerage',
  'credit',
  'donation',
  'liability',
] as const;
export const AccountKindSchema = z.enum(AccountKindValues);

export const AccountStatusValues = ['active', 'inactive', 'pending', 'closed'] as const;
export const AccountStatusSchema = z.enum(AccountStatusValues);

export const IncomeCadenceValues = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
export const IncomeCadenceSchema = z.enum(IncomeCadenceValues);

export const AutomationNodeKindValues = ['income', 'account', 'pod', 'goal', 'liability', 'condition', 'sink'] as const;
export const AutomationNodeKindSchema = z.enum(AutomationNodeKindValues);

export const AutomationEdgeKindValues = ['manual', 'automation'] as const;
export const AutomationEdgeKindSchema = z.enum(AutomationEdgeKindValues);

export const AutomationNodeMetadataSchema = z
  .object({
    podType: z.enum(['goal', 'category', 'envelope', 'custom']).optional(),
    returnRate: z.number().optional(),
    inflow: z
      .object({
        amount: z.number(),
        cadence: IncomeCadenceSchema,
      })
      .optional(),
  })
  .passthrough();

export const RequestKindValues = ['transfer', 'purchase', 'goal-funding', 'automation-change'] as const;
export const RequestKindSchema = z.enum(RequestKindValues);

export const RequestStateValues = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export const RequestStateSchema = z.enum(RequestStateValues);

export const WealthLevelValues = ['0-10k', '10k-100k', '100k-1m', '1m-10m', '10m+'] as const;
export const WealthLevelSchema = z.enum(WealthLevelValues);

export const CurrencyAmountSchema = z.object({
  cents: z.number().int(),
  currency: z.string().default('USD'),
});

export const WorkspaceRecordSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  householdId: z.string(),
  variant: z.enum(['live', 'sandbox']),
  lastSyncedAt: z.number().nullable().optional(),
  lastAppliedAt: z.number().nullable().optional(),
  pendingRequestId: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceNodeKindValues = ['income', 'account', 'pod', 'goal', 'liability'] as const;
export const WorkspaceNodeKindSchema = z.enum(WorkspaceNodeKindValues);

export const WorkspaceNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WorkspaceNodeMetadataSchema = AutomationNodeMetadataSchema;

export const WorkspaceNodeRecordSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  type: WorkspaceNodeKindSchema,
  label: z.string(),
  icon: z.string().optional(),
  accent: z.string().optional(),
  balanceCents: z.number().optional(),
  parentId: z.string().nullable().optional(),
  position: WorkspaceNodePositionSchema,
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceEdgeRecordSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  kind: AutomationEdgeKindSchema.optional(),
  ruleId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceRuleTriggerValues = ['incoming', 'scheduled'] as const;
export const WorkspaceRuleTriggerSchema = z.enum(WorkspaceRuleTriggerValues);

export const WorkspaceRuleScheduleSchema = z
  .object({
    cadence: z.enum(['daily', 'weekly', 'monthly']),
    day: z.number().optional(),
  })
  .optional();

export const WorkspaceRuleRecordSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  sourceNodeId: z.string(),
  triggerType: WorkspaceRuleTriggerSchema,
  triggerNodeId: z.string().optional(),
  schedule: WorkspaceRuleScheduleSchema,
  name: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceRuleAllocationRecordSchema = z.object({
  _id: z.string(),
  ruleId: z.string(),
  order: z.number(),
  percentage: z.number(),
  targetNodeId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceGraphRecordSchema = z.object({
  workspace: WorkspaceRecordSchema,
  nodes: z.array(WorkspaceNodeRecordSchema),
  edges: z.array(WorkspaceEdgeRecordSchema),
  rules: z.array(WorkspaceRuleRecordSchema),
  allocations: z.array(WorkspaceRuleAllocationRecordSchema),
});

export const WorkspacePublishNodeSchema = z.object({
  clientId: z.string(),
  type: WorkspaceNodeKindSchema,
  label: z.string(),
  icon: z.string().optional(),
  accent: z.string().optional(),
  balanceCents: z.number().optional(),
  position: WorkspaceNodePositionSchema,
  parentClientId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const WorkspacePublishEdgeSchema = z.object({
  clientId: z.string(),
  sourceClientId: z.string(),
  targetClientId: z.string(),
  kind: AutomationEdgeKindSchema.optional(),
  ruleClientId: z.string().optional(),
});

export const WorkspacePublishRuleSchema = z.object({
  clientId: z.string(),
  sourceClientId: z.string(),
  trigger: WorkspaceRuleTriggerSchema,
  triggerNodeClientId: z.string().nullable().optional(),
  allocations: z.array(
    z.object({
      targetClientId: z.string(),
      percentage: z.number(),
    })
  ),
});

export const WorkspacePublishPayloadSchema = z.object({
  slug: z.string(),
  nodes: z.array(WorkspacePublishNodeSchema),
  edges: z.array(WorkspacePublishEdgeSchema),
  rules: z.array(WorkspacePublishRuleSchema),
});

export const WorkspacePublishResultSchema = z.object({
  nodes: z.record(z.string(), z.string()),
  edges: z.record(z.string(), z.string()),
  rules: z.record(z.string(), z.string()),
});
