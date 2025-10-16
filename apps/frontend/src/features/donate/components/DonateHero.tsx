import { Show, type Component } from 'solid-js';
import type { DonationGuardrailSummary, DonationSummary } from '@guap/api';
import { formatCurrency, formatPercent } from '~/shared/utils/format';

type DonateHeroProps = {
  summary: DonationSummary;
  guardrail: DonationGuardrailSummary;
};

const formatDateTime = (timestamp: number | null) => {
  if (!timestamp) return 'No donations yet';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
};

export const guardrailDescription = (guardrail: DonationGuardrailSummary) => {
  if (guardrail.approvalPolicy === 'auto') {
    if (guardrail.autoApproveUpToCents != null) {
      return `Auto-approves up to ${formatCurrency(guardrail.autoApproveUpToCents)}`;
    }
    return 'Auto-approves donation submissions';
  }
  if (guardrail.approvalPolicy === 'admin_only') {
    return 'Only admins can approve donations';
  }
  return 'Parent approval required for donations';
};

export const DonateHero: Component<DonateHeroProps> = (props) => {
  const percentTowardTarget = () =>
    Math.min(1, Math.max(0, props.summary.percentTowardTarget));

  return (
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Year-to-date giving
            </p>
            <p class="mt-2 text-4xl font-semibold text-slate-900">
              {formatCurrency(props.summary.yearToDate.cents)}
            </p>
            <p class="text-sm text-slate-500">
              {props.summary.totalDonations} donation
              {props.summary.totalDonations === 1 ? '' : 's'} logged • Last gift{' '}
              {formatDateTime(props.summary.lastDonationAt)}
            </p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Monthly average
              </p>
              <p class="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(props.summary.monthlyAverage.cents)}
              </p>
            </div>
            <div class="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Annual goal progress
              </p>
              <Show when={props.summary.target}>
                {(target) => (
                  <>
                    <p class="mt-1 text-lg font-semibold text-slate-900">
                      {formatPercent(percentTowardTarget() * 100, 0)}
                    </p>
                    <p class="text-xs text-slate-500">
                      Target {formatCurrency(target().cents)}
                    </p>
                    <div class="mt-2 h-2 rounded-full bg-slate-200">
                      <div
                        class="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${percentTowardTarget() * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </Show>
              <Show when={!props.summary.target}>
                <p class="mt-1 text-sm text-slate-500">Add a budget to track yearly progress.</p>
              </Show>
            </div>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 sm:px-6 sm:py-6">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Guardrail policy
          </p>
          <p class="mt-2 text-base font-semibold text-slate-900">
            {guardrailDescription(props.guardrail)}
          </p>
          <p class="mt-1 text-xs text-slate-500">
            Scope: {props.guardrail.scope ?? 'organization'}
          </p>
        </div>
      </div>
    </section>
  );
};
