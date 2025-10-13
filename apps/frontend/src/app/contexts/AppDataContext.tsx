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
import { HouseholdRecordSchema } from '@guap/types';
import { useAuth } from '~/app/contexts/AuthContext';
import type { AuthUser } from '~/app/contexts/AuthContext';

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
  const [accounts] = createSignal<AccountRecord[]>([]);
  const [incomeStreams] = createSignal<IncomeRecord[]>([]);
  const [requests] = createSignal<RequestRecord[]>([]);
  const [activeHouseholdId, setActiveHouseholdId] = createSignal<string | null>(null);
  const activeHousehold = createMemo(() => {
    const id = activeHouseholdId();
    if (!id) return null;
    return households().find((household) => household._id === id) ?? null;
  });
  const toSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'household';

  const loadHouseholdData = (authUser: AuthUser | null) => {
    if (!authUser?.householdId) {
      setHouseholds([]);
      setActiveHouseholdId(null);
      return;
    }

    try {
      const household = HouseholdRecordSchema.parse({
        _id: authUser.householdId,
        name: authUser.displayName ? `${authUser.displayName}'s Household` : 'Household',
        slug: toSlug(authUser.householdId),
        plan: 'free',
        planStatus: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setHouseholds([household]);
      setActiveHouseholdId(household._id);
    } catch (error) {
      console.error('Failed to derive household from auth session', error);
      setHouseholds([]);
      setActiveHouseholdId(null);
    }
  };

  createEffect(() => {
    const currentUser = user();
    loadHouseholdData(currentUser ?? null);
  });
  const filteredAccounts = createMemo(() => accounts());
  const filteredIncomeStreams = createMemo(() => incomeStreams());
  const filteredRequests = createMemo(() => requests());
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
