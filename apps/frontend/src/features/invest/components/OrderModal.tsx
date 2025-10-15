import type { InstrumentType, InvestmentGuardrailEvaluation, InvestmentOrderRecord } from '@guap/types';

import { createEffect, createMemo, createResource, createSignal, type Component, For } from 'solid-js';
import { Modal } from '~/shared/components/layout/Modal';
import { Input } from '~/shared/components/ui/input';
import { Button } from '~/shared/components/ui/button';
import { notifyError, notifySuccess } from '~/shared/services/notifications';

const sideOptions: Array<{ value: 'buy' | 'sell'; label: string }> = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

type AccountOption = {
  id: string;
  name: string;
};

export type OrderModalProps = {
  open: boolean;
  organizationId: string;
  accountOptions: AccountOption[];
  defaultAccountId?: string;
  defaultSymbol?: string;
  defaultInstrumentType?: InstrumentType;
  onClose: () => void;
  onSubmitted: (order: InvestmentOrderRecord) => Promise<void> | void;
  submitOrder: (input: { organizationId: string; accountId: string; symbol: string; instrumentType: InstrumentType; side: 'buy' | 'sell'; quantity: number }) => Promise<InvestmentOrderRecord>;
  evaluateGuardrail: (input: {
    organizationId: string;
    accountId: string;
    symbol?: string;
    instrumentType?: InstrumentType;
    side?: 'buy' | 'sell';
    notionalCents?: number;
  }) => Promise<InvestmentGuardrailEvaluation>;
};

const guardrailMessage = (evaluation: InvestmentGuardrailEvaluation | null) => {
  if (!evaluation) return 'Guardrail summary unavailable.';
  switch (evaluation.decision) {
    case 'auto_execute':
      return 'Auto executes immediately under current guardrails.';
    case 'needs_parent':
      return 'Parent approval required before this order executes.';
    case 'needs_admin':
      return 'An admin must approve this order before execution.';
    case 'blocked':
      return `Order blocked${evaluation.reason ? `: ${evaluation.reason}` : ''}.`;
    default:
      return 'Guardrail evaluation not available.';
  }
};

export const OrderModal: Component<OrderModalProps> = (props) => {
  const [selectedAccountId, setSelectedAccountId] = createSignal(props.defaultAccountId ?? props.accountOptions[0]?.id ?? '');
  const [symbol, setSymbol] = createSignal(props.defaultSymbol ?? '');
  const [instrumentType, setInstrumentType] = createSignal<InstrumentType>(props.defaultInstrumentType ?? 'etf');
  const [side, setSide] = createSignal<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = createSignal('1');
  const [submitting, setSubmitting] = createSignal(false);

  createEffect(() => {
    if (props.open) {
      setSymbol((value) => (value ? value.toUpperCase() : value));
      if (!selectedAccountId() && props.accountOptions.length) {
        setSelectedAccountId(props.accountOptions[0]!.id);
      }
    }
  });

  const [guardrail] = createResource(
    () => {
      if (!props.open) return null;
      const accountId = selectedAccountId();
      const symbolValue = symbol().trim();
      if (!accountId || !symbolValue) return null;
      return {
        organizationId: props.organizationId,
        accountId,
        symbol: symbolValue,
        instrumentType: instrumentType(),
        side: side(),
      } as const;
    },
    async (params) => {
      if (!params) return null;
      return await props.evaluateGuardrail(params);
    },
    {
      initialValue: null,
    }
  );

  const handleSubmit = async (event?: Event) => {
    event?.preventDefault();
    const accountId = selectedAccountId();
    if (!accountId) {
      notifyError('Select an account');
      return;
    }
    const qty = Number(quantity());
    if (!Number.isFinite(qty) || qty <= 0) {
      notifyError('Quantity must be positive');
      return;
    }

    try {
      setSubmitting(true);
      const order = await props.submitOrder({
        organizationId: props.organizationId,
        accountId,
        symbol: symbol().trim().toUpperCase(),
        instrumentType: instrumentType(),
        side: side(),
        quantity: qty,
      });

      notifySuccess(order.status === 'executed' ? 'Order executed' : 'Order submitted', {
        description:
          order.status === 'executed'
            ? 'The order executed immediately under guardrails.'
            : 'Pending approval before execution.',
      });

      await props.onSubmitted(order);
      props.onClose();
    } catch (error) {
      notifyError('Unable to submit order', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const accountOptions = createMemo(() => props.accountOptions);

  return (
    <Modal
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      title={<span>Create order</span>}
      description={<span>Submit a buy or sell order subject to household guardrails.</span>}
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose} disabled={submitting()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit as unknown as () => void} disabled={submitting()}>
            {submitting() ? 'Submitting…' : 'Submit order'}
          </Button>
        </>
      }
    >
      <form class="space-y-4" onSubmit={handleSubmit}>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-sm text-slate-600">
            <span class="font-medium text-slate-800">Account</span>
            <select
              class="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              value={selectedAccountId()}
              onInput={(event) => setSelectedAccountId(event.currentTarget.value)}
            >
              <For each={accountOptions()}>
                {(option) => (
                  <option value={option.id}>{option.name}</option>
                )}
              </For>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm text-slate-600">
            <span class="font-medium text-slate-800">Symbol</span>
            <Input
              value={symbol()}
              onInput={(event) => setSymbol(event.currentTarget.value.toUpperCase())}
              placeholder="e.g. VTI"
              required
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-slate-600">
            <span class="font-medium text-slate-800">Instrument type</span>
            <select
              class="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              value={instrumentType()}
              onInput={(event) => setInstrumentType(event.currentTarget.value as InstrumentType)}
            >
              <option value="etf">ETF</option>
              <option value="equity">Equity</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm text-slate-600">
            <span class="font-medium text-slate-800">Quantity</span>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={quantity()}
              onInput={(event) => setQuantity(event.currentTarget.value)}
              required
            />
          </label>
        </div>
        <div class="flex gap-2">
          <For each={sideOptions}>
            {(option) => (
              <button
                type="button"
                class={`flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  side() === option.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
                onClick={() => setSide(option.value)}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {guardrailMessage(guardrail() ?? null)}
        </div>
      </form>
    </Modal>
  );
};
