
import { ColumnDef, createColumnHelper } from '@tanstack/solid-table';
import { createMemo, createSignal, type Component } from 'solid-js';
import type { InvestmentOrderRecord, TransferRecord } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';
import { DataTable } from '~/shared/components/data-table';

export type ApprovalsInboxProps = {
  transfers: TransferRecord[];
  orders: InvestmentOrderRecord[];
};

type ApprovalRow = {
  id: string;
  type: 'transfer' | 'order';
  requester: string;
  intent: string;
  context: string;
  amountLabel: string;
  submittedAt: number;
  statusLabel: string;
  statusTone: string;
};

const columnHelper = createColumnHelper<ApprovalRow>();

export const transferIntentLabel = (intent: TransferRecord['intent']) => intent.replace(/_/g, ' ');
export const transferStatusLabel = (status: TransferRecord['status']) => status.replace(/_/g, ' ');
export const transferStatusTone = (status: TransferRecord['status']) => {
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'declined') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
};

const orderStatusLabel = (status: InvestmentOrderRecord['status']) => status.replace(/_/g, ' ');
const orderStatusTone = (status: InvestmentOrderRecord['status']) => {
  if (status === 'awaiting_parent') return 'bg-amber-100 text-amber-700';
  if (status === 'approved' || status === 'executed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed' || status === 'canceled') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
};

export const formatSubmittedAt = (timestamp: number) => new Date(timestamp).toLocaleString();

const columns: ColumnDef<ApprovalRow, unknown>[] = [
  columnHelper.accessor('requester', {
    header: 'Requester',
    cell: (info) => <span class="font-medium text-slate-900">{info.getValue() ?? 'Unknown member'}</span>,
    meta: { width: '18%' },
  }),
  columnHelper.accessor('intent', {
    header: 'Intent',
    cell: (info) => <span class="text-sm capitalize text-slate-600">{info.getValue()}</span>,
    meta: { width: '18%' },
  }),
  columnHelper.accessor('context', {
    header: 'Context',
    cell: (info) => <span class="text-sm text-slate-600">{info.getValue()}</span>,
    meta: { width: '22%' },
  }),
  columnHelper.accessor('amountLabel', {
    header: 'Amount',
    cell: (info) => <span class="text-sm font-semibold text-slate-900">{info.getValue()}</span>,
    meta: { width: '16%' },
  }),
  columnHelper.accessor('submittedAt', {
    header: 'Submitted',
    cell: (info) => (
      <span class="text-xs text-slate-500">{formatSubmittedAt(info.getValue())}</span>
    ),
    meta: { width: '16%' },
  }),
  columnHelper.accessor('statusLabel', {
    header: 'Status',
    cell: (info) => (
      <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${info.row.original.statusTone}`}>
        {info.getValue()}
      </span>
    ),
    enableSorting: true,
    meta: { width: '10%' },
  }),
];

export const ApprovalsInbox: Component<ApprovalsInboxProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'list' | 'compact'>('list');

  const rows = createMemo<ApprovalRow[]>(() => {
    const transferRows = props.transfers.map<ApprovalRow>((transfer) => ({
      id: transfer._id,
      type: 'transfer',
      requester: transfer.requestedByProfileId ?? 'unknown',
      intent: transferIntentLabel(transfer.intent),
      context: (() => {
        const metadata = transfer.metadata ?? {};
        if (transfer.intent === 'save') {
          return (metadata.goalName as string | undefined) ?? 'Savings';
        }
        if (transfer.intent === 'credit_payoff') {
          return (metadata.destinationAccountName as string | undefined) ?? 'Credit payoff';
        }
        if (transfer.intent === 'earn') {
          return (metadata.streamName as string | undefined) ?? 'Earn payout';
        }
        return transfer.intent.replace(/_/g, ' ');
      })(),
      amountLabel: formatCurrency(transfer.amount.cents),
      submittedAt: transfer.requestedAt,
      statusLabel: transferStatusLabel(transfer.status),
      statusTone: transferStatusTone(transfer.status),
    }));

    const orderRows = props.orders.map<ApprovalRow>((order) => ({
      id: order._id,
      type: 'order',
      requester: order.placedByProfileId ?? 'unknown',
      intent: `Invest • ${order.side}`,
      context: order.symbol,
      amountLabel: formatCurrency(order.notional.cents),
      submittedAt: order.submittedAt,
      statusLabel: orderStatusLabel(order.status),
      statusTone: orderStatusTone(order.status),
    }));

    return [...transferRows, ...orderRows].sort((a, b) => b.submittedAt - a.submittedAt);
  });

  return (
    <div class="flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold text-slate-900">Approvals</h2>
        <p class="text-sm text-slate-500">Track pending transfers and investment orders.</p>
      </header>
      <DataTable
        data={rows()}
        columns={columns}
        empty={<span class="text-sm text-slate-500">No approvals yet.</span>}
        toolbar={{
          summary: (items: ApprovalRow[]) => <span>{items.length} total requests</span>,
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
