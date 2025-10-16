import type { Component } from 'solid-js';
import { For } from 'solid-js';
import type { IncomeStreamRecord } from '@guap/api';
import { Button } from '~/shared/components/ui/button';
import { DataState } from '~/shared/components/data';
import { formatCurrency } from '~/shared/utils/format';

type IncomeStreamListProps = {
  streams: IncomeStreamRecord[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (stream: IncomeStreamRecord) => void;
  onRequest: (stream: IncomeStreamRecord) => void;
  onSkip: (stream: IncomeStreamRecord) => void;
  onToggleAuto: (stream: IncomeStreamRecord, nextValue: boolean) => void;
  onStatusChange: (stream: IncomeStreamRecord, status: IncomeStreamRecord['status']) => void;
};

const cadenceLabel = (cadence: IncomeStreamRecord['cadence']) => {
  switch (cadence) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every other week';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    case 'daily':
    default:
      return 'Daily';
  }
};

const nextScheduledLabel = (stream: IncomeStreamRecord) => {
  if (!stream.nextScheduledAt) return stream.autoSchedule ? 'Not scheduled' : 'Manual';
  return new Date(stream.nextScheduledAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const statusLabel = (status: IncomeStreamRecord['status']) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
};

const statusTone = (status: IncomeStreamRecord['status']) => {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'paused') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-200 text-slate-600';
};

export const IncomeStreamList: Component<IncomeStreamListProps> = (props) => (
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-slate-900">Income streams</h2>
        <p class="text-sm text-slate-500">
          Manage allowances, chores, and side gigs. Toggle auto scheduling or request payouts.
        </p>
      </div>
      <Button onClick={() => props.onCreate()}>New stream</Button>
    </header>
    <DataState
      status={props.loading ? 'loading' : props.streams.length ? 'success' : 'empty'}
      loadingFallback={
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <For each={[0, 1, 2]}>
            {() => <div class="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />}
          </For>
        </div>
      }
      emptyFallback={
        <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <p class="text-sm font-semibold text-slate-700">No income streams yet</p>
          <p class="max-w-sm text-xs text-slate-500">
            Add allowance or chore schedules to automate payouts and guardrail approvals.
          </p>
          <Button variant="secondary" onClick={() => props.onCreate()}>
            Create stream
          </Button>
        </div>
      }
    >
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <For each={props.streams}>
          {(stream) => (
            <article class="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <header class="flex items-start justify-between">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <h3 class="text-base font-semibold text-slate-900">{stream.name}</h3>
                    <span class={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(stream.status)}`}>
                      {statusLabel(stream.status)}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500">{cadenceLabel(stream.cadence)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => props.onEdit(stream)}>
                  Edit
                </Button>
              </header>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500">Amount</p>
                  <p class="text-lg font-semibold text-slate-900">{formatCurrency(stream.amount.cents)}</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500">Next</p>
                  <p class="text-sm font-semibold text-slate-800">{nextScheduledLabel(stream)}</p>
                </div>
              </div>
              <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Auto-schedule
                  </p>
                  <p class="text-xs text-slate-500">
                    {stream.autoSchedule ? 'Runs on cadence automatically' : 'Requires manual request'}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => props.onToggleAuto(stream, !stream.autoSchedule)}
                  disabled={stream.status !== 'active'}
                >
                  {stream.autoSchedule ? 'Disable' : 'Enable'}
                </Button>
              </div>
              <footer class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => props.onRequest(stream)}>
                    Request payout
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => props.onSkip(stream)}>
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      props.onStatusChange(
                        stream,
                        stream.status === 'active' ? 'paused' : 'active'
                      )
                    }
                    disabled={stream.status === 'archived'}
                  >
                    {stream.status === 'active' ? 'Pause' : stream.status === 'paused' ? 'Resume' : 'Archived'}
                  </Button>
                </div>
                <p class="text-xs text-slate-500">
                  {stream.requiresApproval ? 'Parent approval required' : 'Auto-approve up to guardrail'}
                </p>
              </footer>
            </article>
          )}
        </For>
      </div>
    </DataState>
  </section>
);
