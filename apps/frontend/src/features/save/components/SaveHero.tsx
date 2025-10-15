import { Show, type Component } from 'solid-js';
import { formatCurrency, formatPercent } from '~/shared/utils/format';
import { DataState } from '~/shared/components/data';
import { Sparkline } from './Sparkline';

type SaveHeroProps = {
  totalSavedCents: number;
  totalTargetCents: number;
  totalGoals: number;
  averageCompletion: number;
  chartPoints: Array<{ capturedAt: number; totalCents: number }>;
  loadingChart: boolean;
};

const formatDateLabel = (timestamp: number) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp);

export const SaveHero: Component<SaveHeroProps> = (props) => {
  const completionPercent = () => Math.min(1, props.averageCompletion);
  const deltaCents = () => Math.max(0, props.totalTargetCents - props.totalSavedCents);

  const sparklinePoints = () =>
    props.chartPoints.map((point) => ({
      value: point.totalCents,
    }));

  const firstLabel = () =>
    props.chartPoints.length ? formatDateLabel(props.chartPoints[0].capturedAt) : null;
  const lastLabel = () =>
    props.chartPoints.length
      ? formatDateLabel(props.chartPoints[props.chartPoints.length - 1].capturedAt)
      : null;

  return (
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total saved
          </p>
          <p class="text-4xl font-semibold text-slate-900">
            {formatCurrency(props.totalSavedCents)}
          </p>
          <Show when={props.totalTargetCents > 0}>
            <p class="text-sm text-slate-500">
              {formatCurrency(deltaCents())} remaining toward household targets (
              {formatPercent(completionPercent() * 100, 0)} complete)
            </p>
          </Show>
          <p class="text-xs text-slate-400">
            Tracking {props.totalGoals} active {props.totalGoals === 1 ? 'goal' : 'goals'}
          </p>
        </div>
        <div class="flex flex-col items-stretch gap-2 lg:w-72">
          <DataState
            status={props.loadingChart ? 'loading' : props.chartPoints.length ? 'success' : 'empty'}
            loadingFallback={<div class="h-24 animate-pulse rounded-xl bg-slate-100" />}
            emptyFallback={
              <div class="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                <span>No trend data yet</span>
                <span>Sync contributions to populate the timeline.</span>
              </div>
            }
          >
            <div class="flex flex-col gap-1">
              <Sparkline points={sparklinePoints()} />
              <Show when={firstLabel() && lastLabel()}>
                <div class="flex justify-between text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <span>{firstLabel()}</span>
                  <span>{lastLabel()}</span>
                </div>
              </Show>
            </div>
          </DataState>
        </div>
      </div>
    </section>
  );
};
