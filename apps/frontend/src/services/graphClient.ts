import { convex } from './convexClient';

const WORKSPACE_SLUG = 'demo-canvas';
const WORKSPACE_NAME = 'Sequence Playground';

export async function ensureWorkspace() {
  await convex.mutation('workspaces:ensure', {
    slug: WORKSPACE_SLUG,
    name: WORKSPACE_NAME,
  });
}

export async function getWorkspace() {
  return await convex.query('workspaces:getBySlug', { slug: WORKSPACE_SLUG });
}

export async function fetchGraph() {
  const result = await convex.query('graph:getGraph', { slug: WORKSPACE_SLUG });
  return result;
}

export async function watchGraph(callback: (data: any) => void) {
  if (typeof (convex as any).watchQuery !== 'function') {
    console.warn('Convex watchQuery not available; falling back to polling.');
    const interval = setInterval(async () => {
      const data = await fetchGraph();
      callback(data);
    }, 3000);
    return () => clearInterval(interval);
  }

  const unsubscribe = await (convex as any).watchQuery('graph:getGraph', { slug: WORKSPACE_SLUG }, callback);
  return unsubscribe as () => void;
}

export async function createNode(input: {
  type: 'income' | 'account' | 'pod' | 'goal' | 'liability';
  label: string;
  icon?: string;
  accent?: string;
  balanceCents?: number;
  position: { x: number; y: number };
}) {
  const workspace = await getWorkspace();
  if (!workspace) throw new Error('Workspace missing');
  const id = await convex.mutation('nodes:create', {
    workspaceId: workspace._id,
    ...input,
  });
  return id;
}

export async function moveNodes(updates: Array<{ nodeId: string; position: { x: number; y: number } }>) {
  if (updates.length === 0) return;
  await convex.mutation('nodes:moveMany', {
    updates: updates.map((update) => ({
      nodeId: update.nodeId,
      position: update.position,
    })),
  });
}

export async function deleteNode(nodeId: string) {
  await convex.mutation('nodes:remove', { nodeId });
}

export async function saveAutomationRule(input: {
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId?: string | null;
  allocations: Array<{ targetNodeId: string; percentage: number }>;
}) {
  const workspace = await getWorkspace();
  if (!workspace) throw new Error('Workspace missing');
  return await convex.mutation('rules:saveAutomation', {
    workspaceId: workspace._id,
    sourceNodeId: input.sourceNodeId,
    trigger: input.trigger,
    triggerNodeId: input.triggerNodeId ?? null,
    allocations: input.allocations,
  });
}

export async function createEdge(input: {
  sourceNodeId: string;
  targetNodeId: string;
  kind?: 'manual' | 'automation';
  ruleId?: string;
}) {
  const workspace = await getWorkspace();
  if (!workspace) throw new Error('Workspace missing');
  await convex.mutation('edges:create', {
    workspaceId: workspace._id,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    kind: input.kind,
    ruleId: input.ruleId,
  });
}
