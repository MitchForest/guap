import { ColumnDef, createColumnHelper } from '@tanstack/solid-table';
import { createMemo, createSignal, Show, type Component } from 'solid-js';
import type { InvestmentOrderRecord, TransferRecord } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';
import { DataTable } from '~/shared/components/data-table';
import { Button } from '~/shared/components/ui/button';
import { guardrailReasonLabel } from '~/shared/utils/guardrails';
import { downloadCsv } from '~/shared/utils/csv';
import { notifyError, notifySuccess } from '~/shared/services/notifications';
import { guapApi } from '~/shared/services/guapApi';

export type ApprovalsInboxProps = {
  transfers: TransferRecord[];
  orders: InvestmentOrderRecord[];
  onRefresh?: () => Promise<void>;
};

type IntentFilter =
  | 'all'
  | 'earn'
  | 'save'
  | 'donate'
  | 'spend'
  | 'credit_payoff'
  | 'invest'
  | 'manual'
  | 'other';

type StatusFilter =
  | 'all'
  | 'pending_review'
  | 'pending_approval'
  | 'awaiting_parent'
  | 'approved'
  | 'executed'
  | 'declined';

type ApprovalRow = {
  key: string;
  id: string;
  type: 'transfer' | 'order';
  organizationId: string;
  requester: string;
  intent: string;
  intentCategory: IntentFilter;
  context: string;
  amountLabel: string;
  amountCents: number;
  submittedAt: number;
  status: string;
  statusLabel: string;
  statusTone: string;
  guardrailReason: string | null;
  transfer?: TransferRecord;
  order?: InvestmentOrderRecord;
};

const columnHelper = createColumnHelper<ApprovalRow>();

const INTENT_LABELS: Record<IntentFilter, string> = {
  all: 'All',
  earn: 'Earn',
  save: 'Save',
  donate: 'Donate',
  spend: 'Spend',
  credit_payoff: 'Credit payoff',
  invest: 'Invest',
  manual: 'Manual',
  other: 'Other',
};

const INTENT_PRIORITY: IntentFilter[] = [
  'all',
  'earn',
  'save',
  'donate',
  'spend',
  'credit_payoff',
  'invest',
  'manual',
  'other',
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_review', label: 'Needs review' },
  { value: 'pending_approval', label: 'Transfers pending' },
  { value: 'awaiting_parent', label: 'Orders pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'executed', label: 'Executed' },
  { value: 'declined', label: 'Declined' },
];

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

const intentCategoryForTransfer = (intent: TransferRecord['intent']): IntentFilter => {
  switch (intent) {
    case 'earn':
      return 'earn';
    case 'save':
      return 'save';
    case 'donate':
      return 'donate';
    case 'spend':
      return 'spend';
    case 'credit_payoff':
      return 'credit_payoff';
    case 'manual':
      return 'manual';
    default:
      return 'other';
  }
};

const summarizeTransferContext = (transfer: TransferRecord) => {
  const metadata = (transfer.metadata ?? {}) as Record<string, unknown>;
  if (transfer.intent === 'save') {
    return (metadata.goalName as string | undefined) ?? 'Savings';
  }
  if (transfer.intent === 'credit_payoff') {
    return (metadata.destinationAccountName as string | undefined) ?? 'Credit payoff';
  }
  if (transfer.intent === 'earn') {
    return (metadata.streamName as string | undefined) ?? 'Earn payout';
  }
  if (transfer.intent === 'donate') {
    return (metadata.causeName as string | undefined) ?? 'Donation';
  }
  return transferIntentLabel(transfer.intent);
};

const guardrailMetadataFromTransfer = (transfer: TransferRecord) => {
  const metadata = transfer.metadata as Record<string, unknown> | null | undefined;
  const payload = metadata?.guardrail;
  return (payload as {
    approvalPolicy?: string | null;
    autoApproveUpToCents?: number | null;
    reasonCode?: string | null;
    reasonLimitCents?: number | null;
  }) ?? null;
};

const guardrailMetadataFromOrder = (order: InvestmentOrderRecord) => {
  const metadata = order.metadata as Record<string, unknown> | null | undefined;
  if (!metadata) return null;
  const rawReason = metadata.guardrailReason as string | null | undefined;
  let normalizedReason: string | null = null;
  switch (rawReason) {
    case 'exceeds_auto_limit':
      normalizedReason = 'above_auto_limit';
      break;
    case 'parent_policy':
      normalizedReason = 'parent_required';
      break;
    case 'admin_policy':
      normalizedReason = 'admin_required';
      break;
    case 'sell_requires_approval':
      normalizedReason = 'parent_required';
      break;
    default:
      normalizedReason = rawReason ?? null;
  }
  return {
    approvalPolicy: (metadata.guardrailSummary as Record<string, unknown> | null | undefined)?.approvalPolicy as
      | string
      | null
      | undefined,
    autoApproveUpToCents: (metadata.guardrailSummary as Record<string, unknown> | null | undefined)
      ?.autoApproveUpToCents as number | null | undefined,
    reasonCode: normalizedReason,
    reasonLimitCents:
      ((metadata.guardrailSummary as Record<string, unknown> | null | undefined)?.maxOrderAmountCents as
        | number
        | null
        | undefined) ?? null,
  };
};

export const ApprovalsInbox: Component<ApprovalsInboxProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'list' | 'compact'>('list');
  const [search, setSearch] = createSignal('');
  const [intentFilter, setIntentFilter] = createSignal<IntentFilter>('all');
  const [statusFilter, setStatusFilter] = createSignal<StatusFilter>('pending_review');
  const [selectedKeys, setSelectedKeys] = createSignal<Set<string>>(new Set<string>());
  const [isProcessing, setProcessing] = createSignal(false);

  const baseRows = createMemo<ApprovalRow[]>(() => {
    const transferRows = props.transfers.map<ApprovalRow>((transfer) => {
      const guardrailMeta = guardrailMetadataFromTransfer(transfer);
      return {
        key: `transfer:${transfer._id}`,
        id: transfer._id,
        type: 'transfer',
        organizationId: transfer.organizationId,
        requester: transfer.requestedByProfileId ?? 'unknown',
        intent: transferIntentLabel(transfer.intent),
        intentCategory: intentCategoryForTransfer(transfer.intent),
        context: summarizeTransferContext(transfer),
        amountLabel: formatCurrency(transfer.amount.cents),
        amountCents: transfer.amount.cents,
        submittedAt: transfer.requestedAt,
        status: transfer.status,
        statusLabel: transferStatusLabel(transfer.status),
        statusTone: transferStatusTone(transfer.status),
        guardrailReason: guardrailReasonLabel(guardrailMeta),
        transfer,
      };
    });

    const orderRows = props.orders.map<ApprovalRow>((order) => {
      const guardrailMeta = guardrailMetadataFromOrder(order);
      return {
        key: `order:${order._id}`,
        id: order._id,
        type: 'order',
        organizationId: order.organizationId,
        requester: order.placedByProfileId ?? 'unknown',
        intent: `Invest • ${order.side}`,
        intentCategory: 'invest',
        context: order.symbol,
        amountLabel: formatCurrency(order.notional.cents),
        amountCents: order.notional.cents,
        submittedAt: order.submittedAt,
        status: order.status,
        statusLabel: orderStatusLabel(order.status),
        statusTone: orderStatusTone(order.status),
        guardrailReason: guardrailReasonLabel(guardrailMeta),
        order,
      };
    });

    return [...transferRows, ...orderRows].sort((a, b) => b.submittedAt - a.submittedAt);
  });

  const intentFilterOptions = createMemo(() => {
    const categories = new Set<IntentFilter>();
    baseRows().forEach((row) => categories.add(row.intentCategory));
    return INTENT_PRIORITY.filter((value) => value === 'all' || categories.has(value)).map((value) => ({
      id: value,
      label: INTENT_LABELS[value],
      value,
    }));
  });

  const filteredRows = createMemo(() => {
    const term = search().trim().toLowerCase();
    const intent = intentFilter();
    const status = statusFilter();

    return baseRows().filter((row) => {
      const matchesIntent = intent === 'all' || row.intentCategory === intent;
      if (!matchesIntent) return false;

      const matchesStatus = (() => {
        switch (status) {
          case 'all':
            return true;
          case 'pending_review':
            return (
              (row.type === 'transfer' && row.status === 'pending_approval') ||
              (row.type === 'order' && row.status === 'awaiting_parent')
            );
          default:
            return row.status === status;
        }
      })();
      if (!matchesStatus) return false;

      if (!term) return true;
      const haystack = [
        row.requester,
        row.intent,
        row.context,
        row.guardrailReason ?? '',
        row.statusLabel,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  const rowLookup = createMemo(() => {
    const map = new Map<string, ApprovalRow>();
    baseRows().forEach((row) => map.set(row.key, row));
    return map;
  });

  const selectedRows = createMemo(() => {
    const map = rowLookup();
    return Array.from(selectedKeys()).map((key) => map.get(key)).filter((row): row is ApprovalRow => Boolean(row));
  });

  const allSelected = createMemo(() => {
    const rows = filteredRows();
    if (!rows.length) return false;
    const selected = selectedKeys();
    return rows.every((row) => selected.has(row.key));
  });

  const someSelected = createMemo(() => {
    const rows = filteredRows();
    const selected = selectedKeys();
    return rows.some((row) => selected.has(row.key)) && !allSelected();
  });

  const toggleRowSelection = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        filteredRows().forEach((row) => next.add(row.key));
      } else {
        filteredRows().forEach((row) => next.delete(row.key));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedKeys(() => new Set<string>());

  const canApprove = createMemo(
    () =>
      selectedRows().length > 0 &&
      selectedRows().every((row) =>
        row.type === 'transfer' ? row.status === 'pending_approval' : row.status === 'awaiting_parent'
      )
  );

  const canDecline = createMemo(
    () =>
      selectedRows().length > 0 &&
      selectedRows().every((row) =>
        row.type === 'transfer' ? row.status === 'pending_approval' : row.status === 'awaiting_parent'
      )
  );

  const refresh = async () => {
    if (props.onRefresh) {
      await props.onRefresh();
    }
  };

  const handleBulkApprove = async () => {
    const targets = selectedRows();
    if (!targets.length) return;

    setProcessing(true);
    try {
      for (const row of targets) {
        if (row.type === 'transfer') {
          await guapApi.transfers.updateStatus({ transferId: row.id, status: 'approved' });
        } else if (row.type === 'order') {
          await guapApi.investing.approveOrder({
            organizationId: row.organizationId,
            orderId: row.id,
          });
        }
      }
      notifySuccess('Approvals updated', {
        description: `${targets.length} item${targets.length === 1 ? '' : 's'} approved.`,
      });
      clearSelection();
      await refresh();
    } catch (error) {
      notifyError('Unable to approve selections', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkDecline = async () => {
    const targets = selectedRows();
    if (!targets.length) return;

    setProcessing(true);
    try {
      for (const row of targets) {
        if (row.type === 'transfer') {
          await guapApi.transfers.updateStatus({ transferId: row.id, status: 'declined' });
        } else if (row.type === 'order') {
          await guapApi.investing.cancelOrder({
            organizationId: row.organizationId,
            orderId: row.id,
            reason: 'Declined via approvals inbox',
          });
        }
      }
      notifySuccess('Approvals updated', {
        description: `${targets.length} item${targets.length === 1 ? '' : 's'} declined.`,
      });
      clearSelection();
      await refresh();
    } catch (error) {
      notifyError('Unable to decline selections', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const columns: ColumnDef<ApprovalRow, unknown>[] = [
    columnHelper.display({
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          class="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          checked={allSelected()}
          aria-checked={someSelected() ? 'mixed' : allSelected()}
          onChange={(event) => toggleSelectAll(event.currentTarget.checked)}
          aria-label="Select all approvals"
        />
      ),
      cell: (info) => (
        <input
          type="checkbox"
          class="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          checked={selectedKeys().has(info.row.original.key)}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => toggleRowSelection(info.row.original.key, event.currentTarget.checked)}
          aria-label="Select approval"
        />
      ),
      meta: { width: '6%' },
    }),
    columnHelper.accessor('requester', {
      header: 'Requester',
      cell: (info) => <span class="font-medium text-slate-900">{info.getValue() ?? 'Unknown member'}</span>,
      meta: { width: '16%' },
    }),
    columnHelper.accessor('intent', {
      header: 'Intent',
      cell: (info) => <span class="text-sm capitalize text-slate-600">{info.getValue()}</span>,
      meta: { width: '16%' },
    }),
    columnHelper.accessor('context', {
      header: 'Context',
      cell: (info) => <span class="text-sm text-slate-600">{info.getValue()}</span>,
      meta: { width: '18%' },
    }),
    columnHelper.accessor('amountLabel', {
      header: 'Amount',
      cell: (info) => <span class="text-sm font-semibold text-slate-900">{info.getValue()}</span>,
      meta: { width: '12%' },
    }),
    columnHelper.accessor('guardrailReason', {
      header: 'Guardrail',
      cell: (info) =>
        info.getValue() ? (
          <span class="text-xs text-slate-500">{info.getValue()}</span>
        ) : (
          <span class="text-xs text-slate-400">—</span>
        ),
      meta: { width: '18%' },
    }),
    columnHelper.accessor('submittedAt', {
      header: 'Submitted',
      cell: (info) => <span class="text-xs text-slate-500">{formatSubmittedAt(info.getValue())}</span>,
      meta: { width: '12%' },
    }),
    columnHelper.accessor('statusLabel', {
      header: 'Status',
      cell: (info) => (
        <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${info.row.original.statusTone}`}>
          {info.getValue()}
        </span>
      ),
      enableSorting: true,
      meta: { width: '12%' },
    }),
  ];

  const exportApprovalsCsv = () => {
    const rows = filteredRows();
    if (!rows.length) return;
    const filename = `approvals-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv({
      filename,
      columns: [
        { label: 'Type', value: (row) => row.type },
        { label: 'Intent', value: (row) => row.intent },
        { label: 'Context', value: (row) => row.context },
        { label: 'Amount', value: (row) => row.amountLabel },
        { label: 'Status', value: (row) => row.statusLabel },
        { label: 'Requester', value: (row) => row.requester },
        { label: 'Guardrail Reason', value: (row) => row.guardrailReason ?? '' },
        {
          label: 'Submitted At',
          value: (row) => new Date(row.submittedAt).toISOString(),
        },
      ],
      rows,
    });
  };

  return (
    <div class="flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold text-slate-900">Approvals</h2>
        <p class="text-sm text-slate-500">Track pending transfers and investment orders.</p>
      </header>
      <DataTable
        data={filteredRows()}
        columns={columns}
        empty={<span class="text-sm text-slate-500">No approvals yet.</span>}
        toolbar={{
          search: {
            placeholder: 'Search approvals…',
            value: search,
            onChange: (value) => setSearch(value),
          },
          filters: intentFilterOptions().map((option) => ({
            id: option.id,
            label: option.label,
            active: intentFilter() === option.value,
            onToggle: () =>
              setIntentFilter((current) => (current === option.value ? 'all' : option.value)),
          })),
          actions: (
            <div class="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={exportApprovalsCsv}
                disabled={filteredRows().length === 0 || isProcessing()}
              >
                Export CSV
              </Button>
              <select
                class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                value={statusFilter()}
                onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option value={option.value}>{option.label}</option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canApprove() || isProcessing()}
                onClick={handleBulkApprove}
              >
                {isProcessing() ? 'Working…' : 'Approve selected'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canDecline() || isProcessing()}
                onClick={handleBulkDecline}
              >
                Decline selected
              </Button>
              <Show when={selectedRows().length > 0}>
                <Button type="button" size="sm" variant="ghost" onClick={clearSelection} disabled={isProcessing()}>
                  Clear
                </Button>
              </Show>
            </div>
          ),
          summary: (items: ApprovalRow[]) => (
            <span>
              {items.length} matching {items.length === 1 ? 'approval' : 'approvals'}
              <Show when={selectedRows().length > 0}>
                <span class="ml-2 text-xs text-slate-500">
                  {selectedRows().length} selected
                </span>
              </Show>
            </span>
          ),
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
