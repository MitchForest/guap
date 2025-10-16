import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';
import type { EarnTimelineEntry, IncomeStreamRecord } from '@guap/api';
import { DataState } from '~/shared/components/data';
import { formatCurrency } from '~/shared/utils/format';

type EarnTimelineProps = {
  entries: EarnTimelineEntry[];
  loading: boolean;
  streams: IncomeStreamRecord[];
};

const kindLabel = (entry: EarnTimelineEntry) => {
  switch (entry.kind) {
    case 'completed':
      return 'Payout completed';
    case 'skipped':
      return 'Payout skipped';
    default:
      return entry.status === 'executed' ? 'Auto payout' : 'Payout requested';
  }
};

const statusTone = (entry: EarnTimelineEntry) => {
  if (entry.kind === 'completed' || entry.status === 'executed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (entry.kind === 'skipped' || entry.status === 'canceled') {
    return 'bg-rose-100 text-rose-700';
  }
  return 'bg-amber-100 text-amber-700';
};

export const EarnTimeline: Component<EarnTimelineProps> = (props) => {
  const streamNameById = createMemo(() => {
    const map = new Map<string, string>();
    props.streams.forEach((stream) => map.set(stream._id, stream.name));
    return map;
  });

  return (
    <section class="space-y-4">
      <header>
        <h2 class="text-lg font-semibold text-slate-900">Activity</h2>
        <p class="text-sm text-slate-500">
          Recent earning requests, approvals, and skips. Auto approvals are marked as executed.
        </p>
      </header>
      <DataState
        status={props.loading ? 'loading' : props.entries.length ? 'success' : 'empty'}
        loadingFallback={<div class="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />}
        emptyFallback={
          <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No earn activity yet. Request a payout or enable auto scheduling to see updates here.
          </div>
        }
      >
        <ol class="space-y-3">
          <For each={props.entries}>
            {(entry) => {
              const streamName =
                streamNameById().get(entry.streamId) ??
                entry.streamName ??
                'Income stream';
              return (
                <li class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span
                    class={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(entry)}`}
                  >
                    {entry.kind}
                  </span>
                  <div class="flex flex-1 flex-col gap-1">
                    <p class="text-sm font-semibold text-slate-900">{kindLabel(entry)}</p>
                    <p class="text-xs text-slate-500">
                      {streamName} •{' '}
                      {new Date(entry.occurredAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <Show when={entry.amount}>
                      {(amount) => (
                        <p class="text-xs text-slate-600">
                          {formatCurrency(amount().cents)} {entry.status === 'executed' ? 'executed' : 'pending'}{' '}
                          {entry.metadata?.scheduledFor
                            ? `• scheduled ${new Date(
                                entry.metadata.scheduledFor as number
                              ).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}`
                            : ''}
                        </p>
                      )}
                    </Show>
                  </div>
                </li>
              );
            }}
          </For>
        </ol>
      </DataState>
    </section>
  );
};
