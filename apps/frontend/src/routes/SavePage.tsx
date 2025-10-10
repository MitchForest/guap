import { Component, For, createMemo } from 'solid-js';
import { useAppData } from '~/contexts/AppDataContext';
import { formatCurrency } from '~/utils/format';

const SavePage: Component = () => {
  const { accounts } = useAppData();

  const savingsAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'hysa')
  );

  const totalSavings = createMemo(() =>
    savingsAccounts().reduce((sum, account) => sum + account.balanceCents, 0)
  );

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Save</h1>
        <p class="text-sm text-subtle">
          High-yield accounts, goals, and progress toward the next milestone live here.
        </p>
      </header>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total saved</p>
        <p class="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(totalSavings())}</p>
        <p class="text-sm text-subtle">Across {savingsAccounts().length} dedicated savings accounts.</p>
      </section>
      <section class="space-y-3">
        <For each={savingsAccounts()}>
          {(account) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{account.name}</p>
                  <p class="text-xs text-subtle">High-yield savings</p>
                </div>
                <p class="text-lg font-bold text-slate-900">{formatCurrency(account.balanceCents)}</p>
              </div>
              <p class="mt-3 text-sm text-subtle">
                Automations and recurring transfers will appear here as we wire them in.
              </p>
            </div>
          )}
        </For>
      </section>
    </div>
  );
};

export default SavePage;
