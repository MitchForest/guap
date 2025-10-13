import {
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  type MoneyMapChangeRequestRecord,
  type MoneyMapChangeStatus,
  type MoneyMapDraft,
} from '@guap/api';
import { guapApi } from '~/services/guapApi';
import {
  clearMoneyMapSnapshotCache,
  getMoneyMapSnapshot,
  loadMoneyMapSnapshot,
  organizationIdFor,
  setMoneyMapSnapshot,
} from './cache';

export const clearMoneyMapCache = clearMoneyMapSnapshotCache;

export const loadMoneyMapGraph = async (householdId: string) => {
  const snapshot = await loadMoneyMapSnapshot(householdId, (organizationId) =>
    guapApi.loadMoneyMap(organizationId),
  );
  return {
    snapshot: snapshot ?? null,
    graph: workspaceGraphFromSnapshot(snapshot ?? null),
  };
};

export const saveMoneyMapGraph = async (params: {
  householdId: string;
  draft: MoneyMapDraft;
}) => {
  const { householdId, draft } = params;
  const snapshot = getMoneyMapSnapshot(householdId);
  const organizationId = organizationIdFor(householdId);

  const payload = createMoneyMapSaveInput({
    organizationId,
    draft,
    snapshot,
    fallbackName: snapshot?.map?.name ?? 'Money Map',
    fallbackDescription: snapshot?.map?.description,
  });

  const result = await guapApi.saveMoneyMap(payload);
  setMoneyMapSnapshot(householdId, result);

  return {
    snapshot: result,
    graph: workspaceGraphFromSnapshot(result),
  };
};

export const submitMoneyMapChangeRequest = async (params: {
  householdId: string;
  submitterId: string;
  draft: MoneyMapDraft;
  summary?: string;
}) => {
  const { householdId, submitterId, draft, summary } = params;
  const snapshot = getMoneyMapSnapshot(householdId);
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
