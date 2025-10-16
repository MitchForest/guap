import { Show, createEffect, createMemo, createSignal, type Component } from 'solid-js';
import { z } from 'zod';
import type { DonationCadence, DonationCause, ScheduleDonationInput } from '@guap/api';
import type { FinancialAccountRecord } from '@guap/api';
import { Drawer } from '~/shared/components/layout/Drawer';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { FormActions, FormField } from '~/shared/forms/FormField';
import { createGuapForm } from '~/shared/forms/createGuapForm';
import { formatCurrency } from '~/shared/utils/format';

const DonationCadenceSchema = z.enum(['weekly', 'monthly', 'quarterly', 'yearly']);

const DonationFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Select a funding account'),
  destinationAccountId: z.string().min(1, 'Select a donation account'),
  amount: z.coerce.number().positive('Enter a donation amount'),
  scheduledFor: z
    .string()
    .nullable()
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      'Enter a valid date'
    )
    .optional(),
  recurringCadence: DonationCadenceSchema.nullable().optional(),
  memo: z
    .string()
    .max(140, 'Keep notes under 140 characters')
    .optional(),
});

export type DonationFormValues = z.infer<typeof DonationFormSchema>;

type ScheduleDonationDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cause: DonationCause | null;
  organizationId: string | null;
  fundingAccounts: FinancialAccountRecord[];
  donationAccounts: FinancialAccountRecord[];
  onSubmit: (input: ScheduleDonationInput) => Promise<void>;
};

const cadenceOptions: Array<{ id: DonationCadence; label: string }> = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

export const ScheduleDonationDrawer: Component<ScheduleDonationDrawerProps> = (props) => {
  const [isSubmitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const defaultAmount = () =>
    (props.cause?.recommendedAmount?.cents ?? 2500) / 100;

  const defaultSourceAccountId = createMemo(
    () => props.fundingAccounts[0]?._id ?? ''
  );
  const defaultDestinationId = createMemo(
    () => props.donationAccounts[0]?._id ?? ''
  );

  const form = createGuapForm({
    schema: DonationFormSchema,
    defaultValues: {
      sourceAccountId: defaultSourceAccountId(),
      destinationAccountId: defaultDestinationId(),
      amount: defaultAmount(),
      scheduledFor: null,
      recurringCadence: null,
      memo: '',
    },
    onSubmit: async ({ amount, scheduledFor, recurringCadence, memo, ...rest }) => {
      if (!props.cause || !props.organizationId) return;
      try {
        setSubmitting(true);
        setError(null);
        const parsedSchedule =
          scheduledFor && scheduledFor.length ? Date.parse(scheduledFor) : null;
        const scheduledTimestamp =
          parsedSchedule != null && !Number.isNaN(parsedSchedule) ? parsedSchedule : null;
        const input: ScheduleDonationInput = {
          organizationId: props.organizationId,
          causeId: props.cause.id,
          amount: {
            cents: Math.round(amount * 100),
            currency: 'USD',
          },
          memo: memo?.trim() ? memo.trim() : undefined,
          scheduledFor: scheduledTimestamp,
          recurringCadence: recurringCadence ?? null,
          ...rest,
        };
        await props.onSubmit(input);
        props.onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not schedule donation');
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
      amount: defaultAmount(),
      scheduledFor: null,
      recurringCadence: null,
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

  const donationOptions = createMemo(() =>
    props.donationAccounts.map((account) => ({
      id: account._id,
      label: `${account.name} (${formatCurrency(account.balance.cents)})`,
    }))
  );

  return (
    <Drawer
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
        }
        props.onOpenChange(open);
      }}
      title={props.cause ? `Support ${props.cause.name}` : 'Schedule donation'}
    >
      <form class="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
        <FormField form={form} name="amount" label="Donation amount">
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

        <FormField form={form} name="destinationAccountId" label="Donation account">
          {(field) => (
            <select
              class="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
            >
              <option value="" disabled>
                Select donation account
              </option>
              {donationOptions().map((option) => (
                <option value={option.id}>{option.label}</option>
              ))}
            </select>
          )}
        </FormField>

        <FormField form={form} name="scheduledFor" label="Schedule date (optional)">
          {(field) => (
            <Input
              type="date"
              value={field.state.value ?? ''}
              onInput={(event) => field.handleChange(event.currentTarget.value)}
              onBlur={field.handleBlur}
              class="h-11"
            />
          )}
        </FormField>

        <FormField form={form} name="recurringCadence" label="Recurring cadence">
          {(field) => (
            <select
              class="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={field.state.value ?? ''}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value ? event.currentTarget.value : null)
              }
              onBlur={field.handleBlur}
            >
              <option value="">One-time</option>
              {cadenceOptions.map((option) => (
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
              placeholder="Add context for the household"
            />
          )}
        </FormField>

        <Show when={error()}>
          {(message) => <p class="text-xs text-rose-600">{message()}</p>}
        </Show>
      </form>

      <div class="mt-6">
        <FormActions align="between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onOpenChange(false)}
            disabled={isSubmitting()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => form.handleSubmit()}
            disabled={
              isSubmitting() ||
              !props.fundingAccounts.length ||
              !props.donationAccounts.length ||
              !props.organizationId ||
              !props.cause
            }
          >
            {isSubmitting() ? 'Scheduling…' : 'Schedule donation'}
          </Button>
        </FormActions>
      </div>
    </Drawer>
  );
};
