import { Component } from 'solid-js';
import Modal from '../ui/Modal';
import type { CanvasNode } from '../../types/graph';

export type AccountOption = {
  id: string;
  label: string;
  icon: string;
  accent: string;
  category: NonNullable<CanvasNode['category']>;
};

type AccountTypeModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (option: AccountOption) => Promise<void> | void;
};

const options: AccountOption[] = [
  { id: 'checking', label: 'Checking', icon: '🧾', accent: '#1d4ed8', category: 'checking' },
  { id: 'savings', label: 'Savings', icon: '💰', accent: '#f97316', category: 'savings' },
  { id: 'brokerage', label: 'Brokerage', icon: '📈', accent: '#16a34a', category: 'brokerage' },
  { id: 'credit-card', label: 'Credit Card', icon: '💳', accent: '#f59e0b', category: 'creditCard' },
  { id: 'other', label: 'Other', icon: '✨', accent: '#64748b', category: 'other' },
];

const AccountTypeModal: Component<AccountTypeModalProps> = (props) => {
  const handleSelect = async (option: AccountOption) => {
    await props.onSubmit(option);
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <div class="flex flex-col gap-6">
        <div class="text-center space-y-2">
          <p class="text-5xl">🏦</p>
          <h2 class="text-xl font-semibold text-slate-900">Add an account</h2>
          <p class="text-sm text-subtle">Pick the type that matches where the money lives.</p>
        </div>
        <div class="grid grid-cols-1 gap-3">
          {options.map((option) => (
            <button
              type="button"
              class="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => handleSelect(option)}
            >
              <div class="flex items-center gap-3">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  {option.icon}
                </div>
                <div>
                  <p class="text-sm font-semibold text-slate-900">{option.label}</p>
                  <p class="text-xs text-subtle">Account</p>
                </div>
              </div>
              <span class="text-base text-slate-400">›</span>
            </button>
          ))}
        </div>
        <button
          class="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          onClick={props.onClose}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default AccountTypeModal;
