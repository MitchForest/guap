import { Component, Show, createEffect, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import type { SelectOption } from '~/components/ui/select';
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { CanvasPodType, CanvasNode } from '../../types/graph';

export type SubAccountOption = {
  id: string;
  label: string;
  category?: CanvasNode['category'];
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
    const accounts = props.accounts;
    const fallbackId = accounts[0]?.id ?? '';
    const defaultId = accounts.find((account) => account.id === props.defaultAccountId)?.id ?? fallbackId;
    setParentId(defaultId);
    setError(null);
  });

  createEffect(() => {
    const selected = props.accounts.find((account) => account.id === parentId());
    if (!selected) {
      setPodType('goal');
      return;
    }
    setPodType(selected.category === 'savings' ? 'goal' : 'category');
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

  const accountOptions = () =>
    props.accounts.map((account) => ({
      value: account.id,
      label: account.label,
      icon: '🏦',
    })) satisfies SelectOption[];

  const selectedAccountOption = () => accountOptions().find((option) => option.value === parentId()) ?? null;
  const podTypeLabel = () => (podType() === 'goal' ? 'Savings Goal' : 'Spend Category');

  return (
    <Dialog
      open={props.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) props.onClose();
      }}
    >
      <DialogContent>
        <form class="flex flex-col gap-5" onSubmit={handleSubmit}>
          <DialogHeader class="items-center gap-3 text-center">
            <span class="text-5xl">💸</span>
            <DialogTitle>Create a Pod</DialogTitle>
            <DialogDescription>
              Group goals, spending, and categories under an account.
            </DialogDescription>
          </DialogHeader>
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Name
            <input
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
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
          <Select
            options={accountOptions()}
            optionValue="value"
            optionTextValue="label"
            value={selectedAccountOption()}
            onChange={(option) => {
              setParentId(option?.value ?? '');
              setError(null);
            }}
            disabled={disableForm()}
            placeholder={
              <span class="truncate text-slate-400">
                {props.accounts.length === 0 ? 'Add an account first' : 'Choose account'}
              </span>
            }
            itemComponent={(itemProps) => <SelectItem {...itemProps} />}
          >
            <SelectTrigger class="mt-1" aria-label="Parent account">
              <SelectValue<SelectOption>>
                {(state) => (
                  <span class="truncate">{state.selectedOption()?.label ?? (props.accounts.length === 0 ? 'Add an account first' : 'Choose account')}</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
            <SelectHiddenSelect name="pod-parent-account" />
          </Select>
          </label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pod type
              <div class="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                {podTypeLabel()}
              </div>
            </label>
            <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Starting balance
              <input
                type="number"
                min="0"
                step="0.01"
                class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
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
            {(message) => <p class="text-sm font-semibold text-rose-600">{message()}</p>}
          </Show>
          <div class="flex flex-col gap-2">
            <Button type="submit" class="w-full shadow-floating" disabled={disableForm()}>
              Create Pod
            </Button>
            <Button type="button" variant="secondary" class="w-full" onClick={props.onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PodModal;
