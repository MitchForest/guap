import { Component, createSignal, createEffect } from 'solid-js';
import Modal from '../ui/Modal';

type IncomeSourceModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
};

const IncomeSourceModal: Component<IncomeSourceModalProps> = (props) => {
  const [name, setName] = createSignal('');

  createEffect(() => {
    if (!props.open) setName('');
  });

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    await props.onSubmit(name().trim() || 'Income Source');
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <form class="flex flex-col items-center gap-5" onSubmit={handleSubmit}>
        <span class="text-5xl">🏦</span>
        <div class="text-center">
          <h2 class="text-xl font-semibold text-slate-900">Name your Income Source</h2>
        </div>
        <input
          class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
          placeholder="e.g salary income, freelance, rent..."
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
        />
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
