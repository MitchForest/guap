import { Component, For, Show, createMemo } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { formatCurrency, formatPercent } from '~/shared/utils/format';

const cadenceToMonthly = (amountCents: number, cadence: string) => {
  switch (cadence) {
    case 'daily':
      return amountCents * 30;
    case 'weekly':
      return amountCents * 4;
    case 'biweekly':
      return amountCents * 2;
    case 'quarterly':
      return Math.round(amountCents / 3);
    case 'yearly':
      return Math.round(amountCents / 12);
    default:
      return amountCents;
  }
};

const DashboardPage: Component = () => {
  const { accounts, incomeStreams, requests } = useAppData();

  const totalBalanceCents = createMemo(() =>
    accounts().reduce((sum, account) => sum + account.balanceCents, 0)
  );

  const savingsBalanceCents = createMemo(() =>
    accounts()
      .filter((account) => account.kind === 'hysa')
      .reduce((sum, account) => sum + account.balanceCents, 0)
  );

  const investBalanceCents = createMemo(() =>
    accounts()
      .filter((account) => account.kind === 'utma' || account.kind === 'brokerage')
      .reduce((sum, account) => sum + account.balanceCents, 0)
  );

  const monthlyIncomeCents = createMemo(() =>
    incomeStreams().reduce(
      (sum, income) => sum + cadenceToMonthly(income.amountCents, income.cadence),
      0
    )
  );

  const pendingRequests = createMemo(() => requests().filter((request) => request.state === 'pending'));

  const insights = createMemo(() => [
    {
      label: 'Total balance',
      value: formatCurrency(totalBalanceCents()),
      helper: `${accounts().length} active accounts`,
    },
    {
      label: 'Monthly inflow',
      value: formatCurrency(monthlyIncomeCents()),
      helper: `${incomeStreams().length} income streams`,
    },
    {
      label: 'Invested balance',
      value: formatCurrency(investBalanceCents()),
      helper: formatPercent(investBalanceCents() / Math.max(totalBalanceCents(), 1) * 100),
    },
  ]);

  return (
    <div class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p class="text-sm text-subtle">
          Overview of balances, income, and the moments that need attention this week.
        </p>
      </header>
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <For each={insights()}>
          {(insight) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {insight.label}
              </p>
              <p class="mt-3 text-3xl font-bold text-slate-900">{insight.value}</p>
              <p class="text-sm text-subtle">{insight.helper}</p>
            </div>
          )}
        </For>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Savings</p>
          <p class="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(savingsBalanceCents())}</p>
          <p class="text-sm text-subtle">
            {formatPercent((savingsBalanceCents() / Math.max(totalBalanceCents(), 1)) * 100)} of total funds.
          </p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pending Requests</p>
          <p class="mt-3 text-3xl font-bold text-slate-900">{pendingRequests().length}</p>
          <p class="text-sm text-subtle">Awaiting approval or action.</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next Transfer</p>
          <Show
            when={incomeStreams()[0]}
            fallback={<p class="mt-3 text-sm text-subtle">Set up automations to see what’s next.</p>}
          >
            {(income) => (
              <>
                <p class="mt-3 text-lg font-semibold text-slate-900">{income().label}</p>
                <p class="text-sm text-subtle">
                  {formatCurrency(income().amountCents)} • {income().cadence}
                </p>
              </>
            )}
          </Show>
        </div>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-slate-900">Requests &amp; activity</p>
            <p class="text-sm text-subtle">
              Track what your family needs and what was recently approved.
            </p>
          </div>
        </div>
        <div class="mt-4 space-y-4">
          <Show
            when={requests().length}
            fallback={<p class="text-sm text-subtle">No recent activity yet.</p>}
          >
            <For each={requests().slice(0, 5)}>
              {(item) => (
                <div class="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-800 capitalize">{item.kind.replace('-', ' ')}</p>
                    <p class="text-xs text-subtle">
                      {item.state === 'pending' ? 'Waiting for a decision' : `Marked ${item.state}`}
                    </p>
                  </div>
                  <Show when={item.payload?.amountCents}>
                    {(amount) => (
                      <span class="text-sm font-semibold text-slate-900">
                        {formatCurrency(amount())}
                      </span>
                    )}
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
