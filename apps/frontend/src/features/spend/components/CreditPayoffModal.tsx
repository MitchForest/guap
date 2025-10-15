import { Show, createEffect, createMemo, createSignal, type Component } from 'solid-js';
import type { FinancialAccountRecord } from '@guap/api';
import { z } from 'zod';
import { Modal } from '~/shared/components/layout';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { FormActions, FormField } from '~/shared/forms/FormField';
import { createGuapForm } from '~/shared/forms/createGuapForm';
import { formatCurrency } from '~/shared/utils/format';

const PayoffFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Select a funding account'),
  destinationAccountId: z.string().min(1, 'Select a credit account'),
  amount: z.coerce.number().positive('Enter a payoff amount'),
  memo: z
    .string()
    .max(140, 'Keep notes under 140 characters')
    .optional(),
});

export type CreditPayoffFormValues = z.infer<typeof PayoffFormSchema>;

type CreditPayoffModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundingAccounts: FinancialAccountRecord[];
  creditAccounts: FinancialAccountRecord[];
  onSubmit: (values: CreditPayoffFormValues) => Promise<void>;
};

export const CreditPayoffModal: Component<CreditPayoffModalProps> = (props) => {
  const [isSubmitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const defaultSourceAccountId = createMemo(() => props.fundingAccounts[0]?._id ?? '');
  const defaultDestinationId = createMemo(() => props.creditAccounts[0]?._id ?? '');

  const form = createGuapForm({
    schema: PayoffFormSchema,
    defaultValues: {
      sourceAccountId: defaultSourceAccountId(),
      destinationAccountId: defaultDestinationId(),
      amount: 50,
      memo: '',
    },
    onSubmit: async (values) => {
      try {
        setSubmitting(true);
        setError(null);
        await props.onSubmit(values);
        props.onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not submit payoff');
      } finally {
        setSubmitting(false);
      }
    },
  });

  createEffect(() => {
    if (!props.open) return;
    form.reset({
      sourceAccountId: defaultSourceAccountId(),
      destinationAccountId: defaultDestinationId(),
      amount: 50,
      memo: '',
    });
    setError(null);
  });

  const fundingOptions = createMemo(() =>
    props.fundingAccounts.map((account) => ({
      id: account._id,
      label: `${account.name} (${formatCurrency(account.balance.cents)})`,
    }))
  );

  const creditOptions = createMemo(() =>
    props.creditAccounts.map((account) => ({
      id: account._id,
      label: `${account.name} (${formatCurrency(account.balance.cents)})`,
    }))
  );

  return (
    <Modal
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
        }
        props.onOpenChange(open);
      }}
      title="Credit payoff"
      description="Move funds from a cash account to pay down a credit balance."
      footer={
        <FormActions align="between">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)} disabled={isSubmitting()}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => form.handleSubmit()}
            disabled={isSubmitting() || !props.fundingAccounts.length || !props.creditAccounts.length}
          >
            {isSubmitting() ? 'Submitting…' : 'Submit payoff'}
          </Button>
        </FormActions>
      }
    >
      <form class="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
        <FormField form={form} name="amount" label="Payoff amount" description="Amount to move toward the credit balance">
          {(field) => (
            <Input
              type="number"
              min="1"
              step="0.01"
              value={field.state.value ?? ''}
              onInput={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
              class="h-11"
            />
          )}
        </FormField>
        <FormField form={form} name="sourceAccountId" label="Funding account">
          {(field) => (
            <select
              class="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
            >
              <option value="" disabled>
                Select account
              </option>
              {fundingOptions().map((option) => (
                <option value={option.id}>{option.label}</option>
              ))}
            </select>
          )}
        </FormField>
        <FormField form={form} name="destinationAccountId" label="Credit account">
          {(field) => (
            <select
              class="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
            >
              <option value="" disabled>
                Select credit account
              </option>
              {creditOptions().map((option) => (
                <option value={option.id}>{option.label}</option>
              ))}
            </select>
          )}
        </FormField>
        <FormField form={form} name="memo" label="Memo (optional)">
          {(field) => (
            <Input
              type="text"
              value={field.state.value ?? ''}
              onInput={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
              class="h-11"
              placeholder="Add context for the payoff"
            />
          )}
        </FormField>
        <Show when={error()}>
          {(message) => <p class="text-xs text-rose-600">{message()}</p>}
        </Show>
      </form>
    </Modal>
  );
};
