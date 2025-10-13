import { z } from 'zod';
import {
  MoneyMapNodeMetadataSchema as BaseNodeMetadataSchema,
  MoneyMapEdgeMetadataSchema as BaseEdgeMetadataSchema,
  MoneyMapRuleConfigSchema as BaseRuleConfigSchema,
  MoneyMapSaveInputSchema as BaseMoneyMapSaveInputSchema,
  MoneyMapNodeKindSchema,
  MoneyMapRuleTriggerSchema,
  type MoneyMapSnapshot,
} from '@guap/types';

const MoneyMapNodeMetadataSchema = BaseNodeMetadataSchema;
const MoneyMapEdgeMetadataSchema = BaseEdgeMetadataSchema;
const MoneyMapRuleConfigSchema = BaseRuleConfigSchema;
export const MoneyMapSaveInputSchema = BaseMoneyMapSaveInputSchema;

const toCents = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : undefined;

export type MoneyMapDraftNodeInput = {
  id: string;
  kind: z.infer<typeof MoneyMapNodeKindSchema>;
  category?: string | null;
  parentId?: string | null;
  podType?: string | null;
  label: string;
  icon?: string;
  accent?: string;
  balance?: number;
  inflow?: { amount: number; cadence: 'monthly' | 'weekly' | 'daily' } | null;
  position: { x: number; y: number };
  metadata?: Record<string, unknown> | null;
};

export type MoneyMapDraftFlowInput = {
  id: string;
  sourceId: string;
  targetId: string;
  ruleId?: string;
  metadata?: Record<string, unknown>;
};

export type MoneyMapDraftRuleInput = {
  id: string;
  sourceNodeId: string;
  trigger: z.infer<typeof MoneyMapRuleTriggerSchema>;
  triggerNodeId?: string | null;
  allocations: Array<{ targetNodeId: string; percentage: number }>;
};

export type MoneyMapDraft = {
  nodes: MoneyMapDraftNodeInput[];
  flows: MoneyMapDraftFlowInput[];
  rules: MoneyMapDraftRuleInput[];
};

export type MoneyMapNodeInput = {
  key: string;
  kind: 'income' | 'account' | 'pod' | 'goal' | 'liability';
  label: string;
  metadata?: Record<string, unknown>;
};
export type MoneyMapEdgeInput = {
  sourceKey: string;
  targetKey: string;
  metadata?: Record<string, unknown>;
};
export type MoneyMapRuleInput = {
  key: string;
  trigger: 'incoming' | 'scheduled';
  config: {
    ruleId?: string;
    sourceNodeId?: string;
    triggerNodeId?: string | null;
    allocations?: Array<{ targetNodeId: string; percentage: number }>;
  };
};
export type MoneyMapSaveInput = {
  organizationId: string;
  name: string;
  description?: string;
  nodes: MoneyMapNodeInput[];
  edges: MoneyMapEdgeInput[];
  rules: MoneyMapRuleInput[];
};

const normalizeNodeMetadata = (
  node: MoneyMapDraftNodeInput
): Record<string, unknown> | undefined => {
  const source = (node.metadata ?? {}) as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};

  const assign = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      metadata[key] = value;
    }
  };

  assign('id', typeof source.id === 'string' ? source.id : node.id);
  assign('category', node.category ?? (typeof source.category === 'string' ? source.category : undefined));
  assign('parentId', node.parentId ?? (typeof source.parentId === 'string' ? source.parentId : undefined));
  assign('podType', node.podType ?? (typeof source.podType === 'string' ? source.podType : undefined));
  assign('icon', node.icon ?? (typeof source.icon === 'string' ? source.icon : undefined));
  assign('accent', node.accent ?? (typeof source.accent === 'string' ? source.accent : undefined));

  if (
    Object.prototype.hasOwnProperty.call(source, 'balanceCents') &&
    typeof source.balanceCents === 'number'
  ) {
    assign('balanceCents', source.balanceCents);
  } else if (node.balance !== undefined) {
    const cents = toCents(node.balance);
    if (cents !== undefined) assign('balanceCents', cents);
  }

  const inflow =
    node.inflow ??
    (source.inflow && typeof source.inflow === 'object' ? (source.inflow as Record<string, unknown>) : undefined);
  assign('inflow', inflow ?? undefined);

  metadata.position = node.position;

  if (
    Object.prototype.hasOwnProperty.call(source, 'returnRate') &&
    typeof source.returnRate === 'number'
  ) {
    assign('returnRate', source.returnRate);
  } else if (
    node.metadata &&
    Object.prototype.hasOwnProperty.call(node.metadata, 'returnRate') &&
    typeof (node.metadata as Record<string, unknown>).returnRate === 'number'
  ) {
    assign('returnRate', (node.metadata as Record<string, unknown>).returnRate);
  }

  return Object.keys(metadata).length > 0 ? MoneyMapNodeMetadataSchema.parse(metadata) : undefined;
};

const normalizeEdgeMetadata = (
  flow: MoneyMapDraftFlowInput
): Record<string, unknown> | undefined => {
  const source = (flow.metadata ?? {}) as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};

  const assign = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      metadata[key] = value;
    }
  };

  assign('id', typeof source.id === 'string' ? source.id : flow.id);
  assign('ruleId', flow.ruleId ?? (typeof source.ruleId === 'string' ? source.ruleId : undefined));

  if (
    Object.prototype.hasOwnProperty.call(source, 'amountCents') &&
    typeof source.amountCents === 'number'
  ) {
    assign('amountCents', source.amountCents);
  }

  assign('tag', typeof source.tag === 'string' ? source.tag : undefined);
  assign('note', typeof source.note === 'string' ? source.note : undefined);

  return Object.keys(metadata).length > 0 ? MoneyMapEdgeMetadataSchema.parse(metadata) : undefined;
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
  draft: MoneyMapDraft;
  snapshot?: MoneyMapSnapshot | null;
  fallbackName?: string;
  fallbackDescription?: string;
}): MoneyMapSaveInput => {
  const { organizationId, draft, snapshot, fallbackName, fallbackDescription } = options;
  const mapMeta = snapshot?.map;
  const name = mapMeta?.name ?? fallbackName ?? 'Money Map';
  const description = mapMeta?.description ?? fallbackDescription;

  const nodes = draft.nodes.map((node) => {
    const metadata = normalizeNodeMetadata(node);
    return {
      key: node.id,
      kind: mapNodeKind(node.kind),
      label: node.label,
      metadata,
    };
  });

  const edges = draft.flows.map((flow) => {
    const metadata = normalizeEdgeMetadata(flow);
    return {
      sourceKey: flow.sourceId,
      targetKey: flow.targetId,
      metadata,
    };
  });

  const rules = draft.rules.map((rule) => {
    const config = MoneyMapRuleConfigSchema.parse({
      ruleId: rule.id,
      sourceNodeId: rule.sourceNodeId,
      triggerNodeId: rule.triggerNodeId ?? undefined,
      allocations: rule.allocations,
    });

    if (config.triggerNodeId === undefined || config.triggerNodeId === null) {
      delete (config as { triggerNodeId?: string }).triggerNodeId;
    }

    return {
      key: rule.id,
      trigger: mapRuleTrigger(rule.trigger),
      config,
    };
  });

  return MoneyMapSaveInputSchema.parse({
    organizationId,
    name,
    description: description ?? undefined,
    nodes,
    edges,
    rules,
  }) as MoneyMapSaveInput;
};

const MoneyMapGraphNodeSchema = z.object({
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

const MoneyMapGraphEdgeSchema = z.object({
  _id: z.string(),
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  amountCents: z.number().optional(),
  tag: z.string().optional(),
  note: z.string().optional(),
  ruleId: z.string().optional(),
});

const MoneyMapGraphRuleSchema = z.object({
  _id: z.string(),
  id: z.string(),
  mapId: z.string(),
  sourceNodeId: z.string(),
  triggerType: MoneyMapRuleTriggerSchema,
  triggerNodeId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const MoneyMapGraphAllocationSchema = z.object({
  _id: z.string(),
  ruleId: z.string(),
  order: z.number(),
  percentage: z.number(),
  targetNodeId: z.string(),
});

const MoneyMapGraphDataSchema = z.object({
  nodes: z.array(MoneyMapGraphNodeSchema),
  edges: z.array(MoneyMapGraphEdgeSchema),
  rules: z.array(MoneyMapGraphRuleSchema),
  allocations: z.array(MoneyMapGraphAllocationSchema),
});

export type MoneyMapGraphNode = z.infer<typeof MoneyMapGraphNodeSchema>;
export type MoneyMapGraphEdge = z.infer<typeof MoneyMapGraphEdgeSchema>;
export type MoneyMapGraphRule = z.infer<typeof MoneyMapGraphRuleSchema>;
export type MoneyMapGraphAllocation = z.infer<typeof MoneyMapGraphAllocationSchema>;
export type MoneyMapGraphData = z.infer<typeof MoneyMapGraphDataSchema>;

export const workspaceGraphFromSnapshot = (
  snapshot: MoneyMapSnapshot | null
): MoneyMapGraphData => {
  if (!snapshot) {
    return MoneyMapGraphDataSchema.parse({
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
      _id: String(node._id),
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
      _id: String(edge._id),
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
      _id: String(rule._id),
      id: (config.ruleId as string) ?? String(rule._id),
      mapId: rule.mapId,
      sourceNodeId: config.sourceNodeId ?? '',
      triggerType: rule.trigger,
      triggerNodeId: config.triggerNodeId ?? null,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  });

  return MoneyMapGraphDataSchema.parse({
    nodes,
    edges,
    rules,
    allocations,
  });
};
