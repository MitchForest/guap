import { z } from 'zod';
import { BetterAuthRoleValues } from './generated/betterAuthRoles';

export const UserRoleValues = BetterAuthRoleValues;
export const UserRoleSchema = z.enum([...UserRoleValues]);

export const MembershipRoleValues = UserRoleValues;
export const MembershipRoleSchema = UserRoleSchema;

export const MembershipStatusValues = ['active', 'invited', 'pending'] as const;
export const MembershipStatusSchema = z.enum(MembershipStatusValues);

export const HouseholdPlanValues = ['free', 'standard'] as const;
export const HouseholdPlanSchema = z.enum(HouseholdPlanValues);

export const HouseholdPlanStatusValues = ['inactive', 'active', 'past_due', 'canceled'] as const;
export const HouseholdPlanStatusSchema = z.enum(HouseholdPlanStatusValues);

export const BillingIntervalValues = ['monthly', 'annual'] as const;
export const BillingIntervalSchema = z.enum(BillingIntervalValues);

export const OrganizationKindValues = ['family', 'institution'] as const;
export const OrganizationKindSchema = z.enum(OrganizationKindValues);

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

export const CurrencyAmountSchema = z.object({
  cents: z.number().int(),
  currency: z.string().default('USD'),
});

export const ProfileRecordSchema = z.object({
  _id: z.string(),
  authId: z.string(),
  role: UserRoleSchema,
  displayName: z.string().optional(),
  email: z.string().optional(),
  householdId: z.string().nullable().optional(),
  guardianProfileId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  membershipId: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const HouseholdRecordSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: HouseholdPlanSchema.default('free'),
  planStatus: HouseholdPlanStatusSchema.default('active'),
  planInterval: BillingIntervalSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MembershipRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  profileId: z.string(),
  role: MembershipRoleSchema,
  status: MembershipStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AccountRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  ownerProfileId: z.string().nullable().optional(),
  name: z.string(),
  kind: AccountKindSchema,
  status: AccountStatusSchema,
  currency: z.string().default('USD'),
  balanceCents: z.number(),
  availableCents: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const IncomeRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  label: z.string(),
  cadence: IncomeCadenceSchema,
  amountCents: z.number(),
  sourceAccountId: z.string().nullable().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const RequestKindValues = ['money_map_change'] as const;
export const RequestKindSchema = z.enum(RequestKindValues);

export const RequestStateValues = ['pending', 'approved', 'rejected'] as const;
export const RequestStateSchema = z.enum(RequestStateValues);

export const RequestRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  createdByProfileId: z.string(),
  assignedToProfileId: z.string().nullable().optional(),
  kind: RequestKindSchema,
  state: RequestStateSchema,
  payload: z.record(z.string(), z.any()).optional(),
  resolvedByProfileId: z.string().nullable().optional(),
  resolvedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceVariantValues = ['live', 'sandbox'] as const;
export const WorkspaceVariantSchema = z.enum(WorkspaceVariantValues);

export const WorkspaceRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  slug: z.string(),
  name: z.string(),
  variant: WorkspaceVariantSchema,
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
  kind: z.enum(['manual', 'automation']).optional(),
  ruleId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const WorkspaceRuleTriggerValues = ['incoming', 'scheduled'] as const;
export const WorkspaceRuleTriggerSchema = z.enum(WorkspaceRuleTriggerValues);

export const WorkspaceRuleRecordSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  sourceNodeId: z.string(),
  triggerType: WorkspaceRuleTriggerSchema,
  triggerNodeId: z.string().optional(),
  schedule: z
    .object({
      cadence: z.enum(['daily', 'weekly', 'monthly']),
      day: z.number().optional(),
    })
    .optional(),
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
  kind: z.enum(['manual', 'automation']).optional(),
  ruleClientId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
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

export const MoneyMapNodeKindValues = ['income', 'account', 'pod', 'goal', 'liability'] as const;
export const MoneyMapNodeKindSchema = z.enum(MoneyMapNodeKindValues);

export const MoneyMapRuleTriggerValues = ['incoming', 'scheduled'] as const;
export const MoneyMapRuleTriggerSchema = z.enum(MoneyMapRuleTriggerValues);

export const MoneyMapChangeStatusValues = ['draft', 'awaiting_admin', 'approved', 'rejected'] as const;
export const MoneyMapChangeStatusSchema = z.enum(MoneyMapChangeStatusValues);

export const MoneyMapRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapNodeMetadataSchema = z.object({
  id: z.string().optional(),
  category: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  podType: z.enum(['goal', 'category', 'envelope', 'custom']).nullable().optional(),
  icon: z.string().nullable().optional(),
  accent: z.string().nullable().optional(),
  balanceCents: z.number().nullable().optional(),
  inflow: z
    .object({
      amount: z.number(),
      cadence: z.enum(['monthly', 'weekly', 'daily']),
    })
    .nullable()
    .optional(),
  position: WorkspaceNodePositionSchema.optional(),
  returnRate: z.number().nullable().optional(),
});

export const MoneyMapNodeRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  key: z.string(),
  kind: MoneyMapNodeKindSchema,
  label: z.string(),
  metadata: MoneyMapNodeMetadataSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapEdgeMetadataSchema = z
  .object({
    id: z.string().optional(),
    ruleId: z.string().nullable().optional(),
    amountCents: z.number().nullable().optional(),
    tag: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .strict();

export const MoneyMapEdgeRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  sourceKey: z.string(),
  targetKey: z.string(),
  metadata: MoneyMapEdgeMetadataSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapRuleConfigSchema = z
  .object({
    ruleId: z.string().optional(),
    sourceNodeId: z.string().optional(),
    triggerNodeId: z.string().nullable().optional(),
    allocations: z
      .array(
        z.object({
          targetNodeId: z.string(),
          percentage: z.number(),
        })
      )
      .optional(),
  })
  .strict();

export const MoneyMapRuleRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  key: z.string(),
  trigger: MoneyMapRuleTriggerSchema,
  config: MoneyMapRuleConfigSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapSaveNodeInputSchema = z.object({
  key: z.string(),
  kind: MoneyMapNodeKindSchema,
  label: z.string(),
  metadata: MoneyMapNodeMetadataSchema.optional(),
});

export const MoneyMapSaveEdgeInputSchema = z.object({
  sourceKey: z.string(),
  targetKey: z.string(),
  metadata: MoneyMapEdgeMetadataSchema.optional(),
});

export const MoneyMapSaveRuleInputSchema = z.object({
  key: z.string(),
  trigger: MoneyMapRuleTriggerSchema,
  config: MoneyMapRuleConfigSchema,
});

export const MoneyMapSaveInputSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(MoneyMapSaveNodeInputSchema),
  edges: z.array(MoneyMapSaveEdgeInputSchema),
  rules: z.array(MoneyMapSaveRuleInputSchema),
});

export const MoneyMapSnapshotSchema = z.object({
  map: MoneyMapRecordSchema,
  nodes: z.array(MoneyMapNodeRecordSchema),
  edges: z.array(MoneyMapEdgeRecordSchema),
  rules: z.array(MoneyMapRuleRecordSchema),
});

export const MoneyMapChangeRequestRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  organizationId: z.string(),
  submitterId: z.string(),
  status: MoneyMapChangeStatusSchema,
  summary: z.string().optional(),
  payload: MoneyMapSaveInputSchema,
  createdAt: z.number(),
  resolvedAt: z.number().optional(),
  updatedAt: z.number(),
});
