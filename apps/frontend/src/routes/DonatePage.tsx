import { Component, For } from 'solid-js';
import { useAppData } from '~/contexts/AppDataContext';
import { formatCurrency } from '~/utils/format';

const DonatePage: Component = () => {
  const { accounts } = useAppData();
  const donationAccounts = () => accounts().filter((account) => account.kind === 'donation');

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Donate</h1>
        <p class="text-sm text-subtle">
          Capture giving accounts, matched contributions, and history of donations.
        </p>
      </header>
      <section class="space-y-3">
        <For each={donationAccounts()}>
          {(account) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{account.name}</p>
                  <p class="text-xs text-subtle">Designated giving account</p>
                </div>
                <p class="text-lg font-bold text-slate-900">{formatCurrency(account.balanceCents)}</p>
              </div>
              <p class="mt-3 text-sm text-subtle">
                Add causes to commit regular support or schedule one-time gifts here.
              </p>
            </div>
          )}
        </For>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-semibold text-slate-900">Causes</p>
        <p class="text-sm text-subtle">
          Build a list of organizations to support. Matching automations and parent approvals will
          plug in soon.
        </p>
      </section>
    </div>
  );
};

export default DonatePage;
