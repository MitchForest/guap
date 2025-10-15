import { For, Show, createMemo, createSignal, type Component } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { PageContainer } from '~/shared/components/layout/PageContainer';
import { DataState } from '~/shared/components/data/DataState';
import { Button } from '~/shared/components/ui/button';
import { notifyError, notifyInfo, notifySuccess } from '~/shared/services/notifications';
import { organizationIdFor } from '~/features/money-map/api/cache';
import { formatCurrency } from '~/shared/utils/format';
import { guapApi } from '~/shared/services/guapApi';
import { createSpendData } from '../state/createSpendData';
import { NeedsWantsDonut } from '../components/NeedsWantsDonut';
import { BudgetCard } from '../components/BudgetCard';
import { TransactionsTable } from '../components/TransactionsTable';
import { CreditPayoffModal, type CreditPayoffFormValues } from '../components/CreditPayoffModal';

const centsFromDollars = (value: number) => Math.round(value * 100);

const SpendPage: Component = () => {
  const { activeHousehold, accounts } = useAppData();
  const [creditModalOpen, setCreditModalOpen] = createSignal(false);

  const organizationId = createMemo(() => {
    const household = activeHousehold();
    if (!household) return null;
    return organizationIdFor(household._id);
  });

  const spendData = createSpendData(() => organizationId());

  const fundingAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'checking' || account.kind === 'hysa')
  );

  const creditAccounts = createMemo(() => accounts().filter((account) => account.kind === 'credit'));

  const totals = createMemo(() => {
    const summary = spendData.summary();
    if (!summary) {
      return {
        planned: 0,
        spent: 0,
        remaining: 0,
      };
    }
    return {
      planned: summary.totalPlanned.cents,
      spent: summary.totalSpent.cents,
      remaining: summary.totalRemaining.cents,
    };
  });

  const handleGuardrailSave = async (budgetId: string, autoApproveUpToCents: number | null) => {
    try {
      if (!organizationId()) return;
      await guapApi.budgets.updateGuardrail({
        organizationId: organizationId()!,
        budgetId,
        autoApproveUpToCents,
      });
      await Promise.all([spendData.refetchBudgets(), spendData.refetchSummary()]);
      notifySuccess('Guardrail updated', {
        description: 'Spend approvals updated for this budget.',
      });
    } catch (error) {
      notifyError('Could not update guardrail', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  const handleCreditPayoff = async (values: CreditPayoffFormValues) => {
    if (!organizationId()) {
      notifyError('No organization selected');
      return;
    }

    try {
      const result = await guapApi.transfers.initiateCreditPayoff({
        organizationId: organizationId()!,
        sourceAccountId: values.sourceAccountId,
        destinationAccountId: values.destinationAccountId,
        amount: {
          cents: centsFromDollars(values.amount),
          currency: 'USD',
        },
        memo: values.memo?.trim() ? values.memo.trim() : undefined,
      });

      const guardrail = result.guardrail;
      const description = guardrail
        ? `Approval policy: ${guardrail.approvalPolicy}`
        : 'Awaiting parent review.';

      if (result.transfer.status === 'executed') {
        notifySuccess('Payoff executed', {
          description,
        });
      } else {
        notifyInfo('Payoff pending approval', {
          description,
        });
      }

      await Promise.all([
        spendData.refetchTransactions(),
        spendData.refetchBudgets(),
        spendData.refetchSummary(),
      ]);
    } catch (error) {
      notifyError('Could not submit payoff', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  const budgetsStatus = () => {
    if (spendData.budgetsLoading()) return 'loading' as const;
    if (spendData.budgetsError()) return 'error' as const;
    return spendData.budgets().length ? ('success' as const) : ('empty' as const);
  };

  const transactionsStatus = () => {
    if (spendData.transactionsLoading()) return 'loading' as const;
    if (spendData.transactionsError()) return 'error' as const;
    return 'success' as const;
  };

  return (
    <PageContainer>
      <div class="flex flex-col gap-6">
        <header class="space-y-2">
          <h1 class="text-3xl font-semibold text-slate-900">Spend</h1>
          <p class="text-sm text-subtle">
            Track spending against guardrails, review budget performance, and approve payoff requests.
          </p>
        </header>

        <section class="grid gap-4 lg:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Planned</p>
            <p class="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totals().planned)}</p>
            <p class="text-sm text-slate-500">
              Remaining {formatCurrency(totals().remaining)} • Spent {formatCurrency(totals().spent)}
            </p>
          </div>
          <NeedsWantsDonut breakdown={spendData.needsWants()} />
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Actions</p>
            <p class="mt-2 text-sm text-slate-600">
              Initiate a credit payoff to move funds from checking into a credit account and release guardrails.
            </p>
            <Button
              variant="primary"
              class="mt-4"
              onClick={() => setCreditModalOpen(true)}
              disabled={!fundingAccounts().length || !creditAccounts().length}
            >
              Start credit payoff
            </Button>
            <Show when={!creditAccounts().length}>
              <p class="mt-2 text-xs text-amber-600">
                Sync or approve a credit account in Money Map to enable payoffs.
              </p>
            </Show>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">Budgets</h2>
          <DataState
            status={budgetsStatus()}
            loadingFallback={<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><For each={[0,1,2]}>{() => <div class="h-40 animate-pulse rounded-2xl bg-slate-100" />}</For></div>}
            emptyFallback={<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">No budgets configured yet. Approve Money Map pods to create live budgets.</div>}
            errorFallback={<div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">Unable to load budgets.</div>}
          >
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <For each={spendData.budgets()}>
                {(record) => (
                  <BudgetCard
                    record={record}
                    label={spendData.labelForBudget(record)}
                    onSaveGuardrail={(value) => handleGuardrailSave(record.budget._id, value)}
                  />
                )}
              </For>
            </div>
          </DataState>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">Transactions</h2>
          <DataState
            status={transactionsStatus()}
            loadingFallback={<div class="h-48 animate-pulse rounded-2xl bg-slate-100" />}
            errorFallback={<div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">Unable to load transactions.</div>}
          >
            <TransactionsTable
              transactions={spendData.transactions()}
              filters={spendData.filters()}
              onSearchChange={(value) => spendData.setSearch(value)}
              onNeedsVsWantsChange={(value) => spendData.setNeedsVsWants(value)}
              onSortChange={(value) => spendData.setSort(value)}
            />
          </DataState>
        </section>
      </div>

      <CreditPayoffModal
        open={creditModalOpen()}
        onOpenChange={setCreditModalOpen}
        fundingAccounts={fundingAccounts()}
        creditAccounts={creditAccounts()}
        onSubmit={async (values) => {
          await handleCreditPayoff(values);
        }}
      />
    </PageContainer>
  );
};

export default SpendPage;
