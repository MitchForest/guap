import { convex } from './convexClient';

export type WorkspaceRecord = {
  _id: string;
  name: string;
  slug: string;
};

type GraphPublishPayload = {
  nodes: Array<{
    id: string;
    kind: 'income' | 'account' | 'pod' | 'goal' | 'liability';
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
  }>;
  flows: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    ruleId?: string;
  }>;
  rules: Array<{
    id: string;
    sourceNodeId: string;
    trigger: 'incoming' | 'scheduled';
    triggerNodeId?: string | null;
    allocations: Array<{ targetNodeId: string; percentage: number }>;
  }>;
};

const workspaceCache = new Map<string, WorkspaceRecord | null>();

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  const result = await convex.query('workspaces:list', {});
  return Array.isArray(result) ? (result as WorkspaceRecord[]) : [];
}

export async function ensureWorkspace(slug: string, name: string): Promise<WorkspaceRecord | null> {
  await convex.mutation('workspaces:ensure', {
    slug,
    name,
  });
  const workspace = await convex.query('workspaces:getBySlug', { slug });
  workspaceCache.set(slug, (workspace as WorkspaceRecord) ?? null);
  return (workspace as WorkspaceRecord) ?? null;
}

export async function getWorkspace(slug: string): Promise<WorkspaceRecord | null> {
  if (workspaceCache.has(slug)) {
    return workspaceCache.get(slug) ?? null;
  }
  const workspace = await convex.query('workspaces:getBySlug', { slug });
  workspaceCache.set(slug, (workspace as WorkspaceRecord) ?? null);
  return (workspace as WorkspaceRecord) ?? null;
}

export async function fetchGraph(slug: string) {
  return await convex.query('graph:getGraph', { slug });
}

export async function publishGraph(slug: string, payload: GraphPublishPayload) {
  return await convex.mutation('graph:publish', {
    slug,
    nodes: payload.nodes.map((node) => {
      const metadata: Record<string, unknown> = node.metadata ? { ...node.metadata } : {};
      if (node.podType) metadata.podType = node.podType;
      if (node.inflow) metadata.inflow = node.inflow;

      return {
        clientId: node.id,
        type:
          node.kind === 'income'
            ? 'income'
            : node.kind === 'pod'
            ? 'pod'
            : node.kind === 'goal'
            ? 'goal'
            : node.kind === 'liability'
            ? 'liability'
            : 'account',
        label: node.label,
        icon: node.icon,
        accent: node.accent,
        balanceCents: typeof node.balance === 'number' ? Math.round(node.balance * 100) : undefined,
        position: node.position,
        parentClientId: node.parentId ?? null,
        category: node.category ?? null,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      };
    }),
    edges: payload.flows.map((flow) => ({
      clientId: flow.id,
      sourceClientId: flow.sourceId,
      targetClientId: flow.targetId,
      kind: flow.ruleId ? 'automation' : 'manual',
      ruleClientId: flow.ruleId,
    })),
    rules: payload.rules.map((rule) => ({
      clientId: rule.id,
      sourceClientId: rule.sourceNodeId,
      trigger: rule.trigger,
      triggerNodeClientId: rule.triggerNodeId ?? null,
      allocations: rule.allocations.map((alloc) => ({
        targetClientId: alloc.targetNodeId,
        percentage: alloc.percentage,
      })),
    })),
  });
}

export async function deleteWorkspace(workspaceId: string) {
  await convex.mutation('workspaces:remove', { workspaceId });
  workspaceCache.clear();
}
