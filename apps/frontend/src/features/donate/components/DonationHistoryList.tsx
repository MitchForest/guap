import { For, Show, type Component } from 'solid-js';
import type { DonationHistoryEntry } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';

type DonationHistoryListProps = {
  entries: DonationHistoryEntry[];
};

const formatTimestamp = (value: number) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);

export const DonationHistoryList: Component<DonationHistoryListProps> = (props) => (
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-base font-semibold text-slate-900">Recent donations</p>
        <p class="text-xs text-slate-500">History of executed and pending gifts.</p>
      </div>
    </div>
    <div class="mt-4 space-y-3">
      <Show
        when={props.entries.length}
        fallback={
          <p class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No donations yet. Schedule your first gift to see it here.
          </p>
        }
      >
        <For each={props.entries}>
          {(entry) => (
            <div class="flex items-start justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">{entry.causeName}</p>
                <p class="text-xs text-slate-500">
                  {entry.status === 'executed' ? 'Completed' : 'Pending'} •{' '}
                  {formatTimestamp(entry.requestedAt)}
                </p>
                <Show when={entry.memo}>
                  {(memo) => <p class="text-xs text-slate-400">{memo()}</p>}
                </Show>
              </div>
              <div class="text-sm font-semibold text-slate-900">
                {formatCurrency(entry.amount.cents)}
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  </div>
);
