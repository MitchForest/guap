import { Component, Show, createEffect, createSignal } from 'solid-js';
import Modal from '../ui/Modal';
import type { CanvasPodType } from '../../types/graph';

type SubAccountOption = {
  id: string;
  label: string;
};

type PodModalProps = {
  open: boolean;
  accounts: SubAccountOption[];
  defaultAccountId?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    parentAccountId: string;
    podType: CanvasPodType;
    startingBalance: number | null;
  }) => Promise<void> | void;
};

const PodModal: Component<PodModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [parentId, setParentId] = createSignal<string>('');
  const [error, setError] = createSignal<string | null>(null);
  const [podType, setPodType] = createSignal<CanvasPodType>('goal');
  const [startingBalance, setStartingBalance] = createSignal('');

  createEffect(() => {
    if (!props.open) {
      setName('');
      setParentId('');
      setPodType('goal');
      setStartingBalance('');
      setError(null);
      return;
    }
    const defaultId = props.defaultAccountId ?? props.accounts[0]?.id ?? '';
    setParentId(defaultId);
    setError(null);
  });

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (!parentId()) {
      setError('Select an account to attach this pod to.');
      return;
    }
    const hasBalanceInput = startingBalance().trim().length > 0;
    const balanceValue = hasBalanceInput ? Number(startingBalance()) : null;
    if (hasBalanceInput && !Number.isFinite(balanceValue)) {
      setError('Enter a valid starting balance.');
      return;
    }
    await props.onSubmit({
      name: name().trim() || 'Spending',
      parentAccountId: parentId(),
      podType: podType(),
      startingBalance: balanceValue,
    });
    props.onClose();
  };

  const disableForm = () => props.accounts.length === 0;

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <form class="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div class="flex flex-col items-center gap-3 text-center">
          <span class="text-5xl">💸</span>
          <h2 class="text-xl font-semibold text-slate-900">Create a Pod</h2>
          <p class="text-sm text-subtle">Group goals, spending, and categories under an account.</p>
        </div>
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Name
          <input
            class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            placeholder="e.g. Rent, Travel, Emergency Fund"
            value={name()}
            onInput={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
            disabled={disableForm()}
          />
        </label>
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Connect to account
          <select
            class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            value={parentId()}
            onChange={(event) => {
              setParentId(event.currentTarget.value);
              setError(null);
            }}
            disabled={disableForm()}
          >
            <option value="" disabled>
              {props.accounts.length === 0 ? 'Add an account first' : 'Choose account'}
            </option>
            {props.accounts.map((account) => (
              <option value={account.id}>{account.label}</option>
            ))}
          </select>
        </label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pod type
            <select
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              value={podType()}
              onChange={(event) => setPodType(event.currentTarget.value as CanvasPodType)}
              disabled={disableForm()}
            >
              <option value="goal">Goal</option>
              <option value="category">Category</option>
              <option value="envelope">Envelope</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Starting balance
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              placeholder="0.00"
              value={startingBalance()}
              onInput={(event) => {
                setStartingBalance(event.currentTarget.value);
                setError(null);
              }}
              disabled={disableForm()}
            />
          </label>
        </div>
        <Show when={error()}>
          {(message) => <p class="text-sm text-rose-500">{message()}</p>}
        </Show>
        <div class="flex flex-col gap-2">
          <button
            type="submit"
            class="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disableForm()}
          >
            Create Pod
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

export default PodModal;
