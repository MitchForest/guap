import { Component, For } from 'solid-js';

const WealthLadderPage: Component = () => {
  const milestones = [
    { level: 'Level 1', range: '$0 – $10k', focus: 'Emergency fund, basics covered' },
    { level: 'Level 2', range: '$10k – $100k', focus: 'Investing habit & debt control' },
    { level: 'Level 3', range: '$100k – $1M', focus: 'Scale investing & longer-term goals' },
    { level: 'Level 4', range: '$1M – $10M', focus: 'Advanced strategies & philanthropy' },
  ];

  return (
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">Wealth Ladder</h1>
        <p class="text-sm text-subtle">
          Track progress across ladder levels and understand what each unlocks.
        </p>
      </header>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-semibold text-slate-900">Current level</p>
        <p class="text-sm text-subtle">
          Use the automations and savings tools to climb to the next milestone. Progress will update
          automatically as balances grow.
        </p>
      </section>
      <section class="space-y-3">
        <For each={milestones}>
          {(milestone) => (
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {milestone.level}
              </p>
              <p class="mt-2 text-lg font-semibold text-slate-900">{milestone.range}</p>
              <p class="text-sm text-subtle">Focus: {milestone.focus}</p>
            </div>
          )}
        </For>
      </section>
    </div>
  );
};

export default WealthLadderPage;
