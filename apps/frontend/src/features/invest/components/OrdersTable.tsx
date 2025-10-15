/* eslint-disable solid/components-return-once */

import { ColumnDef, createColumnHelper } from '@tanstack/solid-table';
import { createMemo, type Component } from 'solid-js';
import type { InvestmentOrderRecord } from '@guap/types';
import { DataTable } from '~/shared/components/data-table';
import { Button } from '~/shared/components/ui/button';
import { formatCurrency } from '~/shared/utils/format';

const columnHelper = createColumnHelper<InvestmentOrderRecord>();

const statusTone = (status: InvestmentOrderRecord['status']) => {
  switch (status) {
    case 'awaiting_parent':
      return 'bg-amber-100 text-amber-700';
    case 'approved':
    case 'executed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
    case 'canceled':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

type OrdersTableProps = {
  orders: InvestmentOrderRecord[];
  onCancel: (orderId: string) => void;
};

export const OrdersTable: Component<OrdersTableProps> = (props) => {
  const columns = createMemo<ColumnDef<InvestmentOrderRecord, unknown>[]>(() => [
    columnHelper.accessor('symbol', {
      header: 'Symbol',
      cell: (info) => (
        <div class="flex flex-col">
          <span class="font-semibold text-slate-900">{info.getValue()}</span>
          <span class="text-xs uppercase tracking-[0.18em] text-slate-400">{info.row.original.side}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'quantity',
      header: 'Quantity',
      cell: (info) => (
        <span class="text-sm font-medium text-slate-700">{info.row.original.quantity.toFixed(3)}</span>
      ),
    }),
    columnHelper.display({
      id: 'notional',
      header: 'Notional',
      cell: (info) => (
        <span class="text-sm text-slate-600">{formatCurrency(info.row.original.notional.cents)}</span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(info.getValue())}`}>
          {info.getValue().replace(/_/g, ' ')}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'submittedAt',
      header: 'Submitted',
      cell: (info) => (
        <span class="text-xs text-slate-500">
          {new Date(info.row.original.submittedAt).toLocaleString()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'guardrail',
      header: 'Guardrail',
      cell: (info) => {
        const summary = info.row.original.metadata?.guardrailSummary as
          | { approvalPolicy?: string; guardrailReason?: string }
          | undefined;
        if (!summary) {
          return <span class="text-xs text-slate-400">Default policy</span>;
        }
        const label = summary.approvalPolicy === 'auto' ? 'Auto' : summary.approvalPolicy === 'admin_only' ? 'Admin' : 'Parent';
        return (
          <span class="text-xs text-slate-500">
            {label}{summary.guardrailReason ? ` • ${summary.guardrailReason}` : ''}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={info.row.original.status !== 'awaiting_parent'}
          onClick={() => props.onCancel(info.row.original._id)}
        >
          Cancel
        </Button>
      ),
    }),
  ]);

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Orders</h2>
          <p class="text-sm text-slate-500">Track submitted, pending, and executed orders.</p>
        </div>
      </div>
      <DataTable
        data={props.orders}
        columns={columns()}
        empty={<span class="text-sm text-slate-500">No orders yet.</span>}
        initialSorting={[{ id: 'submittedAt', desc: true }]}
        toolbar={{}}
      />
    </div>
  );
};
