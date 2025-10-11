import type { MutationCtx } from '@guap/api/codegen/server';
import type { Doc, Id } from '@guap/api/codegen/dataModel';

const now = () => Date.now();

export type WorkspaceGraphSnapshot = {
  nodes: Array<Doc<'nodes'>>;
  edges: Array<Doc<'edges'>>;
  rules: Array<Doc<'rules'>>;
  allocationsByRule: Map<string, Array<Doc<'ruleAllocations'>>>;
};

export type WorkspaceGraphPublishPayload = {
  nodes: Array<{
    clientId: string;
    type: Doc<'nodes'>['type'];
    label: string;
    icon?: string;
    accent?: string;
    balanceCents?: number;
    position: Doc<'nodes'>['position'];
    parentClientId?: string;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    clientId: string;
    sourceClientId: string;
    targetClientId: string;
    kind?: Doc<'edges'>['kind'];
    ruleClientId?: string;
  }>;
  rules: Array<{
    clientId: string;
    sourceClientId: string;
    trigger: Doc<'rules'>['triggerType'];
    triggerNodeClientId?: string;
    allocations: Array<{
      targetClientId: string;
      percentage: number;
    }>;
  }>;
};

export const fetchWorkspaceSnapshot = async (
  ctx: MutationCtx,
  workspaceId: Id<'workspaces'>
): Promise<WorkspaceGraphSnapshot> => {
  const nodes = await ctx.db
    .query('nodes')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();

  const edges = await ctx.db
    .query('edges')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();

  const rules = await ctx.db
    .query('rules')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();

  const allocationsByRule = new Map<string, Array<Doc<'ruleAllocations'>>>();

  for (const rule of rules) {
    const allocations = await ctx.db
      .query('ruleAllocations')
      .withIndex('by_rule', (q) => q.eq('ruleId', rule._id))
      .collect();
    allocationsByRule.set(String(rule._id), allocations);
  }

  return { nodes, edges, rules, allocationsByRule };
};

export const buildPayloadFromSnapshot = (
  snapshot: WorkspaceGraphSnapshot
): WorkspaceGraphPublishPayload => ({
  nodes: snapshot.nodes.map((node) => ({
    clientId: String(node._id),
    type: node.type,
    label: node.label,
    icon: node.icon ?? undefined,
    accent: node.accent ?? undefined,
    balanceCents: node.balanceCents ?? undefined,
    position: node.position,
    parentClientId: node.parentId ? String(node.parentId) : undefined,
    metadata: node.metadata ?? undefined,
  })),
  edges: snapshot.edges.map((edge) => ({
    clientId: String(edge._id),
    sourceClientId: String(edge.sourceNodeId),
    targetClientId: String(edge.targetNodeId),
    kind: edge.kind ?? undefined,
    ruleClientId: edge.ruleId ? String(edge.ruleId) : undefined,
  })),
  rules: snapshot.rules.map((rule) => ({
    clientId: String(rule._id),
    sourceClientId: String(rule.sourceNodeId),
    trigger: rule.triggerType,
    triggerNodeClientId: rule.triggerNodeId ? String(rule.triggerNodeId) : undefined,
    allocations: (snapshot.allocationsByRule.get(String(rule._id)) ?? []).map((alloc) => ({
      targetClientId: String(alloc.targetNodeId),
      percentage: alloc.percentage,
    })),
  })),
});

export const clearWorkspaceSessions = async (ctx: MutationCtx, workspaceId: Id<'workspaces'>) => {
  const sessions = await ctx.db
    .query('canvasSessions')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();

  for (const session of sessions) {
    await ctx.db.delete(session._id);
  }
};

export const clearWorkspaceDiffs = async (ctx: MutationCtx, workspaceId: Id<'workspaces'>) => {
  const diffs = await ctx.db
    .query('workspaceChangeDiffs')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();

  for (const diff of diffs) {
    await ctx.db.delete(diff._id);
  }
};

export const replaceWorkspaceGraph = async (
  ctx: MutationCtx,
  workspaceId: Id<'workspaces'>,
  payload: WorkspaceGraphPublishPayload
) => {
  const existingRules = await ctx.db
    .query('rules')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();

  for (const rule of existingRules) {
    const allocations = await ctx.db
      .query('ruleAllocations')
      .withIndex('by_rule', (q) => q.eq('ruleId', rule._id))
      .collect();
    for (const allocation of allocations) {
      await ctx.db.delete(allocation._id);
    }
    await ctx.db.delete(rule._id);
  }

  const existingEdges = await ctx.db
    .query('edges')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();
  for (const edge of existingEdges) {
    await ctx.db.delete(edge._id);
  }

  const existingNodes = await ctx.db
    .query('nodes')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect();
  for (const node of existingNodes) {
    await ctx.db.delete(node._id);
  }

  const nodeIdMap = new Map<string, Id<'nodes'>>();
  const pendingParentLinks: Array<{ nodeId: Id<'nodes'>; parentClientId: string }> = [];

  for (const node of payload.nodes) {
    const id = await ctx.db.insert('nodes', {
      workspaceId,
      type: node.type,
      label: node.label,
      icon: node.icon,
      accent: node.accent,
      balanceCents: node.balanceCents,
      position: node.position,
      metadata: node.metadata,
      createdAt: now(),
      updatedAt: now(),
    });
    nodeIdMap.set(node.clientId, id);
    if (node.parentClientId) {
      pendingParentLinks.push({ nodeId: id, parentClientId: node.parentClientId });
    }
  }

  for (const link of pendingParentLinks) {
    const parentNodeId = nodeIdMap.get(link.parentClientId);
    if (!parentNodeId) continue;
    await ctx.db.patch(link.nodeId, {
      parentId: parentNodeId,
      updatedAt: now(),
    });
  }

  const ruleIdMap = new Map<string, Id<'rules'>>();

  for (const rule of payload.rules) {
    const sourceId = nodeIdMap.get(rule.sourceClientId);
    if (!sourceId) continue;

    const triggerNodeId = rule.triggerNodeClientId
      ? nodeIdMap.get(rule.triggerNodeClientId) ?? sourceId
      : sourceId;

    const ruleId = await ctx.db.insert('rules', {
      workspaceId,
      sourceNodeId: sourceId,
      triggerType: rule.trigger,
      triggerNodeId,
      createdAt: now(),
      updatedAt: now(),
    });

    ruleIdMap.set(rule.clientId, ruleId);

    let order = 0;
    for (const allocation of rule.allocations) {
      const targetId = nodeIdMap.get(allocation.targetClientId);
      if (!targetId) continue;

      await ctx.db.insert('ruleAllocations', {
        ruleId,
        order: order++,
        percentage: allocation.percentage,
        targetNodeId: targetId,
        createdAt: now(),
        updatedAt: now(),
      });
    }
  }

  const edgeIdMap = new Map<string, Id<'edges'>>();

  for (const edge of payload.edges) {
    const sourceId = nodeIdMap.get(edge.sourceClientId);
    const targetId = nodeIdMap.get(edge.targetClientId);
    if (!sourceId || !targetId) continue;

    const ruleId = edge.ruleClientId ? ruleIdMap.get(edge.ruleClientId) : undefined;

    const edgeId = await ctx.db.insert('edges', {
      workspaceId,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      kind: edge.kind ?? 'manual',
      ruleId,
      createdAt: now(),
      updatedAt: now(),
    });

    edgeIdMap.set(edge.clientId, edgeId);
  }

  return {
    nodeIdMap,
    edgeIdMap,
    ruleIdMap,
  };
};

