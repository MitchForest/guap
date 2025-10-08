import { convex } from './convexClient';

export type WorkspaceRecord = {
  _id: string;
  name: string;
  slug: string;
};

type GraphPublishPayload = {
  nodes: Array<{
    id: string;
    kind: 'income' | 'account' | 'subAccount';
    category?: string | null;
    parentId?: string | null;
    label: string;
    icon?: string;
    accent?: string;
    balance?: number;
    position: { x: number; y: number };
  }>;
  flows: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    tone: 'manual' | 'auto';
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
    nodes: payload.nodes.map((node) => ({
      clientId: node.id,
      type: node.kind === 'income' ? 'income' : node.kind === 'subAccount' ? 'pod' : 'account',
      label: node.label,
      icon: node.icon,
      accent: node.accent,
      balanceCents: typeof node.balance === 'number' ? Math.round(node.balance * 100) : undefined,
      position: node.position,
      parentClientId: node.parentId ?? null,
      category: node.category ?? null,
    })),
    edges: payload.flows.map((flow) => ({
      clientId: flow.id,
      sourceClientId: flow.sourceId,
      targetClientId: flow.targetId,
      kind: flow.tone === 'manual' ? 'manual' : 'automation',
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
