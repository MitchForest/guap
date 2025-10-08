import { Component, Show, createEffect, createSignal } from 'solid-js';
import Modal from '../ui/Modal';
import type { CanvasInflowCadence } from '../../types/graph';

type IncomeSourceModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    startingBalance: number | null;
    inflow: { amount: number; cadence: CanvasInflowCadence } | null;
  }) => Promise<void> | void;
};

const IncomeSourceModal: Component<IncomeSourceModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [startingBalance, setStartingBalance] = createSignal('');
  const [incomeAmount, setIncomeAmount] = createSignal('');
  const [cadence, setCadence] = createSignal<CanvasInflowCadence>('monthly');
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (!props.open) {
      setName('');
      setStartingBalance('');
      setIncomeAmount('');
      setCadence('monthly');
      setError(null);
    }
  });

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    const hasBalanceInput = startingBalance().trim().length > 0;
    const balanceValue = hasBalanceInput ? Number(startingBalance()) : null;
    if (hasBalanceInput && !Number.isFinite(balanceValue)) {
      setError('Enter a valid starting balance.');
      return;
    }

    const hasIncomeInput = incomeAmount().trim().length > 0;
    const incomeValue = hasIncomeInput ? Number(incomeAmount()) : null;
    if (hasIncomeInput && (!Number.isFinite(incomeValue) || (incomeValue ?? 0) <= 0)) {
      setError('Enter a positive income amount.');
      return;
    }

    await props.onSubmit({
      name: name().trim() || 'Income Source',
      startingBalance: balanceValue,
      inflow:
        incomeValue !== null
          ? {
              amount: incomeValue,
              cadence: cadence(),
            }
          : null,
    });
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <form class="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div class="flex flex-col items-center gap-3 text-center">
          <span class="text-5xl">🏦</span>
          <h2 class="text-xl font-semibold text-slate-900">Set up an income source</h2>
          <p class="text-sm text-subtle">Name it, add a starting balance, and note how much arrives.</p>
        </div>
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Name
          <input
            class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            placeholder="e.g. Salary, Freelance, Rent"
            value={name()}
            onInput={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Starting balance
          <input
            type="number"
            min="0"
            step="0.01"
            class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            placeholder="0.00"
            value={startingBalance()}
            onInput={(event) => {
              setStartingBalance(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Income amount
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              placeholder="e.g. 2500"
              value={incomeAmount()}
              onInput={(event) => {
                setIncomeAmount(event.currentTarget.value);
                setError(null);
              }}
            />
          </label>
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Cadence
            <select
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              value={cadence()}
              onChange={(event) => setCadence(event.currentTarget.value as CanvasInflowCadence)}
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
        </div>
        <Show when={error()}>
          {(message) => <p class="text-sm font-semibold text-rose-600">{message()}</p>}
        </Show>
        <div class="flex w-full flex-col gap-2">
          <button
            type="submit"
            class="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800"
          >
            Create Income Source
          </button>
          <button
            type="button"
            class="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            onClick={props.onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default IncomeSourceModal;
