import { z } from 'zod';
import {
  MoneyMapNodeMetadataSchema as MoneyMapNodeMetadataSchemaFromTypes,
  MoneyMapEdgeMetadataSchema as MoneyMapEdgeMetadataSchemaFromTypes,
  MoneyMapRuleConfigSchema as MoneyMapRuleConfigSchemaFromTypes,
  MoneyMapSaveInputSchema as MoneyMapSaveInputSchemaFromTypes,
  MoneyMapNodeKindSchema,
  MoneyMapRuleTriggerSchema,
  type MoneyMapSaveInput as MoneyMapSaveInputType,
  type MoneyMapSaveNodeInput,
  type MoneyMapSaveEdgeInput,
  type MoneyMapSaveRuleInput,
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

export type MoneyMapNodeInput = MoneyMapSaveNodeInput;
export type MoneyMapEdgeInput = MoneyMapSaveEdgeInput;
export type MoneyMapRuleInput = MoneyMapSaveRuleInput;
export type MoneyMapSaveInput = MoneyMapSaveInputType;

const toCents = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : undefined;

const MoneyMapNodeMetadataSchema = MoneyMapNodeMetadataSchemaFromTypes;
const MoneyMapEdgeMetadataSchema = MoneyMapEdgeMetadataSchemaFromTypes;
const MoneyMapRuleConfigSchema = MoneyMapRuleConfigSchemaFromTypes;
export const MoneyMapSaveInputSchema = MoneyMapSaveInputSchemaFromTypes;

const normalizeMetadata = (
  node: WorkspaceGraphNodeInput
): PublishNodeSchema['metadata'] | undefined => {
  const source = (node.metadata ?? {}) as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};

  const assign = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      metadata[key] = value;
    }
  };

  assign('id', typeof source.id === 'string' ? source.id : undefined);

  const category = node.category ?? (typeof source.category === 'string' ? source.category : undefined);
  assign('category', category);

  const parentId = node.parentId ?? (typeof source.parentId === 'string' ? source.parentId : undefined);
  assign('parentId', parentId);

  const podType = node.podType ?? (typeof source.podType === 'string' ? source.podType : undefined);
  assign('podType', podType);

  assign('icon', node.icon ?? (typeof source.icon === 'string' ? source.icon : undefined));
  assign('accent', node.accent ?? (typeof source.accent === 'string' ? source.accent : undefined));

  if (Object.prototype.hasOwnProperty.call(source, 'balanceCents') && typeof source.balanceCents === 'number') {
    assign('balanceCents', source.balanceCents);
  } else if (node.balance !== undefined) {
    const cents = toCents(node.balance);
    if (cents !== undefined) assign('balanceCents', cents);
  }

  const inflow = node.inflow ?? (source.inflow && typeof source.inflow === 'object' ? source.inflow : undefined);
  assign('inflow', inflow);

  metadata.position = node.position;

  if (Object.prototype.hasOwnProperty.call(source, 'returnRate') && typeof source.returnRate === 'number') {
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
  flow: WorkspaceGraphFlowInput
): PublishEdgeSchema['metadata'] | undefined => {
  const source = (flow.metadata ?? {}) as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};

  const assign = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      metadata[key] = value;
    }
  };

  assign('id', typeof source.id === 'string' ? source.id : undefined);
  assign('ruleId', flow.ruleId ?? (typeof source.ruleId === 'string' ? source.ruleId : undefined));

  if (Object.prototype.hasOwnProperty.call(source, 'amountCents') && typeof source.amountCents === 'number') {
    assign('amountCents', source.amountCents);
  }

  assign('tag', typeof source.tag === 'string' ? source.tag : undefined);
  assign('note', typeof source.note === 'string' ? source.note : undefined);

  return Object.keys(metadata).length > 0 ? MoneyMapEdgeMetadataSchema.parse(metadata) : undefined;
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
      metadata: normalizeEdgeMetadata(flow),
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
    const metadata: Record<string, unknown> = {};
    const assign = (key: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        metadata[key] = value;
      }
    };

    assign('id', node.id);
    assign('category', node.category);
    assign('parentId', node.parentId);
    assign('podType', node.podType);
    assign('icon', node.icon);
    assign('accent', node.accent);

    const cents = toCents(node.balance ?? undefined);
    if (cents !== undefined) assign('balanceCents', cents);

    if (node.inflow) assign('inflow', node.inflow);

    metadata.position = node.position;

    if (node.metadata && Object.prototype.hasOwnProperty.call(node.metadata, 'returnRate')) {
      const value = (node.metadata as Record<string, unknown>).returnRate;
      if (typeof value === 'number') assign('returnRate', value);
    }

    return {
      key: node.id,
      kind: mapNodeKind(node.kind),
      label: node.label,
      metadata: MoneyMapNodeMetadataSchema.parse(metadata),
    };
  });

  const edges = draft.flows.map((flow) => {
    const metadata: Record<string, unknown> = {};
    const assign = (key: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        metadata[key] = value;
      }
    };

    assign('id', flow.id);
    assign('ruleId', flow.ruleId);

    if (flow.metadata) {
      const source = flow.metadata as Record<string, unknown>;
      if (typeof source.amountCents === 'number') assign('amountCents', source.amountCents);
      if (typeof source.tag === 'string') assign('tag', source.tag);
      if (typeof source.note === 'string') assign('note', source.note);
    }

    return {
      sourceKey: flow.sourceId,
      targetKey: flow.targetId,
      metadata:
        Object.keys(metadata).length > 0 ? MoneyMapEdgeMetadataSchema.parse(metadata) : undefined,
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
