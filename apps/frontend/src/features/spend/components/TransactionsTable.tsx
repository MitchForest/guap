import { createColumnHelper } from '@tanstack/solid-table';
import type { Component } from 'solid-js';
import type { TransactionRecord } from '@guap/api';
import { DataTable } from '~/shared/components/data-table';
import { formatCurrency } from '~/shared/utils/format';
import type { SpendFilters } from '../state/createSpendData';

export type TransactionsTableProps = {
  transactions: TransactionRecord[];
  filters: SpendFilters;
  onSearchChange: (value: string) => void;
  onNeedsVsWantsChange: (value: SpendFilters['needsVsWants']) => void;
  onSortChange: (value: SpendFilters['sort']) => void;
};

const columnHelper = createColumnHelper<TransactionRecord>();

const formatDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);

export const TransactionsTable: Component<TransactionsTableProps> = (props) => {
  const columns = [
    columnHelper.display({
      id: 'merchant',
      header: 'Merchant',
      cell: (info) => (
        <div class="flex flex-col">
          <span class="font-semibold text-slate-900">
            {info.row.original.merchantName ?? info.row.original.description}
          </span>
          <span class="text-xs text-slate-500">{info.row.original.description}</span>
        </div>
      ),
      meta: { width: '26%' },
    }),
    columnHelper.display({
      id: 'category',
      header: 'Category',
      cell: (info) => info.row.original.categoryKey ?? 'Uncategorized',
      meta: { width: '18%' },
    }),
    columnHelper.display({
      id: 'needsVsWants',
      header: 'Needs/Wants',
      cell: (info) => info.row.original.needsVsWants ?? '—',
      meta: { width: '14%' },
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => (
        <span class="font-semibold text-slate-900">{formatCurrency(info.getValue().cents)}</span>
      ),
      meta: { width: '14%' },
    }),
    columnHelper.display({
      id: 'occurredAt',
      header: 'Date',
      cell: (info) => (
        <span class="text-xs text-slate-500">{formatDateTime(info.row.original.occurredAt)}</span>
      ),
      meta: { width: '16%' },
    }),
    columnHelper.display({
      id: 'source',
      header: 'Source',
      cell: (info) => info.row.original.source,
      meta: { width: '12%' },
    }),
  ];

  const sortOptions: Array<{ label: string; value: SpendFilters['sort'] }> = [
    { label: 'Newest', value: '-occurredAt' },
    { label: 'Oldest', value: 'occurredAt' },
    { label: 'Largest', value: '-amount' },
    { label: 'Smallest', value: 'amount' },
  ];

  const filters = [
    { id: 'all', label: 'All', value: 'all' as const },
    { id: 'needs', label: 'Needs', value: 'needs' as const },
    { id: 'wants', label: 'Wants', value: 'wants' as const },
    { id: 'neutral', label: 'Neutral', value: 'neutral' as const },
  ];

  return (
    <DataTable
      data={props.transactions}
      columns={columns}
      empty={<span class="text-sm text-slate-500">No transactions yet.</span>}
      toolbar={{
        search: {
          placeholder: 'Search merchant…',
          value: () => props.filters.search,
          onChange: props.onSearchChange,
        },
        filters: filters.map((filter) => ({
          id: filter.id,
          label: filter.label,
          active: props.filters.needsVsWants === filter.value,
          onToggle: () => props.onNeedsVsWantsChange(filter.value),
        })),
        actions: (
          <select
            class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={props.filters.sort}
            onChange={(event) => props.onSortChange(event.currentTarget.value as SpendFilters['sort'])}
          >
            {sortOptions.map((option) => (
              <option value={option.value}>{option.label}</option>
            ))}
          </select>
        ),
        summary: (items) => <span>{items.length} transactions</span>,
      }}
    />
  );
};
