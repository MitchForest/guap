import { Component, For, createMemo } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { formatCurrency, formatPercent } from '~/shared/utils/format';

const InvestPage: Component = () => {
  const { accounts } = useAppData();

  const investmentAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'utma' || account.kind === 'brokerage')
  );

  const investedTotal = createMemo(() =>
    investmentAccounts().reduce((sum, account) => sum + (account.balance?.cents ?? 0), 0)
  );

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Invest</h1>
        <p class="text-sm text-subtle">
          UTMA balances, portfolio allocations, and watchlists will render in this surface.
        </p>
      </header>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invested funds</p>
        <p class="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(investedTotal())}</p>
        <p class="text-sm text-subtle">Across {investmentAccounts().length} long-term accounts.</p>
      </section>
      <section class="space-y-3">
        <For each={investmentAccounts()}>
          {(account) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{account.name}</p>
                  <p class="text-xs text-subtle">{account.kind === 'utma' ? 'UTMA Account' : 'Brokerage'}</p>
                </div>
                <p class="text-lg font-bold text-slate-900">{formatCurrency(account.balance.cents)}</p>
              </div>
              <p class="mt-3 text-sm text-subtle">
                Portfolio allocation and returns will display here. For now, aim for a balanced mix
                ({formatPercent(70)} stocks / {formatPercent(30)} bonds suggested).
              </p>
            </div>
          )}
        </For>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-semibold text-slate-900">Watchlist</p>
        <p class="text-sm text-subtle">
          Add favorite tickers to stay on top of moves you care about. This view will link into
          education content and automation triggers.
        </p>
      </section>
    </div>
  );
};

export default InvestPage;
