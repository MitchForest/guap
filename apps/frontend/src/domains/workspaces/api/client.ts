import {
  createWorkspacePublishPayload,
  type WorkspaceGraphFlowInput,
  type WorkspaceGraphNodeInput,
  type WorkspaceGraphRuleInput,
  type WorkspaceRecord,
} from '@guap/api';
import { guapApi } from '~/services/guapApi';

type WorkspaceVariant = 'live' | 'sandbox';
type VariantKey = `${string}:${WorkspaceVariant}`;

let lastHouseholdId: string | null = null;

export type WorkspaceGraphDraft = {
  nodes: WorkspaceGraphNodeInput[];
  flows: WorkspaceGraphFlowInput[];
  rules: WorkspaceGraphRuleInput[];
};

const variantCache = new Map<VariantKey, WorkspaceRecord | null>();

const cacheKey = (householdId: string, variant: WorkspaceVariant): VariantKey =>
  `${householdId}:${variant}`;

export const clearWorkspaceCache = () => {
  variantCache.clear();
};

export async function ensureWorkspacePair(params: {
  householdId: string;
  slug: string;
  name: string;
  sandboxSlug?: string;
  sandboxName?: string;
}) {
  const result = await guapApi.ensureWorkspacePair({
    householdId: params.householdId,
    slug: params.slug,
    name: params.name,
    sandboxSlug: params.sandboxSlug,
    sandboxName: params.sandboxName,
  });
  variantCache.delete(cacheKey(params.householdId, 'live'));
  variantCache.delete(cacheKey(params.householdId, 'sandbox'));
  return result;
}

export async function listWorkspaceVariants(householdId: string) {
  lastHouseholdId = householdId;
  const workspaces = await guapApi.listWorkspaces(householdId);
  let live: WorkspaceRecord | null = null;
  let sandbox: WorkspaceRecord | null = null;
  for (const workspace of workspaces) {
    variantCache.set(cacheKey(workspace.householdId, workspace.variant), workspace);
    if (workspace.variant === 'live') live = workspace;
    if (workspace.variant === 'sandbox') sandbox = workspace;
  }
  return { live, sandbox };
}

export async function getWorkspace(slug: string): Promise<WorkspaceRecord | null> {
  for (const workspace of variantCache.values()) {
    if (workspace?.slug === slug) {
      return workspace;
    }
  }
  const record = await guapApi.getWorkspace(slug);
  if (record) {
    variantCache.set(cacheKey(record.householdId, record.variant), record);
    lastHouseholdId = record.householdId;
  }
  return record;
}

export async function getWorkspaceVariant(
  householdId: string,
  variant: WorkspaceVariant
): Promise<WorkspaceRecord | null> {
  const key = cacheKey(householdId, variant);
  if (variantCache.has(key)) {
    return variantCache.get(key) ?? null;
  }
  const workspace = await guapApi.getWorkspaceVariant(householdId, variant);
  variantCache.set(key, workspace);
  return workspace;
}

export async function fetchGraph(slug: string) {
  return await guapApi.fetchWorkspaceGraph(slug);
}

export async function publishGraph(target: string | WorkspaceRecord, draft: WorkspaceGraphDraft) {
  const workspace = typeof target === 'string' ? await getWorkspace(target) : target;
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  variantCache.delete(cacheKey(workspace.householdId, workspace.variant));
  const publishPayload = createWorkspacePublishPayload({
    slug: workspace.slug,
    nodes: draft.nodes,
    flows: draft.flows,
    rules: draft.rules,
  });
  return await guapApi.publishWorkspaceGraph(publishPayload);
}

export async function resetSandbox(params: { householdId: string; actorUserId: string }) {
  const result = await guapApi.resetSandbox(params);
  variantCache.delete(cacheKey(params.householdId, 'sandbox'));
  return result;
}

export async function applySandbox(params: {
  householdId: string;
  actorUserId: string;
  bypassApproval?: boolean;
}) {
  const result = await guapApi.applySandbox(params);
  variantCache.delete(cacheKey(params.householdId, 'live'));
  variantCache.delete(cacheKey(params.householdId, 'sandbox'));
  return result;
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  if (!lastHouseholdId) {
    return [];
  }
  const pair = await listWorkspaceVariants(lastHouseholdId);
  return [pair.live, pair.sandbox].filter(Boolean) as WorkspaceRecord[];
}

export async function ensureWorkspace(slug: string, name: string): Promise<WorkspaceRecord | null> {
  if (!lastHouseholdId) {
    return null;
  }
  const sandboxSlug = `${slug}-sandbox`;
  await ensureWorkspacePair({
    householdId: lastHouseholdId,
    slug,
    name,
    sandboxSlug,
    sandboxName: `${name} Sandbox`,
  }).catch(() => undefined);
  const workspaces = await listWorkspaces();
  return workspaces.find((workspace) => workspace.slug === slug) ?? workspaces.find((workspace) => workspace.variant === 'sandbox') ?? null;
}

export async function deleteWorkspace(_workspaceId: string) {
  console.warn('Workspace deletion is disabled; sandbox model enforces a single pair per household.');
}
