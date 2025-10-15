import { Show, createEffect, createMemo, createSignal, type Component } from 'solid-js';
import type {
  FinancialAccountRecord,
  SavingsGoalWithProgress,
  SavingsGuardrailSummary,
  SavingsTransferResult,
} from '@guap/api';
import { z } from 'zod';
import { Modal } from '~/shared/components/layout';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { FormActions, FormField } from '~/shared/forms/FormField';
import { createGuapForm } from '~/shared/forms/createGuapForm';
import { notifyInfo, notifySuccess, notifyError } from '~/shared/services/notifications';
import { reportError } from '~/shared/services/errors';
import { initiateSavingsTransfer } from '../api/client';
import { formatCurrency } from '~/shared/utils/format';
import { describeGuardrail } from '../utils/guardrails';

const defaultGuardrailSummary: SavingsGuardrailSummary = {
  approvalPolicy: 'parent_required',
  autoApproveUpToCents: null,
  scope: null,
};

const TransferFormSchema = z.object({
  amount: z.coerce.number().positive('Enter a contribution amount'),
  sourceAccountId: z.string().min(1, 'Choose a funding account'),
  memo: z
    .string()
    .max(140, 'Keep notes under 140 characters')
    .optional(),
});

type TransferModalProps = {
  goal: SavingsGoalWithProgress | null;
  organizationId: string | null;
  sourceAccounts: FinancialAccountRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => Promise<void> | void;
};

const centsFromDollars = (value: number) => Math.round(value * 100);

export const TransferModal: Component<TransferModalProps> = (props) => {
  const [isSubmitting, setSubmitting] = createSignal(false);

  const goalGuardrails = createMemo(() =>
    props.goal ? (props.goal as SavingsGoalWithProgress).guardrails : undefined
  );

  const defaultSourceAccountId = createMemo(() => {
    if (!props.goal) return props.sourceAccounts[0]?._id ?? '';
    const matching = props.sourceAccounts.find(
      (account) => account._id !== props.goal?.goal.accountId
    );
    return matching?._id ?? props.sourceAccounts[0]?._id ?? '';
  });

  const form = createGuapForm({
    schema: TransferFormSchema,
    defaultValues: {
      amount: 25,
      sourceAccountId: defaultSourceAccountId(),
      memo: '',
    },
    onSubmit: async (values) => {
      if (!props.organizationId || !props.goal) return;
      try {
        setSubmitting(true);
        const cents = centsFromDollars(values.amount);
        const response: SavingsTransferResult = await initiateSavingsTransfer({
          organizationId: props.organizationId,
          goalId: props.goal.goal._id,
          sourceAccountId: values.sourceAccountId,
          memo: values.memo?.trim() ? values.memo.trim() : undefined,
          amount: {
            cents,
            currency: props.goal.goal.targetAmount.currency ?? 'USD',
          },
        });

        const guardrailSummary = response.guardrail ?? defaultGuardrailSummary;
        const guardrailDescription = describeGuardrail(guardrailSummary, response.direction);
        const toastDescription = `${formatCurrency(cents)} toward ${props.goal.goal.name}. ${guardrailDescription}`;

        if (response.transfer.status === 'executed') {
          notifySuccess('Contribution sent', {
            description: toastDescription,
          });
        } else {
          notifyInfo('Contribution pending approval', {
            description: toastDescription,
          });
        }

        await props.onSubmitted();
        props.onOpenChange(false);
      } catch (error) {
        reportError(error, 'initiateSavingsTransfer');
        notifyError('Could not submit contribution', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setSubmitting(false);
      }
    },
  });

  createEffect(() => {
    if (!props.open) return;
    form.reset({
      amount: 25,
      sourceAccountId: defaultSourceAccountId(),
      memo: '',
    });
  });

  const fundingOptions = createMemo(() =>
    props.sourceAccounts.map((account) => ({
      id: account._id,
      label: `${account.name} (${formatCurrency(account.balance.cents)})`,
    }))
  );

  const depositGuardrail = createMemo(
    () => goalGuardrails()?.deposit ?? defaultGuardrailSummary
  );
  const withdrawalGuardrail = createMemo(
    () => goalGuardrails()?.withdrawal ?? defaultGuardrailSummary
  );

  const guardrailMessage = () => describeGuardrail(depositGuardrail(), 'deposit');
  const withdrawalMessage = () => describeGuardrail(withdrawalGuardrail(), 'withdrawal');

  return (
    <Modal
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
        }
        props.onOpenChange(open);
      }}
      title={props.goal ? `Contribute to ${props.goal.goal.name}` : 'Select a goal'}
      description="Move money from checking into a dedicated goal balance."
      footer={
        <FormActions align="between">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)} disabled={isSubmitting()}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => form.handleSubmit()}
            disabled={isSubmitting() || !props.goal || !props.organizationId}
          >
            {isSubmitting() ? 'Submitting…' : 'Submit contribution'}
          </Button>
        </FormActions>
      }
    >
      <Show when={props.goal}>
        {(goal) => (
          <form class="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <div class="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <span class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Goal snapshot
              </span>
              <span class="text-sm font-semibold text-slate-900">
                {formatCurrency(goal().progress.currentAmount.cents)} of{' '}
                {formatCurrency(goal().goal.targetAmount.cents)}
              </span>
              <p class="text-xs text-slate-500">{guardrailMessage()}</p>
              <p class="text-[11px] text-slate-400">{withdrawalMessage()}</p>
            </div>
            <div class="flex flex-col gap-4">
              <FormField
                form={form}
                name="amount"
                label="Contribution amount"
                description="Enter the amount to move into savings"
              >
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
              <FormField
                form={form}
                name="sourceAccountId"
                label="Funding account"
                description="Choose the account to pull funds from"
              >
                {(field) => (
                  <select
                    value={field.state.value ?? defaultSourceAccountId()}
                    onChange={(event) => field.handleChange(event.currentTarget.value)}
                    onBlur={field.handleBlur}
                    class="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                  >
                    {fundingOptions().map((option) => (
                      <option value={option.id}>{option.label}</option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField
                form={form}
                name="memo"
                label="Note (optional)"
                description="Add context for the approval queue"
              >
                {(field) => (
                  <Input
                    value={field.state.value ?? ''}
                    onInput={(event) => field.handleChange(event.currentTarget.value)}
                    onBlur={field.handleBlur}
                    placeholder="Weekly allowance sweep"
                  />
                )}
              </FormField>
            </div>
          </form>
        )}
      </Show>
    </Modal>
  );
};
