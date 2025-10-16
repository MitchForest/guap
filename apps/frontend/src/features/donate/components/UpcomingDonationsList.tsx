import { For, Show, type Component } from 'solid-js';
import type { DonationScheduleEntry } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';

type UpcomingDonationsListProps = {
  entries: DonationScheduleEntry[];
};

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(timestamp);

export const UpcomingDonationsList: Component<UpcomingDonationsListProps> = (props) => (
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-base font-semibold text-slate-900">Upcoming donations</p>
        <p class="text-xs text-slate-500">
          Scheduled gifts awaiting execution or approval.
        </p>
      </div>
    </div>
    <div class="mt-4 space-y-3">
      <Show
        when={props.entries.length}
        fallback={
          <p class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No scheduled donations yet.
          </p>
        }
      >
        <For each={props.entries}>
          {(entry) => (
            <div class="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">{entry.causeName}</p>
                <p class="text-xs text-slate-500">
                  {entry.status === 'approved' ? 'Auto-approved' : 'Awaiting approval'} •{' '}
                  {formatDate(entry.scheduledFor)}
                </p>
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
