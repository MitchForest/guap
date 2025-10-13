import {
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  type MoneyMapChangeRequestRecord,
  type MoneyMapChangeStatus,
  type MoneyMapSnapshot,
  type WorkspaceGraphDraft,
  type WorkspaceGraphData,
  type WorkspaceRecord,
} from '@guap/api';
import { guapApi } from '~/services/guapApi';
import {
  clearMoneyMapSnapshotCache,
  getOrLoadMoneyMapSnapshot,
  invalidateMoneyMapSnapshot,
  organizationIdFor,
  registerMoneyMapSlugs,
  setMoneyMapSnapshot,
} from '~/domains/moneyMap/api/cache';

export type { WorkspaceGraphDraft } from '@guap/api';

type WorkspaceVariant = 'live' | 'draft';
type VariantKey = `${string}:${WorkspaceVariant}`;

let lastHouseholdId: string | null = null;

const variantCache = new Map<VariantKey, WorkspaceRecord | null>();

const cacheKey = (householdId: string, variant: WorkspaceVariant): VariantKey =>
  `${householdId}:${variant}`;

const toWorkspaceRecord = (
  householdId: string,
  slug: string,
  variant: WorkspaceVariant,
  snapshot: MoneyMapSnapshot | null
): WorkspaceRecord => {
  const mapMeta = snapshot?.map;
  const baseName = mapMeta?.name ?? 'Money Map';
  return {
    _id: `${variant}:${householdId}`,
    name: baseName,
    slug,
    householdId,
    variant: variant === 'live' ? 'live' : 'sandbox',
    lastSyncedAt: mapMeta?.updatedAt ?? null,
    lastAppliedAt: mapMeta?.updatedAt ?? null,
    pendingRequestId: null,
    createdAt: mapMeta?.createdAt ?? Date.now(),
    updatedAt: mapMeta?.updatedAt ?? Date.now(),
  };
};

export const clearWorkspaceCache = () => {
  variantCache.clear();
  clearMoneyMapSnapshotCache();
};

export async function ensureWorkspacePair(params: {
  householdId: string;
  slug: string;
  name: string;
  sandboxSlug?: string;
  sandboxName?: string;
}) {
  await guapApi.saveMoneyMap({
    organizationId: organizationIdFor(params.householdId),
    name: params.name,
    description: undefined,
    nodes: [],
    edges: [],
    rules: [],
  });
  invalidateMoneyMapSnapshot(params.householdId);
  variantCache.delete(cacheKey(params.householdId, 'live'));
  variantCache.delete(cacheKey(params.householdId, 'draft'));
}

export async function listWorkspaceVariants(householdId: string) {
  lastHouseholdId = householdId;
  const snapshot = await getOrLoadMoneyMapSnapshot(householdId, (orgId: string) =>
    guapApi.loadMoneyMap(orgId),
  );
  const { liveSlug, draftSlug } = registerMoneyMapSlugs(householdId, snapshot);

  const live = toWorkspaceRecord(householdId, liveSlug, 'live', snapshot);
  const draft = snapshot ? toWorkspaceRecord(householdId, draftSlug, 'draft', snapshot) : null;

  variantCache.set(cacheKey(householdId, 'live'), live);
  variantCache.set(cacheKey(householdId, 'draft'), draft);

  return { live, sandbox: draft };
}

export async function getWorkspace(slug: string): Promise<WorkspaceRecord | null> {
  for (const record of variantCache.values()) {
    if (record?.slug === slug) {
      return record;
    }
  }

  if (!lastHouseholdId) {
    return null;
  }

  const snapshot = await getOrLoadMoneyMapSnapshot(lastHouseholdId, (orgId: string) =>
    guapApi.loadMoneyMap(orgId),
  );
  const { liveSlug, draftSlug } = registerMoneyMapSlugs(lastHouseholdId, snapshot);
  const live = toWorkspaceRecord(lastHouseholdId, liveSlug, 'live', snapshot);
  const draft = snapshot ? toWorkspaceRecord(lastHouseholdId, draftSlug, 'draft', snapshot) : null;

  variantCache.set(cacheKey(lastHouseholdId, 'live'), live);
  variantCache.set(cacheKey(lastHouseholdId, 'draft'), draft);

  if (slug === liveSlug) return live;
  if (slug === draftSlug) return draft;
  return null;
}

export async function getWorkspaceVariant(
  householdId: string,
  variant: WorkspaceVariant
): Promise<WorkspaceRecord | null> {
  const key = cacheKey(householdId, variant);
  if (variantCache.has(key)) {
    return variantCache.get(key) ?? null;
  }
  const snapshot = await getOrLoadMoneyMapSnapshot(householdId, (orgId: string) =>
    guapApi.loadMoneyMap(orgId),
  );
  const { liveSlug, draftSlug } = registerMoneyMapSlugs(householdId, snapshot);
  const record =
    variant === 'draft' && snapshot
      ? toWorkspaceRecord(householdId, draftSlug, 'draft', snapshot)
      : toWorkspaceRecord(householdId, liveSlug, 'live', snapshot);
  variantCache.set(key, record);
  return record;
}

export async function fetchGraph(slug: string): Promise<WorkspaceGraphData> {
  const workspace = await getWorkspace(slug);
  if (!workspace) {
    return { nodes: [], edges: [], rules: [], allocations: [] };
  }
  const snapshot = await getOrLoadMoneyMapSnapshot(workspace.householdId, (orgId: string) =>
    guapApi.loadMoneyMap(orgId),
  );
  return workspaceGraphFromSnapshot(snapshot);
}

export async function publishGraph(target: string | WorkspaceRecord, draft: WorkspaceGraphDraft) {
  const workspace = typeof target === 'string' ? await getWorkspace(target) : target;
  if (!workspace) {
    throw new Error('Money Map not found');
  }

  const householdId = workspace.householdId;
  const snapshot = await getOrLoadMoneyMapSnapshot(householdId, (orgId: string) =>
    guapApi.loadMoneyMap(orgId),
  );
  const payload = createMoneyMapSaveInput({
    organizationId: organizationIdFor(householdId),
    draft,
    snapshot,
    fallbackName: snapshot?.map?.name ?? 'Money Map',
    fallbackDescription: snapshot?.map?.description,
  });

  const result = await guapApi.saveMoneyMap(payload);
  setMoneyMapSnapshot(householdId, result);
  variantCache.delete(cacheKey(householdId, 'live'));
  variantCache.delete(cacheKey(householdId, 'draft'));

  return {
    nodes: Object.fromEntries(result.nodes.map((node) => [node.metadata?.id ?? node._id, node._id])),
    edges: Object.fromEntries(result.edges.map((edge) => {
      const metadata = (edge.metadata ?? {}) as Record<string, unknown>;
      const id = typeof metadata.id === 'string' ? metadata.id : edge._id;
      return [id, edge._id];
    })),
    rules: Object.fromEntries(result.rules.map((rule) => {
      const config = (rule.config ?? {}) as Record<string, unknown>;
      const id = typeof config.ruleId === 'string' ? config.ruleId : rule._id;
      return [id, rule._id];
    })),
  };
}

export async function resetSandbox(_params: { householdId: string; actorUserId: string }) {
  console.warn('Sandbox reset is no longer supported; Money Map edits apply directly.');
}

export async function applySandbox(_params: {
  householdId: string;
  actorUserId: string;
  bypassApproval?: boolean;
}) {
  return { requiresApproval: false };
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  if (!lastHouseholdId) {
    return [];
  }
  const { live, sandbox } = await listWorkspaceVariants(lastHouseholdId);
  return [live, sandbox].filter(Boolean) as WorkspaceRecord[];
}

export async function ensureWorkspace(slug: string, name: string): Promise<WorkspaceRecord | null> {
  if (!lastHouseholdId) {
    return null;
  }
  await ensureWorkspacePair({
    householdId: lastHouseholdId,
    slug,
    name,
    sandboxSlug: `${slug}-draft`,
    sandboxName: `${name} Draft`,
  });
  const workspaces = await listWorkspaces();
  return (
    workspaces.find((workspace) => workspace.slug === slug) ??
    workspaces.find((workspace) => workspace.variant === 'sandbox') ??
    null
  );
}

export async function deleteWorkspace(_workspaceId: string) {
  console.warn('Money Map enforces a single record per household. Delete is disabled.');
}

export async function submitChangeRequest(params: {
  householdId: string;
  submitterId: string;
  draft: WorkspaceGraphDraft;
  summary?: string;
}) {
  const snapshot = await getOrLoadMoneyMapSnapshot(params.householdId, (orgId: string) =>
    guapApi.loadMoneyMap(orgId),
  );
  if (!snapshot) {
    throw new Error('No Money Map exists yet for this household');
  }

  const payload = createMoneyMapSaveInput({
    organizationId: organizationIdFor(params.householdId),
    draft: params.draft,
    snapshot,
    fallbackName: snapshot.map.name ?? 'Money Map',
    fallbackDescription: snapshot.map.description,
  });

  return await guapApi.submitChangeRequest({
    mapId: snapshot.map._id,
    organizationId: organizationIdFor(params.householdId),
    submitterId: params.submitterId,
    summary: params.summary,
    payload,
  });
}

export async function listChangeRequests(
  householdId: string,
  status?: MoneyMapChangeStatus
): Promise<MoneyMapChangeRequestRecord[]> {
  return await guapApi.listChangeRequests(organizationIdFor(householdId), status);
}

export async function updateChangeRequestStatus(params: {
  requestId: string;
  status: MoneyMapChangeStatus;
}) {
  await guapApi.updateChangeRequestStatus(params);
}
