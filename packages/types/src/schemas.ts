import { z } from 'zod';

export const UserRoleValues = ['student', 'guardian', 'admin', 'internal'] as const;
export const UserRoleSchema = z.enum(UserRoleValues);

export const MembershipRoleValues = ['owner', 'admin', 'member', 'guardian', 'student', 'internal'] as const;
export const MembershipRoleSchema = z.enum(MembershipRoleValues);

export const MembershipStatusValues = ['active', 'invited', 'pending', 'suspended', 'left'] as const;
export const MembershipStatusSchema = z.enum(MembershipStatusValues);

export const HouseholdPlanValues = ['free', 'household', 'organization'] as const;
export const HouseholdPlanSchema = z.enum(HouseholdPlanValues);

export const HouseholdPlanStatusValues = ['inactive', 'active', 'past_due', 'canceled'] as const;
export const HouseholdPlanStatusSchema = z.enum(HouseholdPlanStatusValues);

export const BillingIntervalValues = ['monthly', 'annual'] as const;
export const BillingIntervalSchema = z.enum(BillingIntervalValues);

export const OrganizationKindValues = ['family', 'institution', 'internal'] as const;
export const OrganizationKindSchema = z.enum(OrganizationKindValues);

export const OrganizationStatusValues = ['draft', 'active', 'suspended', 'archived'] as const;
export const OrganizationStatusSchema = z.enum(OrganizationStatusValues);

export const OrganizationBillingPlanValues = ['solo', 'family', 'standard', 'high_volume'] as const;
export const OrganizationBillingPlanSchema = z.enum(OrganizationBillingPlanValues);

export const OrganizationBillingIntervalValues = ['monthly', 'annual'] as const;
export const OrganizationBillingIntervalSchema = z.enum(OrganizationBillingIntervalValues);

export const OrganizationPricingTierSchema = z.object({
  minSeats: z.number().int().nonnegative(),
  maxSeats: z.number().int().nonnegative().nullable(),
  monthlyCentsPerSeat: z.number().int().nonnegative(),
  annualCentsPerSeat: z.number().int().nonnegative(),
});

export const OrganizationPricingSchema = z.object({
  baseMonthlyCents: z.number().int().nonnegative().optional(),
  baseAnnualCents: z.number().int().nonnegative().optional(),
  includedSeats: z.number().int().nonnegative().optional(),
  tiers: z.array(OrganizationPricingTierSchema).optional(),
});

export const HouseholdPlanRecordSchema = z.object({
  plan: HouseholdPlanSchema,
  status: HouseholdPlanStatusSchema,
  interval: BillingIntervalSchema.optional(),
  seats: z.number().int().nonnegative().optional(),
  subscriptionId: z.string().optional(),
  customerId: z.string().optional(),
  linkedOrganizationId: z.string().optional(),
  updatedAt: z.number().optional(),
});

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

export const OrganizationRecordSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().optional(),
  shortCode: z.string(),
  joinCode: z.string(),
  kind: OrganizationKindSchema,
  type: z.string().optional(),
  status: OrganizationStatusSchema,
  createdByUserId: z.string(),
  primaryHouseholdId: z.string().optional(),
  billingPlan: OrganizationBillingPlanSchema,
  billingInterval: OrganizationBillingIntervalSchema,
  pricing: OrganizationPricingSchema.optional(),
  billingProvider: z
    .object({
      provider: z.enum(['stripe']).optional(),
      customerId: z.string().optional(),
      subscriptionId: z.string().optional(),
      status: z.enum(['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused']).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const OrganizationMembershipRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: MembershipRoleSchema,
  status: MembershipStatusSchema,
  invitedByUserId: z.string().optional(),
  invitationId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const InviteKindValues = ['household', 'organization'] as const;
export const InviteKindSchema = z.enum(InviteKindValues);

export const InviteStateValues = ['pending', 'accepted', 'rejected', 'canceled'] as const;
export const InviteStateSchema = z.enum(InviteStateValues);

export const MembershipInviteRecordSchema = z.object({
  _id: z.string(),
  targetKind: InviteKindSchema,
  organizationId: z.string().optional(),
  householdId: z.string().optional(),
  email: z.string(),
  role: MembershipRoleSchema,
  code: z.string(),
  token: z.string(),
  state: InviteStateSchema,
  invitedByUserId: z.string(),
  invitedAt: z.number(),
  expiresAt: z.number().optional(),
  acceptedByUserId: z.string().optional(),
  acceptedAt: z.number().optional(),
  rejectedByUserId: z.string().optional(),
  rejectedAt: z.number().optional(),
  canceledByUserId: z.string().optional(),
  canceledAt: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
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

export const MoneyMapNodeKindValues = ['account', 'income', 'expense', 'goal', 'holding'] as const;
export const MoneyMapNodeKindSchema = z.enum(MoneyMapNodeKindValues);

export const MoneyMapRuleTriggerValues = ['manual', 'schedule', 'threshold'] as const;
export const MoneyMapRuleTriggerSchema = z.enum(MoneyMapRuleTriggerValues);

export const MoneyMapChangeStatusValues = ['draft', 'awaiting_guardian', 'approved', 'rejected'] as const;
export const MoneyMapChangeStatusSchema = z.enum(MoneyMapChangeStatusValues);

export const MoneyMapRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapNodeRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  key: z.string(),
  kind: MoneyMapNodeKindSchema,
  label: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapEdgeRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  sourceKey: z.string(),
  targetKey: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MoneyMapRuleRecordSchema = z.object({
  _id: z.string(),
  mapId: z.string(),
  key: z.string(),
  trigger: MoneyMapRuleTriggerSchema,
  config: z.record(z.string(), z.any()),
  createdAt: z.number(),
  updatedAt: z.number(),
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
  payload: z.record(z.string(), z.any()),
  createdAt: z.number(),
  resolvedAt: z.number().optional(),
  updatedAt: z.number(),
});
