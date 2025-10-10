import {
  Accessor,
  Component,
  JSX,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext,
} from 'solid-js';
import type { AccountRecord, HouseholdRecord, IncomeRecord, RequestRecord } from '@guap/api';
import { useAuth } from '~/contexts/AuthContext';
import { guapApi } from '~/services/guapApi';

type AppDataContextValue = {
  households: Accessor<HouseholdRecord[]>;
  activeHousehold: Accessor<HouseholdRecord | null>;
  setActiveHouseholdId: (householdId: string | null) => void;
  accounts: Accessor<AccountRecord[]>;
  incomeStreams: Accessor<IncomeRecord[]>;
  requests: Accessor<RequestRecord[]>;
};

const AppDataContext = createContext<AppDataContextValue>();

type AppDataProviderProps = {
  children: JSX.Element;
};

const AppDataProvider: Component<AppDataProviderProps> = (props) => {
  const { user } = useAuth();
  const [households, setHouseholds] = createSignal<HouseholdRecord[]>([]);
  const [accounts, setAccounts] = createSignal<AccountRecord[]>([]);
  const [incomeStreams, setIncomeStreams] = createSignal<IncomeRecord[]>([]);
  const [requests, setRequests] = createSignal<RequestRecord[]>([]);
  const [activeHouseholdId, setActiveHouseholdId] = createSignal<string | null>(null);
  const activeHousehold = createMemo(() => {
    const id = activeHouseholdId();
    if (!id) return null;
    return households().find((household) => household._id === id) ?? null;
  });
  const loadHouseholdData = async (profileId: string, preferredHouseholdId?: string | null) => {
    try {
      const fetchedHouseholds = await guapApi.listHouseholds(profileId);
      setHouseholds(fetchedHouseholds);
      if (!fetchedHouseholds.length) {
        setActiveHouseholdId(null);
        return;
      }

      const hasPreferred = preferredHouseholdId
        ? fetchedHouseholds.some((household) => household._id === preferredHouseholdId)
        : false;

      setActiveHouseholdId((current) => {
        if (current && fetchedHouseholds.some((household) => household._id === current)) {
          return current;
        }
        if (hasPreferred && preferredHouseholdId) {
          return preferredHouseholdId;
        }
        return fetchedHouseholds[0]._id;
      });
    } catch (error) {
      console.error('Failed to load households', error);
      setHouseholds([]);
      setActiveHouseholdId(null);
    }
  };
  const loadHouseholdResources = async (householdId: string) => {
    if (!householdId || !householdId.includes(':')) {
      setAccounts([]);
      setIncomeStreams([]);
      setRequests([]);
      return;
    }
    try {
      const [fetchedAccounts, fetchedIncome, fetchedRequests] = await Promise.all([
        guapApi.listAccounts(householdId),
        guapApi.listIncomeStreams(householdId),
        guapApi.listRequests(householdId),
      ]);
      setAccounts(fetchedAccounts);
      setIncomeStreams(fetchedIncome);
      setRequests(fetchedRequests);
    } catch (error) {
      console.error('Failed to load household data', error);
      setAccounts([]);
      setIncomeStreams([]);
      setRequests([]);
    }
  };
  createEffect(() => {
    const currentUser = user();
    if (currentUser?.profileId) {
      void loadHouseholdData(currentUser.profileId, currentUser.householdId ?? null);
    } else {
      setHouseholds([]);
      setActiveHouseholdId(null);
      setAccounts([]);
      setIncomeStreams([]);
      setRequests([]);
    }
  });
  createEffect(() => {
    const householdId = activeHouseholdId();
    if (householdId) {
      void loadHouseholdResources(householdId);
    } else {
      setAccounts([]);
      setIncomeStreams([]);
      setRequests([]);
    }
  });
  const filteredAccounts = createMemo(() => {
    const id = activeHouseholdId();
    if (!id) return accounts();
    return accounts().filter((account) => account.householdId === id);
  });
  const filteredIncomeStreams = createMemo(() => {
    const id = activeHouseholdId();
    if (!id) return incomeStreams();
    return incomeStreams().filter((income) => income.householdId === id);
  });
  const filteredRequests = createMemo(() => {
    const id = activeHouseholdId();
    if (!id) return requests();
    return requests().filter((request) => request.householdId === id);
  });
  return (
    <AppDataContext.Provider
      value={{
        households,
        activeHousehold,
        setActiveHouseholdId,
        accounts: filteredAccounts,
        incomeStreams: filteredIncomeStreams,
        requests: filteredRequests,
      }}
    >
      {props.children}
    </AppDataContext.Provider>
  );
};

const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};

export { AppDataProvider, useAppData };
