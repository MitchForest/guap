import { Component, For, createMemo } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { formatCurrency } from '~/shared/utils/format';

const EarnPage: Component = () => {
  const { incomeStreams } = useAppData();

  const grouped = createMemo(() => {
    const byCadence = new Map<string, Array<{ label: string; amountCents: number }>>();
    incomeStreams().forEach((stream) => {
      const list = byCadence.get(stream.cadence) ?? [];
      list.push({ label: stream.label, amountCents: stream.amountCents });
      byCadence.set(stream.cadence, list);
    });
    return Array.from(byCadence.entries()).map(([cadence, items]) => ({
      cadence,
      items,
    }));
  });

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Earn</h1>
        <p class="text-sm text-subtle">
          Track allowance, chores, gifts, and other income streams flowing into the plan.
        </p>
      </header>
      <section class="space-y-4">
        <For each={grouped()}>
          {(group) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.cadence} cadence
              </p>
              <div class="mt-4 space-y-3">
                <For each={group.items}>
                  {(item) => (
                    <div class="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                      <p class="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p class="text-sm text-slate-700">{formatCurrency(item.amountCents)}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-semibold text-slate-900">Upcoming tasks</p>
        <p class="text-sm text-subtle">
          Plan to add allowance confirmations, goal boosts, and reward approvals here.
        </p>
      </section>
    </div>
  );
};

export default EarnPage;
