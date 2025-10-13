import type { MoneyMapSnapshot } from '@guap/api';

const snapshotCache = new Map<string, MoneyMapSnapshot | null>();

export const organizationIdFor = (householdId: string) => householdId;

export const clearMoneyMapSnapshotCache = () => {
  snapshotCache.clear();
};

export const invalidateMoneyMapSnapshot = (householdId: string) => {
  snapshotCache.delete(householdId);
};

export const setMoneyMapSnapshot = (
  householdId: string,
  snapshot: MoneyMapSnapshot | null,
) => {
  snapshotCache.set(householdId, snapshot ?? null);
};

export const getMoneyMapSnapshot = (householdId: string) =>
  snapshotCache.get(householdId) ?? null;

export const hasMoneyMapSnapshot = (householdId: string) =>
  snapshotCache.has(householdId);

export const loadMoneyMapSnapshot = async (
  householdId: string,
  loader: (organizationId: string) => Promise<MoneyMapSnapshot | null>,
) => {
  const organizationId = organizationIdFor(householdId);
  const snapshot = await loader(organizationId);
  setMoneyMapSnapshot(householdId, snapshot ?? null);
  return snapshot ?? null;
};

export const getOrLoadMoneyMapSnapshot = async (
  householdId: string,
  loader: (organizationId: string) => Promise<MoneyMapSnapshot | null>,
) => {
  if (snapshotCache.has(householdId)) {
    return snapshotCache.get(householdId) ?? null;
  }
  return await loadMoneyMapSnapshot(householdId, loader);
};

export const slugifyMoneyMap = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'money-map';

export const registerMoneyMapSlugs = (
  householdId: string,
  snapshot: MoneyMapSnapshot | null,
) => {
  const base = slugifyMoneyMap(snapshot?.map?.name ?? householdId);
  const liveSlug = `${base}-live`;
  const draftSlug = `${base}-draft`;
  return { liveSlug, draftSlug };
};
