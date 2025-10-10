import type {
  ProviderAccount,
  ProviderIncome,
  ProviderSyncResult,
  ProviderTransaction,
  ProviderUser,
} from './contracts';

type DiffRecord<T> = {
  created: T[];
  updated: Array<{ previous: T; next: T }>;
  removed: T[];
};

const isEqual = <T>(left: T, right: T) => JSON.stringify(left) === JSON.stringify(right);

const toMap = <T>(items: readonly T[] | undefined, getKey: (item: T) => string) => {
  const map = new Map<string, T>();
  for (const item of items ?? []) {
    map.set(getKey(item), item);
  }
  return map;
};

const diffCollection = <T>(
  previous: readonly T[] | undefined,
  next: readonly T[] | undefined,
  getKey: (item: T) => string
): DiffRecord<T> => {
  const previousMap = toMap(previous, getKey);
  const nextMap = toMap(next, getKey);

  const created: T[] = [];
  const updated: Array<{ previous: T; next: T }> = [];
  const removed: T[] = [];

  for (const [key, nextItem] of nextMap.entries()) {
    const previousItem = previousMap.get(key);
    if (!previousItem) {
      created.push(nextItem);
      continue;
    }
    if (!isEqual(previousItem, nextItem)) {
      updated.push({ previous: previousItem, next: nextItem });
    }
  }

  for (const [key, previousItem] of previousMap.entries()) {
    if (!nextMap.has(key)) {
      removed.push(previousItem);
    }
  }

  return { created, updated, removed };
};

export type ProviderSyncDiff = {
  accounts: DiffRecord<ProviderAccount>;
  transactions: DiffRecord<ProviderTransaction>;
  incomeStreams: DiffRecord<ProviderIncome>;
  users: DiffRecord<ProviderUser>;
};

const accountKey = (record: ProviderAccount) => record.providerAccountId;
const transactionKey = (record: ProviderTransaction) => record.providerTransactionId;
const incomeKey = (record: ProviderIncome) => record.providerIncomeId;
const userKey = (record: ProviderUser) => record.providerUserId;

export const diffProviderSync = (
  previous: ProviderSyncResult | null | undefined,
  next: ProviderSyncResult
): ProviderSyncDiff => {
  return {
    accounts: diffCollection(previous?.accounts, next.accounts, accountKey),
    transactions: diffCollection(previous?.transactions, next.transactions, transactionKey),
    incomeStreams: diffCollection(previous?.incomeStreams, next.incomeStreams, incomeKey),
    users: diffCollection(previous?.users, next.users, userKey),
  };
};
