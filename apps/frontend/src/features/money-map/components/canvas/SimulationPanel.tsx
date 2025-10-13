import { Motion } from 'solid-motionone';
import { Accessor, For, Show, createMemo } from 'solid-js';
import type { SimulationResult } from '~/features/money-map/utils/simulation';
import { currencyFormatter, formatMonths } from '~/features/money-map/utils/format';
import { Button } from '~/shared/components/ui/button';
import type { SelectOption } from '~/shared/components/ui/select';
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/shared/components/ui/select';

type SimulationPanelProps = {
  open: Accessor<boolean>;
  result: Accessor<SimulationResult | null>;
  settings: Accessor<{ horizonYears: number }>;
  horizonOptions: readonly SelectOption[];
  onRun: (years?: number) => void;
  onClose: () => void;
  getNodeLabel: (id: string) => string;
};

const SimulationPanel = (props: SimulationPanelProps) => {
  const horizonYears = createMemo(() => props.settings().horizonYears);
  const topBalances = createMemo(() => {
    const current = props.result();
    if (!current) return [];
    return Object.entries(current.finalBalances)
      .map(([id, value]) => ({
        id,
        value,
        label: props.getNodeLabel(id),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  });

  return (
    <div
      class="absolute left-0 top-0 z-40 h-full w-[360px]"
      classList={{ 'pointer-events-none': !props.open() }}
    >
      <Motion.div
        class="flex h-full flex-col border-r border-slate-200/70 bg-white shadow-xl"
        initial={{ x: -360, opacity: 0 }}
        animate={{ x: props.open() ? 0 : -360, opacity: props.open() ? 1 : 0.4 }}
        transition={{ duration: 0.2, easing: [0.16, 1, 0.3, 1] }}
      >
        <Show when={props.result()}>
          {(result) => (
            <aside class="flex h-full flex-col">
              <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div class="space-y-1">
                  <h2 class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Projection</h2>
                  <p class="text-2xl font-bold text-slate-900 tracking-tight">
                    {currencyFormatter.format(result().finalTotal)}
                  </p>
                  <p class="text-xs text-slate-500">Total Portfolio Value</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  class="rounded-lg uppercase tracking-[0.18em]"
                  onClick={props.onClose}
                >
                  Close
                </Button>
              </div>
              <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <section class="space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                      Horizon
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      class="rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                      onClick={() => props.onRun(horizonYears())}
                    >
                      ↻ Re-run
                    </Button>
                  </div>
                  <Select
                    options={[...props.horizonOptions]}
                    optionValue="value"
                    optionTextValue="label"
                    value={
                      props.horizonOptions.find(
                        (option) => Number(option.value) === horizonYears()
                      ) ?? props.horizonOptions[1]
                    }
                    onChange={(option) => props.onRun(Number(option?.value ?? horizonYears()))}
                    placeholder={<span class="truncate text-slate-400">Select horizon</span>}
                    itemComponent={(itemProps) => <SelectItem {...itemProps} />}
                  >
                    <SelectTrigger
                      class="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
                      aria-label="Simulation horizon"
                    >
                      <SelectValue<SelectOption>>
                        {(state) => <span>{state.selectedOption()?.label ?? `${horizonYears()} Years`}</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                    <SelectHiddenSelect name="simulation-horizon" />
                  </Select>
                </section>

                <section class="space-y-2">
                  <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Wealth Ladder
                  </h3>
                  <div class="space-y-2">
                    <For each={result().milestones}>
                      {(milestone) => {
                        const reached = milestone.reachedAtMonth !== null;
                        const progress = reached
                          ? 100
                          : Math.max(
                              0,
                              Math.min(100, (result().finalTotal / milestone.threshold) * 100)
                            );
                        const statusLabel = reached ? formatMonths(milestone.reachedAtMonth) : 'Not yet';
                        const progressTone = reached ? 'bg-emerald-500' : 'bg-slate-400';
                        return (
                          <div class="space-y-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                            <div class="flex items-center justify-between text-sm font-semibold text-slate-700">
                              <span>{milestone.label}</span>
                              <span class="text-xs font-medium text-slate-500">{statusLabel}</span>
                            </div>
                            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                class={`h-full rounded-full transition-all duration-300 ${progressTone}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p class="text-[11px] font-medium text-slate-500">
                              {progress >= 100
                                ? `Reached ${currencyFormatter.format(milestone.threshold)}`
                                : `${progress.toFixed(0)}% of ${currencyFormatter.format(
                                    milestone.threshold
                                  )}`}
                            </p>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </section>

                <section class="space-y-2">
                  <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Top Balances
                  </h3>
                  <div class="space-y-2">
                    <For each={topBalances()}>
                      {(entry) => {
                        const maxValue = topBalances()[0]?.value ?? 1;
                        const percentage = (entry.value / maxValue) * 100;
                        return (
                          <div class="space-y-1.5">
                            <div class="flex items-center justify-between text-sm font-semibold text-slate-700">
                              <span class="truncate">{entry.label}</span>
                              <span class="text-xs font-semibold text-slate-500">
                                {currencyFormatter.format(entry.value)}
                              </span>
                            </div>
                            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                class="h-full rounded-full bg-slate-500"
                                style={{ width: `${Math.max(6, percentage)}%` }}
                              />
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </section>

                <section class="space-y-2">
                  <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Month-by-month
                  </h3>
                  <div class="space-y-2 rounded-xl border border-slate-200/70 bg-white">
                    <For each={result().points.slice(1, 13)}>
                      {(point) => (
                        <div class="grid grid-cols-2 items-center px-4 py-3 text-xs font-semibold text-slate-600">
                          <span>Month {point.month}</span>
                          <span class="text-right text-slate-900">
                            {currencyFormatter.format(point.total)}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </section>

                <section class="space-y-2 pb-6">
                  <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Final Balances
                  </h3>
                  <div class="space-y-2 rounded-xl border border-slate-200/70 bg-white">
                    <For each={Object.entries(result().finalBalances)}>
                      {([nodeId, balance]) => (
                        <div class="grid grid-cols-2 items-center px-4 py-3 text-xs font-semibold text-slate-600">
                          <span class="truncate">{props.getNodeLabel(nodeId)}</span>
                          <span class="text-right text-slate-900">
                            {currencyFormatter.format(balance)}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </div>
            </aside>
          )}
        </Show>
      </Motion.div>
    </div>
  );
};

export { SimulationPanel };
