import { Component, Show, createEffect, createSignal } from 'solid-js';
import Modal from '../ui/Modal';

export type AccountOption = {
  id: string;
  label: string;
  icon: string;
  accent: string;
  nodeType: 'account' | 'liability';
};

type AccountTypeModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (option: AccountOption) => Promise<void> | void;
};

type CategoryKey = 'deposit' | 'investment' | 'liability';

type CategoryDefinition = {
  title: string;
  description: string;
  icon: string;
  options: AccountOption[];
};

const categories: Record<CategoryKey, CategoryDefinition> = {
  deposit: {
    title: 'Deposit Account',
    description: 'Everyday accounts for managing cash flow',
    icon: '🏦',
    options: [
      { id: 'checking', label: 'Checking', icon: '🧾', accent: '#1d4ed8', nodeType: 'account' },
      { id: 'savings', label: 'Savings', icon: '💰', accent: '#f97316', nodeType: 'account' },
      { id: 'cd', label: 'Certificate of Deposit', icon: '📄', accent: '#0f766e', nodeType: 'account' },
    ],
  },
  investment: {
    title: 'Investment Account',
    description: 'Long-term growth and retirement vehicles',
    icon: '📈',
    options: [
      { id: '401k', label: '401(k)', icon: '💵', accent: '#2563eb', nodeType: 'account' },
      { id: 'ira', label: 'IRA', icon: '🧑‍💼', accent: '#6366f1', nodeType: 'account' },
      { id: 'brokerage', label: 'Brokerage Account', icon: '📊', accent: '#16a34a', nodeType: 'account' },
      { id: 'education', label: 'Education Savings', icon: '📚', accent: '#0ea5e9', nodeType: 'account' },
    ],
  },
  liability: {
    title: 'Liability Account',
    description: 'Loans and credit lines you manage',
    icon: '💳',
    options: [
      { id: 'credit-card', label: 'Credit Card', icon: '💳', accent: '#f59e0b', nodeType: 'liability' },
      { id: 'mortgage', label: 'Mortgage', icon: '🏠', accent: '#7c3aed', nodeType: 'liability' },
      { id: 'auto-loan', label: 'Auto Loan', icon: '🚗', accent: '#0ea5e9', nodeType: 'liability' },
      { id: 'student-loan', label: 'Student Loan', icon: '🎓', accent: '#6366f1', nodeType: 'liability' },
      { id: 'business-loan', label: 'Business Loan', icon: '💼', accent: '#4f46e5', nodeType: 'liability' },
    ],
  },
};

const AccountTypeModal: Component<AccountTypeModalProps> = (props) => {
  const [step, setStep] = createSignal<'category' | 'option'>('category');
  const [categoryKey, setCategoryKey] = createSignal<CategoryKey>('deposit');

  createEffect(() => {
    if (!props.open) {
      setStep('category');
      setCategoryKey('deposit');
    }
  });

  const chooseCategory = (key: CategoryKey) => {
    setCategoryKey(key);
    setStep('option');
  };

  const handleOptionSelect = async (option: AccountOption) => {
    await props.onSubmit(option);
    props.onClose();
  };

  const activeCategory = () => categories[categoryKey()];

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <Show when={step() === 'category'} fallback={
        <div class="space-y-6">
          <div class="flex items-center gap-3">
            <button
              class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              onClick={() => setStep('category')}
            >
              Back
            </button>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-slate-900">{activeCategory().title}</h2>
              <p class="text-sm text-subtle">{activeCategory().description}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3">
            {activeCategory().options.map((option) => (
              <button
                class="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => handleOptionSelect(option)}
              >
                <div class="flex items-center gap-3">
                  <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    {option.icon}
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p class="text-xs text-subtle">{activeCategory().title}</p>
                  </div>
                </div>
                <span class="text-base text-slate-400">›</span>
              </button>
            ))}
          </div>
        </div>
      }>
        <div class="space-y-6">
          <div class="text-center space-y-2">
            <p class="text-5xl">🧾</p>
            <h2 class="text-xl font-semibold text-slate-900">What type of account to add?</h2>
          </div>
          <div class="grid grid-cols-2 gap-3">
            {Object.entries(categories).map(([key, value]) => (
              <button
                class="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 px-4 py-6 text-center transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => chooseCategory(key as CategoryKey)}
              >
                <span class="text-3xl">{value.icon}</span>
                <span class="text-sm font-semibold text-slate-900">{value.title}</span>
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
      </Show>
    </Modal>
  );
};

export default AccountTypeModal;
