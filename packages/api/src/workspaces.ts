import { z } from 'zod';
import {
  MoneyMapNodeKindSchema,
  MoneyMapRuleTriggerSchema,
  MoneyMapNodeMetadataSchema,
  MoneyMapEdgeMetadataSchema,
  MoneyMapRuleConfigSchema,
  type MoneyMapSnapshot,
  WorkspacePublishPayloadSchema,
  type WorkspacePublishPayload,
} from '@guap/types';

type PublishNodeSchema = WorkspacePublishPayload['nodes'][number];
type PublishEdgeSchema = WorkspacePublishPayload['edges'][number];
type PublishRuleSchema = WorkspacePublishPayload['rules'][number];

export type WorkspaceGraphNodeInput = {
  id: string;
  kind: PublishNodeSchema['type'];
  category?: string | null;
  parentId?: string | null;
  podType?: string | null;
  label: string;
  icon?: string;
  accent?: string;
  balance?: number;
  inflow?: { amount: number; cadence: 'monthly' | 'weekly' | 'daily' } | null;
  position: PublishNodeSchema['position'];
  metadata?: Record<string, unknown> | null;
};

export type WorkspaceGraphFlowInput = {
  id: string;
  sourceId: string;
  targetId: string;
  ruleId?: PublishEdgeSchema['ruleClientId'];
  metadata?: Record<string, unknown>;
};

export type WorkspaceGraphRuleInput = {
  id: string;
  sourceNodeId: string;
  trigger: PublishRuleSchema['trigger'];
  triggerNodeId?: string | null;
  allocations: Array<{ targetNodeId: string; percentage: number }>;
};

export type WorkspaceGraphPublishInput = {
  slug: string;
  nodes: WorkspaceGraphNodeInput[];
  flows: WorkspaceGraphFlowInput[];
  rules: WorkspaceGraphRuleInput[];
};

export type WorkspaceGraphDraft = {
  nodes: WorkspaceGraphNodeInput[];
  flows: WorkspaceGraphFlowInput[];
  rules: WorkspaceGraphRuleInput[];
};

const MoneyMapNodeInputSchema = z.object({
  key: z.string(),
  kind: MoneyMapNodeKindSchema,
  label: z.string(),
  metadata: MoneyMapNodeMetadataSchema.optional(),
});

const MoneyMapEdgeInputSchema = z.object({
  sourceKey: z.string(),
  targetKey: z.string(),
  metadata: MoneyMapEdgeMetadataSchema.optional(),
});

const MoneyMapRuleInputSchema = z.object({
  key: z.string(),
  trigger: MoneyMapRuleTriggerSchema,
  config: MoneyMapRuleConfigSchema,
});

export const MoneyMapSaveInputSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(MoneyMapNodeInputSchema),
  edges: z.array(MoneyMapEdgeInputSchema),
  rules: z.array(MoneyMapRuleInputSchema),
});

export type MoneyMapNodeInput = z.infer<typeof MoneyMapNodeInputSchema>;
export type MoneyMapEdgeInput = z.infer<typeof MoneyMapEdgeInputSchema>;
export type MoneyMapRuleInput = z.infer<typeof MoneyMapRuleInputSchema>;
export type MoneyMapSaveInput = z.infer<typeof MoneyMapSaveInputSchema>;

const toCents = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : undefined;

const normalizeMetadata = (
  node: WorkspaceGraphNodeInput
): PublishNodeSchema['metadata'] | undefined => {
  const metadata: Record<string, unknown> = node.metadata ? { ...node.metadata } : {};
  if (node.podType) {
    metadata.podType = node.podType;
  }
  if (node.inflow) {
    metadata.inflow = node.inflow;
  }
  return Object.keys(metadata).length > 0 ? MoneyMapNodeMetadataSchema.parse(metadata) : undefined;
};

export const createWorkspacePublishPayload = (
  input: WorkspaceGraphPublishInput
): WorkspacePublishPayload => {
  const payload: WorkspacePublishPayload = {
    slug: input.slug,
    nodes: input.nodes.map((node) => ({
      clientId: node.id,
      type: node.kind,
      label: node.label,
      icon: node.icon,
      accent: node.accent,
      balanceCents: toCents(node.balance),
      position: node.position,
      parentClientId: node.parentId ?? null,
      category: node.category ?? null,
      metadata: normalizeMetadata(node),
    })),
    edges: input.flows.map((flow) => ({
      clientId: flow.id,
      sourceClientId: flow.sourceId,
      targetClientId: flow.targetId,
      kind: flow.ruleId ? 'automation' : 'manual',
      ruleClientId: flow.ruleId,
      metadata: flow.metadata ? MoneyMapEdgeMetadataSchema.parse(flow.metadata) : undefined,
    })),
    rules: input.rules.map((rule) => ({
      clientId: rule.id,
      sourceClientId: rule.sourceNodeId,
      trigger: rule.trigger,
      triggerNodeClientId: rule.triggerNodeId ?? null,
      allocations: rule.allocations.map((allocation) => ({
        targetClientId: allocation.targetNodeId,
        percentage: allocation.percentage,
      })),
    })),
  };

  return WorkspacePublishPayloadSchema.parse(payload);
};

const mapNodeKind = (kind: string): MoneyMapNodeInput['kind'] => {
  switch (kind) {
    case 'income':
    case 'account':
    case 'pod':
    case 'goal':
    case 'liability':
      return kind;
    default:
      return 'account';
  }
};

const mapRuleTrigger = (trigger: string): MoneyMapRuleInput['trigger'] =>
  trigger === 'scheduled' ? 'scheduled' : 'incoming';

export const createMoneyMapSaveInput = (options: {
  organizationId: string;
  draft: WorkspaceGraphDraft;
  snapshot?: MoneyMapSnapshot | null;
  fallbackName?: string;
  fallbackDescription?: string;
}): MoneyMapSaveInput => {
  const { organizationId, draft, snapshot, fallbackName, fallbackDescription } = options;
  const mapMeta = snapshot?.map;
  const name = mapMeta?.name ?? fallbackName ?? 'Money Map';
  const description = mapMeta?.description ?? fallbackDescription;

  const nodes = draft.nodes.map((node) => {
    const metadata: Record<string, unknown> = {
      ...(node.metadata ?? {}),
      id: node.id,
      category: node.category ?? null,
      parentId: node.parentId ?? null,
      podType: node.podType ?? null,
      icon: node.icon ?? null,
      accent: node.accent ?? null,
      balanceCents: toCents(node.balance ?? undefined),
      inflow: node.inflow ?? null,
      position: node.position,
    };

    if (metadata.returnRate === undefined && node.metadata && 'returnRate' in node.metadata) {
      metadata.returnRate = (node.metadata as Record<string, unknown>).returnRate;
    }

    return {
      key: node.id,
      kind: mapNodeKind(node.kind),
      label: node.label,
      metadata,
    };
  });

  const edges = draft.flows.map((flow) => {
    const metadata: Record<string, unknown> = {
      ...(flow.metadata ?? {}),
      id: flow.id,
      ruleId: flow.ruleId ?? null,
    };
    return {
      sourceKey: flow.sourceId,
      targetKey: flow.targetId,
      metadata,
    };
  });

  const rules = draft.rules.map((rule) => ({
    key: rule.id,
    trigger: mapRuleTrigger(rule.trigger),
    config: {
      ruleId: rule.id,
      sourceNodeId: rule.sourceNodeId,
      triggerNodeId: rule.triggerNodeId ?? null,
      allocations: rule.allocations,
    },
  }));

  return MoneyMapSaveInputSchema.parse({
    organizationId,
    name,
    description: description ?? undefined,
    nodes,
    edges,
    rules,
  });
};

const WorkspaceGraphNodeSchema = z.object({
  _id: z.string(),
  id: z.string(),
  type: MoneyMapNodeKindSchema,
  label: z.string(),
  icon: z.string().optional(),
  accent: z.string().optional(),
  balanceCents: z.number().optional(),
  parentId: z.string().nullable(),
  position: z.object({ x: z.number(), y: z.number() }),
  category: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const WorkspaceGraphEdgeSchema = z.object({
  _id: z.string(),
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  amountCents: z.number().optional(),
  tag: z.string().optional(),
  note: z.string().optional(),
  ruleId: z.string().optional(),
});

const WorkspaceGraphRuleSchema = z.object({
  _id: z.string(),
  id: z.string(),
  workspaceId: z.string(),
  sourceNodeId: z.string(),
  triggerType: MoneyMapRuleTriggerSchema,
  triggerNodeId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const WorkspaceGraphAllocationSchema = z.object({
  _id: z.string(),
  ruleId: z.string(),
  order: z.number(),
  percentage: z.number(),
  targetNodeId: z.string(),
});

const WorkspaceGraphDataSchema = z.object({
  nodes: z.array(WorkspaceGraphNodeSchema),
  edges: z.array(WorkspaceGraphEdgeSchema),
  rules: z.array(WorkspaceGraphRuleSchema),
  allocations: z.array(WorkspaceGraphAllocationSchema),
});

export type WorkspaceGraphNode = z.infer<typeof WorkspaceGraphNodeSchema>;
export type WorkspaceGraphEdge = z.infer<typeof WorkspaceGraphEdgeSchema>;
export type WorkspaceGraphRule = z.infer<typeof WorkspaceGraphRuleSchema>;
export type WorkspaceGraphAllocation = z.infer<typeof WorkspaceGraphAllocationSchema>;
export type WorkspaceGraphData = z.infer<typeof WorkspaceGraphDataSchema>;

export const workspaceGraphFromSnapshot = (
  snapshot: MoneyMapSnapshot | null
): WorkspaceGraphData => {
  if (!snapshot) {
    return WorkspaceGraphDataSchema.parse({
      nodes: [],
      edges: [],
      rules: [],
      allocations: [],
    });
  }

  const nodes = snapshot.nodes.map((node) => {
    const metadata = (node.metadata ?? {}) as Record<string, any>;
    const id = typeof metadata.id === 'string' ? metadata.id : node.key;
    const position =
      typeof metadata.position === 'object' && metadata.position
        ? metadata.position
        : { x: 0, y: 0 };
    const balanceCents =
      typeof metadata.balanceCents === 'number' ? metadata.balanceCents : undefined;

    return {
      _id: node._id,
      id,
      type: node.kind,
      label: node.label,
      icon: metadata.icon ?? undefined,
      accent: metadata.accent ?? undefined,
      balanceCents,
      parentId: metadata.parentId ?? null,
      position,
      category: metadata.category ?? null,
      metadata,
    };
  });

  const edges = snapshot.edges.map((edge) => {
    const metadata = ((edge as unknown) as { metadata?: Record<string, any> | null }).metadata ?? {};
    const id = typeof metadata.id === 'string' ? metadata.id : edge._id;
    return {
      _id: edge._id,
      id,
      sourceNodeId: edge.sourceKey,
      targetNodeId: edge.targetKey,
      amountCents:
        typeof (metadata as Record<string, any>).amountCents === 'number'
          ? (metadata as Record<string, any>).amountCents
          : undefined,
      tag: (metadata as Record<string, any>).tag ?? undefined,
      note: (metadata as Record<string, any>).note ?? undefined,
      ruleId: (metadata as Record<string, any>).ruleId ?? undefined,
    };
  });

  const allocations: Array<{
    _id: string;
    ruleId: string;
    order: number;
    percentage: number;
    targetNodeId: string;
  }> = [];

  const rules = snapshot.rules.map((rule) => {
    const config = (rule.config ?? {}) as Record<string, any>;
    const ruleAllocations = Array.isArray(config.allocations)
      ? (config.allocations as Array<{ targetNodeId: string; percentage: number }>)
      : [];

    ruleAllocations.forEach((alloc, index) => {
      allocations.push({
        _id: `${rule._id}-alloc-${index}`,
        ruleId: String(rule._id),
        order: index,
        percentage: alloc.percentage,
        targetNodeId: alloc.targetNodeId,
      });
    });

    return {
      _id: rule._id,
      id: (config.ruleId as string) ?? String(rule._id),
      workspaceId: rule.mapId,
      sourceNodeId: config.sourceNodeId ?? '',
      triggerType: rule.trigger,
      triggerNodeId: config.triggerNodeId ?? null,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  });

  return WorkspaceGraphDataSchema.parse({
    nodes,
    edges,
    rules,
    allocations,
  });
};
