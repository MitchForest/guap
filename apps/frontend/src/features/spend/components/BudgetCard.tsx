import { createSignal, Show, type Component } from 'solid-js';
import type { BudgetWithActuals } from '@guap/api';
import { Button } from '~/shared/components/ui/button';
import { formatCurrency, formatPercent } from '~/shared/utils/format';

export type BudgetCardProps = {
  record: BudgetWithActuals;
  label: string;
  onSaveGuardrail: (autoApproveUpToCents: number | null) => Promise<void>;
};

const centsToDollars = (value: number | null | undefined) => {
  if (!value) return '';
  return (value / 100).toString();
};

const dollarsToCents = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round(parsed * 100));
};

export const BudgetCard: Component<BudgetCardProps> = (props) => {
  const [editing, setEditing] = createSignal(false);
  const [pendingValue, setPendingValue] = createSignal(
    centsToDollars(props.record.guardrail?.autoApproveUpToCents ?? null)
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSave = async () => {
    if (saving()) return;
    setSaving(true);
    setError(null);
    try {
      const cents = dollarsToCents(pendingValue());
      const normalized = cents != null && cents > 0 ? cents : null;
      await props.onSaveGuardrail(normalized);
      setPendingValue(centsToDollars(normalized));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update guardrail');
    } finally {
      setSaving(false);
    }
  };

  const guardrailLabel = () => {
    const summary = props.record.guardrail;
    if (!summary) return 'Parent approval required';
    if (summary.approvalPolicy === 'auto') {
      const limit = summary.autoApproveUpToCents;
      if (limit == null) return 'Auto approve';
      return `Auto approve up to ${formatCurrency(limit)}`;
    }
    return 'Parent approval required';
  };

  return (
    <div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-slate-900">{props.label}</p>
          <p class="text-xs text-slate-500">
            Planned {formatCurrency(props.record.budget.plannedAmount.cents)} • Spent{' '}
            {formatCurrency(props.record.actuals.spentAmount.cents)}
          </p>
        </div>
        <span
          class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${props.record.actuals.overspent ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}
        >
          {props.record.actuals.overspent ? 'Overspent' : 'On track'}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-4 text-sm text-slate-700">
        <div>
          <p class="text-xs uppercase tracking-widest text-slate-400">Remaining</p>
          <p class="font-semibold text-slate-900">
            {formatCurrency(props.record.actuals.remainingAmount.cents)}
          </p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-widest text-slate-400">Used</p>
          <p class="font-semibold text-slate-900">
            {formatPercent(props.record.actuals.percentageUsed * 100, 0)}
          </p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-widest text-slate-400">Transactions</p>
          <p class="font-semibold text-slate-900">{props.record.actuals.transactionsCount}</p>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 p-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Guardrail</p>
        <p class="text-sm text-slate-700">{guardrailLabel()}</p>
        <Show when={editing()} fallback={
          <Button variant="secondary" size="sm" class="mt-3" onClick={() => setEditing(true)}>
            Edit guardrail
          </Button>
        }>
          <div class="mt-3 flex flex-col gap-2">
            <label class="text-xs uppercase tracking-widest text-slate-400">Auto-approve up to</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pendingValue()}
              onInput={(event) => setPendingValue(event.currentTarget.value)}
              class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="0.00"
            />
            <div class="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving()}>
                {saving() ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendingValue(centsToDollars(props.record.guardrail?.autoApproveUpToCents ?? null));
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
            <Show when={error()}>
              <p class="text-xs text-rose-600">{error()}</p>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};
