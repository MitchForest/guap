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
import { createGuapQuery } from '~/shared/services/queryHelpers';
import { guapApi } from '~/shared/services/guapApi';
import { organizationIdFor } from '~/features/money-map/api/cache';

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
  const [activeHouseholdId, setActiveHouseholdId] = createSignal<string | null>(null);
  const { data: accountsResource } = createGuapQuery({
    source: activeHouseholdId,
    initialValue: [] as AccountRecord[],
    fetcher: async (householdId) => {
      const snapshot = await guapApi.loadMoneyMap(organizationIdFor(householdId));
      if (!snapshot) {
        return [];
      }
      return snapshot.nodes
        .filter((node) => node.kind === 'account')
        .map((node) => {
          const balanceCents = typeof node.metadata?.balanceCents === 'number' ? node.metadata.balanceCents : 0;
          return {
            _id: String(node._id ?? node.key),
            householdId,
            ownerProfileId: null,
            name: node.label,
            kind: 'checking',
            status: 'active',
            currency: 'USD',
            balanceCents,
            availableCents: balanceCents,
            metadata: { moneyMapNodeKey: node.key },
            createdAt: node.createdAt ?? Date.now(),
            updatedAt: node.updatedAt ?? Date.now(),
          } satisfies AccountRecord;
        });
    },
  });

  const { data: requestsResource } = createGuapQuery({
    source: activeHouseholdId,
    initialValue: [] as RequestRecord[],
    fetcher: async (householdId) => {
      const organizationId = organizationIdFor(householdId);
      const changeRequests = await guapApi.listChangeRequests(organizationId);
      const stateFromStatus = (status: string): RequestRecord['state'] => {
        switch (status) {
          case 'approved':
            return 'approved';
          case 'rejected':
            return 'rejected';
          case 'withdrawn':
            return 'rejected';
          default:
            return 'pending';
        }
      };
      return changeRequests.map((request) => ({
        _id: request._id,
        householdId,
        createdByProfileId: request.submitterId,
        assignedToProfileId: null,
        kind: 'money_map_change',
        state: stateFromStatus(request.status),
        payload: { summary: request.summary ?? null },
        resolvedByProfileId: null,
        resolvedAt: request.resolvedAt ?? undefined,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      } satisfies RequestRecord));
    },
  });

  const { data: incomeStreamsResource } = createGuapQuery({
    source: activeHouseholdId,
    initialValue: [] as IncomeRecord[],
    fetcher: async () => [] as IncomeRecord[],
  });
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
  const filteredAccounts = createMemo(() => accountsResource());
  const filteredIncomeStreams = createMemo(() => incomeStreamsResource());
  const filteredRequests = createMemo(() => requestsResource());
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
