import type { InstrumentType } from '@guap/types';

import { createSignal, type Component, For, Show } from 'solid-js';
import type { WatchlistEntryRecord } from '@guap/types';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';

export type WatchlistFormValues = {
  symbol: string;
  instrumentType: InstrumentType;
  notes?: string;
};

type WatchlistGridProps = {
  entries: WatchlistEntryRecord[];
  onAdd: (entry: WatchlistFormValues) => Promise<void> | void;
  onRemove: (symbol: string) => Promise<void> | void;
  onTrade: (symbol: string, instrumentType: InstrumentType) => void;
};

const instrumentOptions: Array<{ value: InstrumentType; label: string }> = [
  { value: 'etf', label: 'ETF' },
  { value: 'equity', label: 'Equity' },
  { value: 'cash', label: 'Cash equivalent' },
];

export const WatchlistGrid: Component<WatchlistGridProps> = (props) => {
  const [symbol, setSymbol] = createSignal('');
  const [instrumentType, setInstrumentType] = createSignal<InstrumentType>('etf');
  const [notes, setNotes] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (!symbol().trim()) return;
    try {
      setSubmitting(true);
      await props.onAdd({
        symbol: symbol().trim().toUpperCase(),
        instrumentType: instrumentType(),
        notes: notes().trim() ? notes().trim() : undefined,
      });
      setSymbol('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="space-y-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Watchlist</h2>
          <p class="text-sm text-slate-500">Track symbols for research and quick order entry.</p>
        </div>
        <form class="grid gap-2 md:grid-cols-4" onSubmit={handleSubmit}>
          <Input
            value={symbol()}
            placeholder="Symbol"
            onInput={(event) => setSymbol(event.currentTarget.value.toUpperCase())}
            required
          />
          <select
            class="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={instrumentType()}
            onInput={(event) => setInstrumentType(event.currentTarget.value as InstrumentType)}
          >
            <For each={instrumentOptions}>
              {(option) => (
                <option value={option.value}>{option.label}</option>
              )}
            </For>
          </select>
          <Input
            value={notes()}
            placeholder="Notes (optional)"
            onInput={(event) => setNotes(event.currentTarget.value)}
          />
          <Button type="submit" variant="primary" disabled={submitting()}>
            Add
          </Button>
        </form>
      </div>
      <Show
        when={props.entries.length}
        fallback={<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No symbols saved yet.</div>}
      >
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <For each={props.entries}>
            {(entry) => (
              <article class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <header class="flex items-center justify-between">
                  <div>
                    <h3 class="text-lg font-semibold text-slate-900">{entry.symbol}</h3>
                    <p class="text-xs uppercase tracking-[0.18em] text-slate-400">{entry.instrumentType}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => props.onTrade(entry.symbol, entry.instrumentType)}
                  >
                    Trade
                  </Button>
                </header>
                <Show when={entry.notes}>
                  {(note) => <p class="text-xs text-slate-500">{note()}</p>}
                </Show>
                <div class="flex items-center justify-between text-xs text-slate-400">
                  <span>Added {new Date(entry.createdAt).toLocaleDateString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => props.onRemove(entry.symbol)}
                  >
                    Remove
                  </Button>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
