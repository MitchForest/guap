import type { WorkspacePublishPayload } from '@guap/types';
import { WorkspacePublishPayloadSchema } from '@guap/types';

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
  return Object.keys(metadata).length > 0 ? metadata : undefined;
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

