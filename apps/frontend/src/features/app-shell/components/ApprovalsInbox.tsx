import { createColumnHelper } from '@tanstack/solid-table';
import { createSignal, type Component } from 'solid-js';
import { DataTable } from '~/shared/components/data-table';

type ApprovalItem = {
  id: string;
  requester: string;
  summary: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
};

type ApprovalsInboxProps = {
  items: ApprovalItem[];
};

const columnHelper = createColumnHelper<ApprovalItem>();

const columns = [
  columnHelper.accessor('requester', {
    header: 'Requester',
    cell: (info) => <span class="font-medium text-slate-900">{info.getValue()}</span>,
    meta: { width: '25%' },
  }),
  columnHelper.accessor('summary', {
    header: 'Summary',
    cell: (info) => <span class="text-sm text-slate-600">{info.getValue()}</span>,
  }),
  columnHelper.accessor('submittedAt', {
    header: 'Submitted',
    cell: (info) => <span class="text-xs text-slate-500">{info.getValue()}</span>,
    meta: { width: '15%' },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const value = info.getValue();
      const tone =
        value === 'pending'
          ? 'bg-amber-100 text-amber-700'
          : value === 'approved'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-rose-100 text-rose-700';
      return <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{value}</span>;
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
        data={props.items}
        columns={columns}
        empty={<span class="text-sm text-slate-500">No approvals yet.</span>}
        toolbar={{
          summary: (items) => <span>{items.length} total requests</span>,
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

export const createPlaceholderApprovals = (): ApprovalItem[] => [
  {
    id: 'req-1',
    requester: 'Avery Johnson',
    summary: 'Wants to increase allowance for chore streak',
    submittedAt: '2 hours ago',
    status: 'pending',
  },
  {
    id: 'req-2',
    requester: 'Jordan Lee',
    summary: 'Requesting transfer to savings goal “Guitar”',
    submittedAt: 'Yesterday',
    status: 'pending',
  },
  {
    id: 'req-3',
    requester: 'Morgan Chen',
    summary: 'Move unused spend budget into Invest pod',
    submittedAt: 'Mar 4',
    status: 'approved',
  },
];
