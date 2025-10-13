import { Component, createMemo } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { formatCurrency } from '~/shared/utils/format';

const CompoundToolPage: Component = () => {
  const { incomeStreams } = useAppData();
  const annualContribution = createMemo(() =>
    incomeStreams().reduce((sum, income) => {
      switch (income.cadence) {
        case 'daily':
          return sum + income.amountCents * 365;
        case 'weekly':
          return sum + income.amountCents * 52;
        case 'biweekly':
          return sum + income.amountCents * 26;
        case 'monthly':
          return sum + income.amountCents * 12;
        case 'quarterly':
          return sum + income.amountCents * 4;
        case 'yearly':
        default:
          return sum + income.amountCents;
      }
    }, 0)
  );

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Compound Interest</h1>
        <p class="text-sm text-subtle">
          Visualize growth scenarios and graduation points along the wealth ladder.
        </p>
      </header>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Annual contribution</p>
        <p class="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(annualContribution())}</p>
        <p class="text-sm text-subtle">
          Based on current recurring inflows. Adjust rates and time horizons to see compounding effects.
        </p>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-semibold text-slate-900">Milestones</p>
        <p class="text-sm text-subtle">
          Plug in goal targets to estimate when you’ll hit each wealth ladder level using the simulator.
        </p>
      </section>
    </div>
  );
};

export default CompoundToolPage;
