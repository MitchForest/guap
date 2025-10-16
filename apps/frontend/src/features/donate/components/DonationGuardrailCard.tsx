import { createSignal, createEffect, Show, type Component } from 'solid-js';
import type { DonationGuardrailSummary } from '@guap/api';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';

const approvalOptions: Array<{ id: DonationGuardrailSummary['approvalPolicy']; label: string }> = [
  { id: 'auto', label: 'Auto approve' },
  { id: 'parent_required', label: 'Parent approval' },
  { id: 'admin_only', label: 'Admin only' },
];

type DonationGuardrailCardProps = {
  guardrail: DonationGuardrailSummary;
  onSave: (policy: DonationGuardrailSummary['approvalPolicy'], autoApproveUpToCents: number | null) => Promise<void>;
  disabled?: boolean;
};

export const DonationGuardrailCard: Component<DonationGuardrailCardProps> = (props) => {
  const [policy, setPolicy] = createSignal<DonationGuardrailSummary['approvalPolicy']>(props.guardrail.approvalPolicy);
  const [limit, setLimit] = createSignal<string>(
    props.guardrail.autoApproveUpToCents != null ? String(props.guardrail.autoApproveUpToCents / 100) : ''
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    setPolicy(props.guardrail.approvalPolicy);
    setLimit(
      props.guardrail.autoApproveUpToCents != null ? String(props.guardrail.autoApproveUpToCents / 100) : ''
    );
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const parsed = Number.parseFloat(limit());
      const cents = limit().trim().length && Number.isFinite(parsed)
        ? Math.max(0, Math.round(parsed * 100))
        : null;
      await props.onSave(policy(), cents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update guardrail');
    } finally {
      setSaving(false);
    }
  };

  const limitDisabled = () => policy() !== 'auto';

  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-900">Donation guardrail</p>
          <p class="text-xs text-slate-500">Control when donations auto-execute versus require review.</p>
        </div>
      </div>
      <div class="mt-4 flex flex-col gap-4">
        <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Approval policy
        </label>
        <div class="flex flex-wrap gap-2">
          {approvalOptions.map((option) => {
            const active = () => policy() === option.id;
            return (
              <button
                type="button"
                class={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active() ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
                onClick={() => setPolicy(option.id)}
                disabled={props.disabled || saving()}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Auto-approve up to (USD)
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={limit()}
            onInput={(event) => setLimit(event.currentTarget.value)}
            disabled={limitDisabled() || props.disabled || saving()}
            class="h-11"
          />
          <Show when={limitDisabled()}>
            <p class="text-xs text-slate-400">Enable auto approval to set an amount threshold.</p>
          </Show>
        </div>
        <Show when={error()}>
          {(message) => <p class="text-xs text-rose-600">{message()}</p>}
        </Show>
        <div class="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={props.disabled || saving()}
          >
            {saving() ? 'Saving…' : 'Save guardrail'}
          </Button>
        </div>
      </div>
    </div>
  );
};
