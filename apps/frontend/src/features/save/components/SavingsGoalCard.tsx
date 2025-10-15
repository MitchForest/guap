import { Show, type Component } from 'solid-js';
import type { SavingsGoalWithProgress } from '@guap/api';
import { Button } from '~/shared/components/ui/button';
import { formatCurrency } from '~/shared/utils/format';
import { describeGuardrail } from '../utils/guardrails';

type SavingsGoalCardProps = {
  goal: SavingsGoalWithProgress;
  accountName?: string;
  onRequestTransfer: (goal: SavingsGoalWithProgress) => void;
};

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  achieved: 'bg-emerald-600 text-white',
  archived: 'bg-slate-200 text-slate-600',
};

const formatDate = (timestamp: number | null | undefined) => {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp);
};

export const SavingsGoalCard: Component<SavingsGoalCardProps> = (props) => {
  const completionPercent = () =>
    Math.round(Math.min(1, props.goal.progress.percentageComplete) * 100);

  const remainingCents = () =>
    Math.max(0, props.goal.goal.targetAmount.cents - props.goal.progress.currentAmount.cents);

  const targetDateLabel = () => formatDate(props.goal.goal.targetDate ?? null);
  const projectedCompletionDate = () => formatDate(props.goal.progress.projectedCompletionDate);

  const statusTone = () =>
    statusClasses[props.goal.goal.status] ?? 'bg-slate-200 text-slate-600';

  return (
    <div class="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col">
            <p class="text-sm font-semibold text-slate-900">{props.goal.goal.name}</p>
            <Show when={props.accountName}>
              {(accountName) => (
                <p class="text-xs text-slate-500">
                  Funding account · {accountName()}
                </p>
              )}
            </Show>
          </div>
          <span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone()}`}>
            {props.goal.goal.status.replace(/_/g, ' ')}
          </span>
        </div>
        <div class="rounded-full bg-slate-100">
          <div
            class="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${completionPercent()}%` }}
          />
        </div>
        <div class="flex justify-between text-xs text-slate-500">
          <span>{formatCurrency(props.goal.progress.currentAmount.cents)} progress</span>
          <span>{completionPercent()}%</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 text-xs text-slate-600">
        <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p class="uppercase tracking-[0.18em] text-[10px] text-slate-400">Target</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(props.goal.goal.targetAmount.cents)}
          </p>
          <Show when={targetDateLabel()}>
            {(label) => <p class="mt-1 text-[11px] text-slate-500">By {label()}</p>}
          </Show>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p class="uppercase tracking-[0.18em] text-[10px] text-slate-400">Remaining</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(remainingCents())}
          </p>
          <Show when={projectedCompletionDate()}>
            {(label) => <p class="mt-1 text-[11px] text-slate-500">Projected {label()}</p>}
          </Show>
        </div>
      </div>
      <div class="flex flex-col gap-1 text-[11px] text-slate-500">
        <span class="font-semibold uppercase tracking-[0.12em] text-slate-400">Guardrails</span>
        <span>Deposits — {describeGuardrail(props.goal.guardrails.deposit, 'deposit')}</span>
        <span>Withdrawals — {describeGuardrail(props.goal.guardrails.withdrawal, 'withdrawal')}</span>
      </div>
      <div class="mt-auto flex items-center justify-between">
        <Show when={props.goal.progress.lastContributionAt}>
          {(timestamp) => (
            <p class="text-xs text-slate-500">
              Last contribution {formatDate(timestamp() ?? null)}
            </p>
          )}
        </Show>
        <Button
          variant="secondary"
          size="sm"
          class="ml-auto"
          onClick={() => props.onRequestTransfer(props.goal)}
        >
          Add contribution
        </Button>
      </div>
    </div>
  );
};
