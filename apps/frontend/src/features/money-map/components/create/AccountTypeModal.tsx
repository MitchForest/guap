import { Component } from 'solid-js';
import { Button } from '~/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import type { CanvasNode } from '~/features/money-map/types/graph';

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
    <Dialog
      open={props.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) props.onClose();
      }}
    >
      <DialogContent class="max-w-md">
        <div class="flex flex-col gap-6">
          <DialogHeader class="items-center gap-2 text-center">
            <span class="text-5xl">🏦</span>
            <DialogTitle>Add an account</DialogTitle>
            <DialogDescription>
              Pick the type that matches where the money lives.
            </DialogDescription>
          </DialogHeader>
          <div class="grid grid-cols-1 gap-3">
            {options.map((option) => (
              <Button
                type="button"
                variant="outline"
                class="w-full justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left hover:border-slate-300 hover:bg-slate-50"
                onClick={() => handleSelect(option)}
              >
                <div class="flex items-center gap-3">
                  <div class="flex h-12 w-12 items-center justify-center text-xl">
                    {option.icon}
                  </div>
                  <div class="text-left">
                    <p class="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p class="text-xs text-subtle">Account</p>
                  </div>
                </div>
                <span class="text-base text-slate-400">›</span>
              </Button>
            ))}
          </div>
          <Button variant="secondary" class="w-full" onClick={props.onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountTypeModal;
