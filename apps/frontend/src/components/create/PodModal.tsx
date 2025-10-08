import { Component, Show, createSignal, createEffect } from 'solid-js';
import Modal from '../ui/Modal';

type SubAccountOption = {
  id: string;
  label: string;
};

type PodModalProps = {
  open: boolean;
  accounts: SubAccountOption[];
  defaultAccountId?: string | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; parentAccountId: string }) => Promise<void> | void;
};

const PodModal: Component<PodModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [parentId, setParentId] = createSignal<string>('');
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (!props.open) {
      setName('');
      setParentId('');
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
      setError('Select an account to attach this sub-account to.');
      return;
    }
    await props.onSubmit({
      name: name().trim() || 'Spending',
      parentAccountId: parentId(),
    });
    props.onClose();
  };

  const disableForm = () => props.accounts.length === 0;

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <form class="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div class="flex flex-col items-center gap-3 text-center">
          <span class="text-5xl">💸</span>
          <h2 class="text-xl font-semibold text-slate-900">Create a Sub-account</h2>
          <p class="text-sm text-subtle">Group goals, spending, and categories under an account.</p>
        </div>
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Name
          <input
            class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            placeholder="e.g. Rent, Travel, Emergency Fund"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            disabled={disableForm()}
          />
        </label>
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Connect to account
          <select
            class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            value={parentId()}
            onChange={(event) => setParentId(event.currentTarget.value)}
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
        <Show when={error()}>
          {(message) => <p class="text-sm text-rose-500">{message()}</p>}
        </Show>
        <div class="flex flex-col gap-2">
          <button
            type="submit"
            class="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disableForm()}
          >
            Create Sub-account
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
