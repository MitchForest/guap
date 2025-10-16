import { createEffect, createMemo, createSignal, type Component } from 'solid-js';
import type { FinancialAccountRecord, IncomeStreamRecord } from '@guap/api';
import { z } from 'zod';
import { Modal } from '~/shared/components/layout';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { FormActions, FormField } from '~/shared/forms/FormField';
import { createGuapForm } from '~/shared/forms/createGuapForm';
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectOption,
  SelectTrigger,
  SelectValue,
} from '~/shared/components/ui/select';

const cadenceOptions: Array<SelectOption> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every other week' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const StreamFormSchema = z.object({
  name: z.string().min(2, 'Give the stream a name'),
  cadence: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  amount: z.coerce.number().positive('Enter a payout amount'),
  autoSchedule: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  defaultDestinationAccountId: z.string().optional().nullable(),
  sourceAccountId: z.string().optional().nullable(),
});

export type StreamFormValues = z.infer<typeof StreamFormSchema>;

type StreamFormModalProps = {
  mode: 'create' | 'edit';
  open: boolean;
  stream: IncomeStreamRecord | null;
  accounts: FinancialAccountRecord[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StreamFormValues) => Promise<void>;
};

const centsToDollars = (cents: number) => Math.max(0, Math.round(cents) / 100);

export const StreamFormModal: Component<StreamFormModalProps> = (props) => {
  const [submitting, setSubmitting] = createSignal(false);

  const defaultValues = createMemo<StreamFormValues>(() => {
    if (!props.stream) {
      return {
        name: '',
        cadence: 'weekly',
        amount: 20,
        autoSchedule: true,
        requiresApproval: true,
        defaultDestinationAccountId: props.accounts[0]?._id ?? undefined,
        sourceAccountId: undefined,
      } satisfies StreamFormValues;
    }
    return {
      name: props.stream.name,
      cadence: props.stream.cadence,
      amount: centsToDollars(props.stream.amount.cents),
      autoSchedule: props.stream.autoSchedule,
      requiresApproval: props.stream.requiresApproval,
      defaultDestinationAccountId: props.stream.defaultDestinationAccountId ?? undefined,
      sourceAccountId: props.stream.sourceAccountId ?? undefined,
    } satisfies StreamFormValues;
  });

  const form = createGuapForm({
    schema: StreamFormSchema,
    defaultValues: defaultValues(),
    onSubmit: async (values) => {
      try {
        setSubmitting(true);
        await props.onSubmit(values);
        props.onOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    },
  });

  createEffect(() => {
    if (!props.open) return;
    form.reset(defaultValues());
  });

  const accountOptions = createMemo(() =>
    props.accounts.map<SelectOption>((account) => ({
      value: account._id,
      label: account.name,
    }))
  );

  return (
    <Modal
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          form.reset(defaultValues());
        }
        props.onOpenChange(open);
      }}
      title={props.mode === 'create' ? 'Create income stream' : 'Edit income stream'}
      description="Define cadence, guardrails, and destination for this payout."
      footer={
        <FormActions align="between">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)} disabled={submitting()}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => form.handleSubmit()} disabled={submitting()}>
            {submitting() ? 'Saving…' : props.mode === 'create' ? 'Create stream' : 'Save changes'}
          </Button>
        </FormActions>
      }
    >
      <form class="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
        <FormField form={form} name="name" label="Stream name">
          {(field) => (
            <Input
              type="text"
              value={field.state.value ?? ''}
              onInput={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
              placeholder="Weekly allowance"
            />
          )}
        </FormField>

        <div class="grid gap-4 md:grid-cols-2">
          <FormField form={form} name="cadence" label="Cadence">
            {(field) => (
              <Select
                options={cadenceOptions}
                optionValue="value"
                optionTextValue="label"
                value={field.state.value ?? 'weekly'}
                onChange={(option) => field.handleChange((option?.value as StreamFormValues['cadence']) ?? 'weekly')}
                onBlur={field.handleBlur}
                placeholder={<span class="truncate text-slate-400">Choose cadence</span>}
                itemComponent={(itemProps) => <SelectItem {...itemProps} />}
              >
                <SelectTrigger class="h-11 justify-between">
                  <SelectValue<SelectOption>>
                    {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Cadence'}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
                <SelectHiddenSelect />
              </Select>
            )}
          </FormField>
          <FormField form={form} name="amount" label="Amount (USD)">
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
        </div>

        <FormField form={form} name="defaultDestinationAccountId" label="Destination account">
          {(field) => (
            <Select
              options={accountOptions()}
              optionValue="value"
              optionTextValue="label"
              value={field.state.value ?? ''}
              onChange={(option) => field.handleChange(option?.value ?? undefined)}
              onBlur={field.handleBlur}
              placeholder={<span class="truncate text-slate-400">Select account</span>}
              itemComponent={(itemProps) => <SelectItem {...itemProps} />}
            >
              <SelectTrigger class="h-11 justify-between">
                <SelectValue<SelectOption>>
                  {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Select account'}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
              <SelectHiddenSelect />
            </Select>
          )}
        </FormField>

        <div class="grid gap-3 md:grid-cols-2">
          <FormField form={form} name="autoSchedule">
            {(field) => (
              <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={field.state.value ?? false}
                  onChange={(event) => field.handleChange(event.currentTarget.checked)}
                  class="mt-1 size-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                />
                <span>
                  Auto schedule
                  <span class="block text-xs text-slate-500">
                    Automatically request payouts on the cadence without manual review.
                  </span>
                </span>
              </label>
            )}
          </FormField>
          <FormField form={form} name="requiresApproval">
            {(field) => (
              <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={field.state.value ?? true}
                  onChange={(event) => field.handleChange(event.currentTarget.checked)}
                  class="mt-1 size-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                />
                <span>
                  Parent approval required
                  <span class="block text-xs text-slate-500">
                    Keep payouts pending until a parent approves. Turn off to auto-approve.
                  </span>
                </span>
              </label>
            )}
          </FormField>
        </div>
      </form>
    </Modal>
  );
};
