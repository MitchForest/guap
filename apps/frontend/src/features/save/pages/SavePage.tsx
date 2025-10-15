import { For, Show, createEffect, createMemo, createSignal, type Component } from 'solid-js';
import type { SavingsGoalWithProgress, TransferRecord } from '@guap/api';
import { Link } from '@tanstack/solid-router';
import { useAppData } from '~/app/contexts/AppDataContext';
import { createSaveData } from '../state/createSaveData';
import { SaveHero } from '../components/SaveHero';
import { SavingsGoalCard } from '../components/SavingsGoalCard';
import { TransferHistoryTable } from '../components/TransferHistoryTable';
import { TransferModal } from '../components/TransferModal';
import { DataState } from '~/shared/components/data';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import { guapApi } from '~/shared/services/guapApi';
import { organizationIdFor } from '~/features/money-map/api/cache';
import { formatCurrency } from '~/shared/utils/format';
import { AppPaths } from '~/app/routerPaths';
import { notifyInfo } from '~/shared/services/notifications';

type ChartPoint = {
  capturedAt: number;
  totalCents: number;
};

const SavePage: Component = () => {
  const { accounts, activeHousehold } = useAppData();
  const householdId = createMemo(() => activeHousehold()?._id ?? null);
  const organizationId = createMemo(() => (householdId() ? organizationIdFor(householdId()!) : null));
  const saveData = createSaveData(householdId);

  const savingsAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'hysa')
  );

  const fundingAccounts = createMemo(() =>
    accounts().filter(
      (account) =>
        account.kind !== 'hysa' &&
        account.kind !== 'liability'
    )
  );

  const accountNameById = createMemo(
    () =>
      new Map(
        accounts().map((account) => [account._id, account.name] as const)
      )
  );

  const { data: heroSeries, refetch: refetchHeroSeries, isLoading: heroSeriesLoading } = createGuapQuery<
    string,
    ChartPoint[]
  >({
    source: () => {
      const household = householdId();
      const ids = savingsAccounts()
        .map((account) => account._id)
        .sort();
      if (!household || ids.length === 0) return null;
      return JSON.stringify({ household, ids });
    },
    initialValue: [] as ChartPoint[],
    fetcher: async (key) => {
      const parsed = JSON.parse(key) as { household: string; ids: string[] };
      const results = await Promise.all(
        parsed.ids.map(async (accountId) =>
          guapApi.accounts.listSnapshots(accountId, { limit: 14 })
        )
      );

      const totals = new Map<number, number>();
      results.forEach((snapshots) => {
        snapshots.forEach((snapshot) => {
          const prior = totals.get(snapshot.capturedAt) ?? 0;
          totals.set(snapshot.capturedAt, prior + snapshot.balance.cents);
        });
      });

      const sorted = Array.from(totals.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([capturedAt, totalCents]) => ({ capturedAt, totalCents }));

      if (sorted.length > 0) {
        return sorted;
      }

      const currentTotal = savingsAccounts().reduce(
        (sum, account) => sum + account.balance.cents,
        0
      );

      if (currentTotal <= 0) {
        return [];
      }

      const now = Date.now();
      return [
        { capturedAt: now - 7 * 24 * 60 * 60 * 1000, totalCents: currentTotal * 0.8 },
        { capturedAt: now, totalCents: currentTotal },
      ];
    },
  });

  const transfersQuery = createGuapQuery<string, TransferRecord[]>({
    source: householdId,
    initialValue: [] as TransferRecord[],
    fetcher: async (household) => {
      const organization = organizationIdFor(household);
      const transfers = await guapApi.transfers.list({
        organizationId: organization,
        limit: 100,
      });
      return transfers.filter((transfer) => transfer.intent === 'save');
    },
  });

  const [modalOpen, setModalOpen] = createSignal(false);
  const [modalGoal, setModalGoal] = createSignal<SavingsGoalWithProgress | null>(null);

  createEffect(() => {
    const goals = saveData.goals();
    if (goals.length && !modalGoal()) {
      setModalGoal(goals[0]);
    }
  });

  const openTransferModal = (goal: SavingsGoalWithProgress) => {
    setModalGoal(goal);
    setModalOpen(true);
  };

  const handleTransferClick = (goal: SavingsGoalWithProgress) => {
    if (!fundingAccounts().length) {
      notifyInfo('No funding account available', {
        description: 'Sync a checking account to contribute toward savings goals.',
      });
      return;
    }
    openTransferModal(goal);
  };

  const heroChartPoints = createMemo(() => heroSeries());

  const summary = createMemo(() => saveData.summary());
  const totalSavingsCents = createMemo(() =>
    savingsAccounts().reduce((sum, account) => sum + account.balance.cents, 0)
  );

  const handleTransferSubmitted = async () => {
    await saveData.refetchGoals();
    await transfersQuery.refetch();
    await refetchHeroSeries();
  };

  return (
    <div class="space-y-8">
      <SaveHero
        totalSavedCents={totalSavingsCents()}
        totalTargetCents={summary().totalTargetCents}
        totalGoals={summary().totalGoals}
        averageCompletion={summary().averageCompletion}
        chartPoints={heroChartPoints()}
        loadingChart={heroSeriesLoading()}
      />

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Goals</h2>
            <p class="text-sm text-slate-500">
              Track progress and add contributions to keep milestones on schedule.
            </p>
          </div>
        </div>

        <DataState
          status={
            saveData.goalsLoading()
              ? 'loading'
              : saveData.goals().length
                ? 'success'
                : 'empty'
          }
          loadingFallback={
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <For each={[0, 1, 2]}>
                {() => (
                  <div class="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />
                )}
              </For>
            </div>
          }
          emptyFallback={
            <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
              <p class="text-sm font-semibold text-slate-700">
                No savings goals yet
              </p>
              <p class="max-w-sm text-xs text-slate-500">
                Approve a Money Map goal pod to create a live goal, then sync contributions here.
              </p>
              <Link
                to={AppPaths.appMoneyMap}
                class="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Go to Money Map
              </Link>
            </div>
          }
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <For each={saveData.goals()}>
              {(goal) => (
                <SavingsGoalCard
                  goal={goal}
                  accountName={accountNameById().get(goal.goal.accountId)}
                  onRequestTransfer={handleTransferClick}
                />
              )}
            </For>
          </div>
        </DataState>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Contribution history</h2>
            <p class="text-sm text-slate-500">
              Review pending and completed transfers across every savings goal.
            </p>
          </div>
          <Show when={totalSavingsCents() > 0}>
            <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {formatCurrency(totalSavingsCents())} in savings
            </span>
          </Show>
        </div>

        <DataState
          status={
            transfersQuery.isLoading()
              ? 'loading'
              : transfersQuery.data().length
                ? 'success'
                : 'empty'
          }
          loadingFallback={<div class="h-40 animate-pulse rounded-2xl bg-slate-100" />}
          emptyFallback={
            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Contributions will appear here once transfers are submitted.
            </div>
          }
        >
          <TransferHistoryTable transfers={transfersQuery.data()} />
        </DataState>
      </section>

      <TransferModal
        goal={modalGoal()}
        open={modalOpen()}
        onOpenChange={setModalOpen}
        organizationId={organizationId() ?? null}
        sourceAccounts={fundingAccounts()}
        onSubmitted={handleTransferSubmitted}
      />
    </div>
  );
};

export default SavePage;
