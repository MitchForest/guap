import type { Component } from 'solid-js';
import { For } from 'solid-js';
import type { EarnProjectionEntry } from '@guap/api';
import { DataState } from '~/shared/components/data';
import { formatCurrency } from '~/shared/utils/format';

type EarnProjectionCardProps = {
  projections: EarnProjectionEntry[];
  loading: boolean;
};

export const EarnProjectionCard: Component<EarnProjectionCardProps> = (props) => (
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-slate-900">Projected payouts</h2>
        <p class="text-sm text-slate-500">
          Upcoming allowances and chore payouts based on cadence and guardrail settings.
        </p>
      </div>
    </header>
    <DataState
      status={props.loading ? 'loading' : props.projections.length ? 'success' : 'empty'}
      loadingFallback={<div class="h-32 animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />}
      emptyFallback={
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No payouts scheduled yet. Enable auto scheduling or request allowance to populate this timeline.
        </div>
      }
    >
      <ol class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <For each={props.projections}>
          {(entry) => (
            <li class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-sm font-semibold text-slate-900">{entry.streamName}</p>
              <p class="text-2xl font-bold text-slate-900">{formatCurrency(entry.amount.cents)}</p>
              <div class="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {new Date(entry.scheduledAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span>{entry.autoScheduled ? 'Auto' : 'Manual'}</span>
              </div>
              <ul class="space-y-1 text-xs text-slate-500">
                <For each={entry.allocations}>
                  {(allocation) => (
                    <li class="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
                      <span class="truncate pr-2 font-medium text-slate-700">{allocation.nodeName}</span>
                      <span class="font-semibold text-slate-900">{allocation.percentage}%</span>
                    </li>
                  )}
                </For>
              </ul>
            </li>
          )}
        </For>
      </ol>
    </DataState>
  </section>
);
