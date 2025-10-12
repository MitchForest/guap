import {
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  type MoneyMapChangeRequestRecord,
  type MoneyMapChangeStatus,
  type MoneyMapSnapshot,
  type WorkspaceGraphDraft,
} from '@guap/api';
import { guapApi } from '~/services/guapApi';

const snapshotCache = new Map<string, MoneyMapSnapshot | null>();

const organizationIdFor = (householdId: string) => householdId;

export const clearMoneyMapCache = () => {
  snapshotCache.clear();
};

export const loadMoneyMapGraph = async (householdId: string) => {
  const organizationId = organizationIdFor(householdId);
  const snapshot = await guapApi.loadMoneyMap(organizationId);
  snapshotCache.set(householdId, snapshot ?? null);
  return {
    snapshot: snapshot ?? null,
    graph: workspaceGraphFromSnapshot(snapshot ?? null),
  };
};

export const saveMoneyMapGraph = async (params: {
  householdId: string;
  draft: WorkspaceGraphDraft;
}) => {
  const { householdId, draft } = params;
  const snapshot = snapshotCache.get(householdId) ?? null;
  const organizationId = organizationIdFor(householdId);

  const payload = createMoneyMapSaveInput({
    organizationId,
    draft,
    snapshot,
    fallbackName: snapshot?.map?.name ?? 'Money Map',
    fallbackDescription: snapshot?.map?.description,
  });

  const result = await guapApi.saveMoneyMap(payload);
  snapshotCache.set(householdId, result);

  return {
    snapshot: result,
    graph: workspaceGraphFromSnapshot(result),
  };
};

export const submitMoneyMapChangeRequest = async (params: {
  householdId: string;
  submitterId: string;
  draft: WorkspaceGraphDraft;
  summary?: string;
}) => {
  const { householdId, submitterId, draft, summary } = params;
  const snapshot = snapshotCache.get(householdId);
  if (!snapshot) {
    throw new Error('No Money Map snapshot available for submission.');
  }

  const payload = createMoneyMapSaveInput({
    organizationId: organizationIdFor(householdId),
    draft,
    snapshot,
    fallbackName: snapshot.map.name ?? 'Money Map',
    fallbackDescription: snapshot.map.description,
  });

  return await guapApi.submitChangeRequest({
    mapId: snapshot.map._id,
    organizationId: organizationIdFor(householdId),
    submitterId,
    summary,
    payload,
  });
};

export const listMoneyMapChangeRequests = async (
  householdId: string,
  status?: MoneyMapChangeStatus
): Promise<MoneyMapChangeRequestRecord[]> => {
  return await guapApi.listChangeRequests(organizationIdFor(householdId), status);
};

export const updateMoneyMapChangeRequestStatus = async (params: {
  requestId: string;
  status: MoneyMapChangeStatus;
}) => {
  await guapApi.updateChangeRequestStatus(params);
};
