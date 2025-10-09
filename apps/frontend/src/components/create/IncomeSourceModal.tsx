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

  const cadenceOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
  ] satisfies SelectOption[];

  const selectedCadence = () => cadenceOptions.find((option) => option.value === cadence()) ?? cadenceOptions[0];

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
    <Dialog
      open={props.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) props.onClose();
      }}
    >
      <DialogContent>
        <form class="flex flex-col gap-5" onSubmit={handleSubmit}>
          <DialogHeader class="items-center gap-3 text-center">
            <span class="text-5xl">🏦</span>
            <DialogTitle>Set up an income source</DialogTitle>
            <DialogDescription>
              Name it, add a starting balance, and note how much arrives.
            </DialogDescription>
          </DialogHeader>
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Name
            <input
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
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
              class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
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
                class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
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
            <Select
              options={cadenceOptions}
              optionValue="value"
              optionTextValue="label"
              value={selectedCadence()}
              onChange={(option) => {
                const next = (option?.value as CanvasInflowCadence | undefined) ?? 'monthly';
                setCadence(next);
                setError(null);
              }}
              placeholder={<span class="truncate text-slate-400">Choose cadence</span>}
              itemComponent={(itemProps) => <SelectItem {...itemProps} />}
            >
              <SelectTrigger class="mt-1" aria-label="Cadence">
                <SelectValue>
                  {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Choose cadence'}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
              <SelectHiddenSelect name="income-cadence" />
            </Select>
            </label>
          </div>
          <Show when={error()}>
            {(message) => <p class="text-sm font-semibold text-rose-600">{message()}</p>}
          </Show>
          <div class="flex w-full flex-col gap-2">
            <Button type="submit" class="w-full shadow-floating">
              Create Income Source
            </Button>
            <Button
              type="button"
              variant="secondary"
              class="w-full"
              onClick={props.onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default IncomeSourceModal;
