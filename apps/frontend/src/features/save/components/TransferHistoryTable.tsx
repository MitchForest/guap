import { createColumnHelper } from '@tanstack/solid-table';
import type { Component } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';
import type { TransferRecord } from '@guap/api';
import { DataTable } from '~/shared/components/data-table';
import { formatCurrency } from '~/shared/utils/format';
import {
  transferStatusLabel,
  transferStatusTone,
} from '~/features/app-shell/components/ApprovalsInbox';

type TransferHistoryTableProps = {
  transfers: TransferRecord[];
};

const columnHelper = createColumnHelper<TransferRecord>();

const formatTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(timestamp)
    : '—';

export const TransferHistoryTable: Component<TransferHistoryTableProps> = (props) => {
  const [search, setSearch] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<'all' | 'pending' | 'executed'>('all');

  const filteredTransfers = createMemo(() => {
    const term = search().trim().toLowerCase();
    const status = statusFilter();
    return props.transfers.filter((transfer) => {
      const goalName =
        typeof transfer.metadata?.goalName === 'string'
          ? transfer.metadata.goalName.toLowerCase()
          : '';
      if (term && !goalName.includes(term)) {
        return false;
      }
      if (status === 'pending' && transfer.status !== 'pending_approval') {
        return false;
      }
      if (status === 'executed' && transfer.status !== 'executed') {
        return false;
      }
      return true;
    });
  });

  const columns = [
    columnHelper.display({
      id: 'goal',
      header: 'Goal',
      cell: (info) =>
        (info.row.original.metadata?.goalName as string | undefined) ?? 'Household transfer',
      meta: { width: '26%' },
    }),
    columnHelper.display({
      id: 'amount',
      header: 'Amount',
      cell: (info) => (
        <span class="font-semibold text-slate-900">
          {formatCurrency(info.row.original.amount.cents)}
        </span>
      ),
      meta: { width: '18%' },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue();
        const tone = transferStatusTone(status);
        return (
          <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
            {transferStatusLabel(status)}
          </span>
        );
      },
      enableSorting: true,
      meta: { width: '14%' },
    }),
    columnHelper.display({
      id: 'requestedAt',
      header: 'Requested',
      cell: (info) => (
        <span class="text-xs text-slate-500">{formatTimestamp(info.row.original.requestedAt)}</span>
      ),
      meta: { width: '18%' },
    }),
    columnHelper.display({
      id: 'executedAt',
      header: 'Completed',
      cell: (info) => (
        <span class="text-xs text-slate-500">{formatTimestamp(info.row.original.executedAt)}</span>
      ),
      meta: { width: '18%' },
    }),
  ];

  return (
    <DataTable
      data={filteredTransfers()}
      columns={columns}
      empty={
        <span class="text-sm text-slate-500">
          No save transfers yet. Contributions will appear here once submitted.
        </span>
      }
      toolbar={{
        search: {
          placeholder: 'Search goals…',
          value: () => search(),
          onChange: (value) => setSearch(value),
        },
        filters: [
          {
            id: 'all',
            label: 'All',
            active: statusFilter() === 'all',
            onToggle: () => setStatusFilter('all'),
          },
          {
            id: 'pending',
            label: 'Pending approval',
            active: statusFilter() === 'pending',
            onToggle: () =>
              setStatusFilter((current) => (current === 'pending' ? 'all' : 'pending')),
          },
          {
            id: 'executed',
            label: 'Completed',
            active: statusFilter() === 'executed',
            onToggle: () =>
              setStatusFilter((current) => (current === 'executed' ? 'all' : 'executed')),
          },
        ],
        summary: (rows) => (
          <span>
            Showing {rows.length} {rows.length === 1 ? 'transfer' : 'transfers'}
          </span>
        ),
      }}
    />
  );
};
