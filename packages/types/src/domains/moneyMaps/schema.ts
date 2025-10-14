import { z } from 'zod';

export const MoneyMapPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const MoneyMapNodeKindValues = ['income', 'account', 'pod', 'goal', 'liability'] as const;
export const MoneyMapNodeKindSchema = z.enum(MoneyMapNodeKindValues);

export const MoneyMapRuleTriggerValues = ['incoming', 'scheduled'] as const;
export const MoneyMapRuleTriggerSchema = z.enum(MoneyMapRuleTriggerValues);

export const MoneyMapChangeStatusValues = [
  'awaiting_admin',
  'approved',
  'rejected',
  'withdrawn',
] as const;
export const MoneyMapChangeStatusSchema = z.enum(MoneyMapChangeStatusValues);

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

export const MoneyMapRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
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

export type MoneyMapPosition = z.infer<typeof MoneyMapPositionSchema>;
export type MoneyMapNodeKind = z.infer<typeof MoneyMapNodeKindSchema>;
export type MoneyMapRuleTrigger = z.infer<typeof MoneyMapRuleTriggerSchema>;
export type MoneyMapChangeStatus = z.infer<typeof MoneyMapChangeStatusSchema>;
export type MoneyMapNodeMetadata = z.infer<typeof MoneyMapNodeMetadataSchema>;
export type MoneyMapEdgeMetadata = z.infer<typeof MoneyMapEdgeMetadataSchema>;
export type MoneyMapRuleConfig = z.infer<typeof MoneyMapRuleConfigSchema>;
export type MoneyMapRecord = z.infer<typeof MoneyMapRecordSchema>;
export type MoneyMapNodeRecord = z.infer<typeof MoneyMapNodeRecordSchema>;
export type MoneyMapEdgeRecord = z.infer<typeof MoneyMapEdgeRecordSchema>;
export type MoneyMapRuleRecord = z.infer<typeof MoneyMapRuleRecordSchema>;
export type MoneyMapSaveNodeInput = z.infer<typeof MoneyMapSaveNodeInputSchema>;
export type MoneyMapSaveEdgeInput = z.infer<typeof MoneyMapSaveEdgeInputSchema>;
export type MoneyMapSaveRuleInput = z.infer<typeof MoneyMapSaveRuleInputSchema>;
export type MoneyMapSaveInput = z.infer<typeof MoneyMapSaveInputSchema>;
export type MoneyMapSnapshot = z.infer<typeof MoneyMapSnapshotSchema>;
export type MoneyMapChangeRequestRecord = z.infer<typeof MoneyMapChangeRequestRecordSchema>;
