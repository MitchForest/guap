import { createColumnHelper } from '@tanstack/solid-table';
import { createSignal, type Component } from 'solid-js';
import type { TransferRecord } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';
import { DataTable } from '~/shared/components/data-table';

type ApprovalsInboxProps = {
  transfers: TransferRecord[];
};

const columnHelper = createColumnHelper<TransferRecord>();

export const transferIntentLabel = (intent: TransferRecord['intent']) => intent.replace(/_/g, ' ');

export const transferStatusLabel = (status: TransferRecord['status']) => status.replace(/_/g, ' ');

export const transferStatusTone = (status: TransferRecord['status']) => {
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'declined') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
};

export const formatSubmittedAt = (timestamp: number) => new Date(timestamp).toLocaleString();

const columns = [
  columnHelper.accessor('requestedByProfileId', {
    header: 'Requester',
    cell: (info) => (
      <span class="font-medium text-slate-900">
        {info.getValue() ?? 'Unknown member'}
      </span>
    ),
    meta: { width: '20%' },
  }),
  columnHelper.display({
    id: 'intent',
    header: 'Intent',
    cell: (info) => (
      <span class="text-sm capitalize text-slate-600">
        {transferIntentLabel(info.row.original.intent)}
      </span>
    ),
    meta: { width: '16%' },
  }),
  columnHelper.display({
    id: 'goal',
    header: 'Goal',
    cell: (info) => (
      <span class="text-sm text-slate-600">
        {(info.row.original.metadata?.goalName as string | undefined) ?? '—'}
      </span>
    ),
    meta: { width: '20%' },
  }),
  columnHelper.display({
    id: 'amount',
    header: 'Amount',
    cell: (info) => (
      <span class="text-sm font-semibold text-slate-900">
        {formatCurrency(info.row.original.amount.cents)}
      </span>
    ),
    meta: { width: '18%' },
  }),
  columnHelper.display({
    id: 'submittedAt',
    header: 'Submitted',
    cell: (info) => (
      <span class="text-xs text-slate-500">
        {formatSubmittedAt(info.row.original.requestedAt)}
      </span>
    ),
    meta: { width: '20%' },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const value = info.getValue();
      const label = transferStatusLabel(value);
      const tone = transferStatusTone(value);
      return (
        <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
          {label}
        </span>
      );
    },
    enableSorting: true,
    meta: { width: '12%' },
  }),
];

export const ApprovalsInbox: Component<ApprovalsInboxProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'list' | 'compact'>('list');

  return (
    <div class="flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold text-slate-900">Approvals</h2>
        <p class="text-sm text-slate-500">Track pending requests from students and guardians.</p>
      </header>
      <DataTable
        data={props.transfers}
        columns={columns}
        empty={<span class="text-sm text-slate-500">No approvals yet.</span>}
        toolbar={{
          summary: (items: TransferRecord[]) => <span>{items.length} total requests</span>,
          view: {
            options: [
              { id: 'list', label: 'List' },
              { id: 'compact', label: 'Compact' },
            ],
            value: viewMode,
            onChange: (mode) => setViewMode(mode as 'list' | 'compact'),
          },
        }}
      />
    </div>
  );
};
