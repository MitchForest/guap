
import { Show, type Component } from 'solid-js';
import { clsx } from 'clsx';
import { formatCurrency, formatPercent } from '~/shared/utils/format';
import { Button } from '~/shared/components/ui/button';

type InvestHeroProps = {
  totalCents: number;
  dailyChangeCents: number;
  changePercent: number;
  positionsCount: number;
  onCreateOrder: () => void;
};

const trendTone = (deltaCents: number) => {
  if (deltaCents > 0) return 'text-emerald-600 bg-emerald-50';
  if (deltaCents < 0) return 'text-rose-600 bg-rose-50';
  return 'text-slate-600 bg-slate-100';
};

export const InvestHero: Component<InvestHeroProps> = (props) => {
  const formattedDailyChange = () => formatCurrency(Math.abs(props.dailyChangeCents));
  const formattedPercent = () => formatPercent(Math.abs(props.changePercent) * 100, 2);
  const directionLabel = () => (props.dailyChangeCents >= 0 ? 'up' : 'down');

  return (
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Portfolio value</p>
          <p class="text-4xl font-semibold text-slate-900">{formatCurrency(props.totalCents)}</p>
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>Tracking {props.positionsCount} active {props.positionsCount === 1 ? 'position' : 'positions'}</span>
            <Show when={props.positionsCount > 0}>
              <span
                class={clsx(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                  trendTone(props.dailyChangeCents)
                )}
              >
                <span>{props.dailyChangeCents >= 0 ? '▲' : '▼'}</span>
                <span>
                  {formattedDailyChange()} ({formattedPercent()} {directionLabel()})
                </span>
              </span>
            </Show>
          </div>
        </div>
        <div class="flex flex-col gap-3 text-sm text-slate-600">
          <p>
            Orders execute against your UTMA or brokerage accounts with guardrails ensuring teens stay within
            approved ranges.
          </p>
          <div>
            <Button variant="primary" onClick={props.onCreateOrder}>
              Place order
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
