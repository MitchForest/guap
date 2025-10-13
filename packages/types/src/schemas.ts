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

export const MoneyMapPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
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
  position: MoneyMapPositionSchema.optional(),
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
