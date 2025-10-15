import type { InstrumentType } from '@guap/types';

import { ColumnDef, createColumnHelper } from '@tanstack/solid-table';
import { createMemo, createSignal, type Component, Show } from 'solid-js';
import type { InvestmentPositionRecord } from '@guap/types';
import { DataTable } from '~/shared/components/data-table';
import { clsx } from 'clsx';
import { Button } from '~/shared/components/ui/button';
import { Drawer } from '~/shared/components/layout/Drawer';
import { formatCurrency, formatPercent } from '~/shared/utils/format';

type SnapshotSummary = {
  latest: number;
  previous: number;
  currency: string;
};

type HoldingsTableProps = {
  positions: InvestmentPositionRecord[];
  snapshots: Map<string, SnapshotSummary>;
  onTrade: (symbol: string, instrumentType: InstrumentType) => void;
};

type HoldingRow = InvestmentPositionRecord & {
  costBasisCents: number;
  gainCents: number;
  priceChangePercent: number;
};

const columnHelper = createColumnHelper<HoldingRow>();

export const HoldingsTable: Component<HoldingsTableProps> = (props) => {
  const rows = createMemo(() =>
    props.positions.map((position) => {
      const costBasisCents = Math.round(position.quantity * position.averageCost.cents);
      const gainCents = position.marketValue.cents - costBasisCents;
      const snapshot = props.snapshots.get(position.symbol);
      const previousPrice = snapshot ? snapshot.previous : position.lastPrice.cents;
      const priceChangePercent = previousPrice > 0 ? (position.lastPrice.cents - previousPrice) / previousPrice : 0;
      return {
        ...position,
        costBasisCents,
        gainCents,
        priceChangePercent,
      } satisfies HoldingRow;
    })
  );

  const columns = createMemo<ColumnDef<HoldingRow, unknown>[]>(() => [
    columnHelper.accessor('symbol', {
      header: 'Symbol',
      cell: (info) => (
        <div class="flex flex-col">
          <span class="font-semibold text-slate-900">{info.getValue()}</span>
          <span class="text-xs uppercase tracking-[0.18em] text-slate-400">{info.row.original.instrumentType}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'quantity',
      header: 'Quantity',
      cell: (info) => (
        <span class="text-sm font-medium text-slate-700">{info.row.original.quantity.toFixed(3)}</span>
      ),
      meta: { width: '15%' },
    }),
    columnHelper.display({
      id: 'marketValue',
      header: 'Market value',
      cell: (info) => (
        <span class="text-sm font-semibold text-slate-900">{formatCurrency(info.row.original.marketValue.cents)}</span>
      ),
      meta: { width: '20%' },
    }),
    columnHelper.display({
      id: 'costBasis',
      header: 'Cost basis',
      cell: (info) => (
        <span class="text-sm text-slate-600">{formatCurrency(info.row.original.costBasisCents)}</span>
      ),
      meta: { width: '20%' },
    }),
    columnHelper.display({
      id: 'gain',
      header: 'Gain / Loss',
      cell: (info) => {
        const gain = info.row.original.gainCents;
        const tone = gain >= 0 ? 'text-emerald-600' : 'text-rose-600';
        return (
          <span class={`text-sm font-semibold ${tone}`}>
            {gain >= 0 ? '+' : ''}
            {formatCurrency(gain)}
          </span>
        );
      },
      meta: { width: '15%' },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            props.onTrade(info.row.original.symbol, info.row.original.instrumentType);
          }}
        >
          Trade
        </Button>
      ),
      meta: { width: '12%' },
    }),
  ]);

  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [selected, setSelected] = createSignal<HoldingRow | null>(null);

  const handleRowClick = (row: HoldingRow) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Holdings</h2>
          <p class="text-sm text-slate-500">Positions across UTMA and brokerage accounts with live guardrails.</p>
        </div>
      </div>
      <DataTable
        data={rows()}
        columns={columns()}
        empty={<span class="text-sm text-slate-500">No holdings yet.</span>}
        initialSorting={[{ id: 'marketValue', desc: true }]}
        toolbar={{}}
        onRowClick={handleRowClick}
      />
      <Drawer
        open={drawerOpen()}
        onOpenChange={setDrawerOpen}
        title={<span>Position details</span>}
      >
        <Show when={selected()}>
          {(position) => (
            <div class="space-y-4 text-sm text-slate-600">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">{position().symbol}</h3>
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">{position().instrumentType}</p>
              </div>
              <dl class="grid grid-cols-2 gap-3">
                <div>
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-400">Quantity</dt>
                  <dd class="text-sm font-medium text-slate-900">{position().quantity.toFixed(4)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-400">Last price</dt>
                  <dd class="text-sm font-medium text-slate-900">{formatCurrency(position().lastPrice.cents)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-400">Market value</dt>
                  <dd class="text-sm font-medium text-slate-900">{formatCurrency(position().marketValue.cents)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-400">Cost basis</dt>
                  <dd class="text-sm font-medium text-slate-900">{formatCurrency(position().costBasisCents)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-400">Unrealized gain</dt>
                  <dd class={clsx('text-sm font-medium', position().gainCents >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {position().gainCents >= 0 ? '+' : ''}
                    {formatCurrency(position().gainCents)}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-400">Daily move</dt>
                  <dd class="text-sm font-medium text-slate-900">
                    {formatPercent(position().priceChangePercent * 100, 2)}
                  </dd>
                </div>
              </dl>
              <Button
                variant="primary"
                onClick={() => {
                  props.onTrade(position().symbol, position().instrumentType);
                  setDrawerOpen(false);
                }}
              >
                Start order
              </Button>
            </div>
          )}
        </Show>
      </Drawer>
    </div>
  );
};
