import { Component, For, createMemo } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { formatCurrency } from '~/shared/utils/format';

const SpendPage: Component = () => {
  const { accounts } = useAppData();

  const spendAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'checking' || account.kind === 'credit')
  );

  const checkingBalance = createMemo(() =>
    spendAccounts()
      .filter((account) => account.kind === 'checking')
      .reduce((sum, account) => sum + account.balanceCents, 0)
  );

  const creditBalance = createMemo(() =>
    spendAccounts()
      .filter((account) => account.kind === 'credit')
      .reduce((sum, account) => sum + account.balanceCents, 0)
  );

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Spend</h1>
        <p class="text-sm text-subtle">
          Checking and secured credit activity, categorized insights, and needs vs. wants splits.
        </p>
      </header>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checking balance</p>
        <p class="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(checkingBalance())}</p>
        <p class="text-sm text-subtle">Active cards pull from these funds when automations trigger.</p>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Credit usage</p>
        <p class="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(creditBalance())}</p>
        <p class="text-sm text-subtle">Keep balances low to build credit safely.</p>
      </section>
      <section class="space-y-3">
        <For each={spendAccounts()}>
          {(account) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{account.name}</p>
                  <p class="text-xs text-subtle uppercase tracking-[0.18em]">{account.kind}</p>
                </div>
                <div class="text-right">
                  <p class="text-lg font-bold text-slate-900">{formatCurrency(account.balanceCents)}</p>
                  <p class="text-xs text-subtle">
                    Available {formatCurrency(account.availableCents ?? account.balanceCents)}
                  </p>
                </div>
              </div>
              <p class="mt-3 text-sm text-subtle">
                Needs-vs-wants categorisation and transaction history will slot in here.
              </p>
            </div>
          )}
        </For>
      </section>
    </div>
  );
};

export default SpendPage;
