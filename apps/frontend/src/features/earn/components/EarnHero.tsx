import type { Component } from 'solid-js';
import type { EarnSummary } from '@guap/api';
import { Button } from '~/shared/components/ui/button';
import { formatCurrency } from '~/shared/utils/format';

type EarnHeroProps = {
  summary: EarnSummary | null;
  streamsCount: number;
  loading?: boolean;
  onCreateStream: () => void;
  onRequestPayout?: () => void;
};

export const EarnHero: Component<EarnHeroProps> = (props) => {
  const totalMonthly = () => props.summary?.totalMonthlyCents ?? 0;
  const upcoming = () => props.summary?.upcomingPayout ?? null;
  const streak = () => props.summary?.streakLength ?? 0;

  return (
    <div class="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="flex flex-1 flex-col gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monthly inflow</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totalMonthly())}</p>
          <p class="text-sm text-slate-600">
            {props.streamsCount} active {props.streamsCount === 1 ? 'stream' : 'streams'} powering allowance and chores.
          </p>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next payout</p>
            {upcoming() ? (
              <>
                <p class="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(upcoming()!.amount.cents)}</p>
                <p class="text-xs text-slate-500">
                  {new Date(upcoming()!.scheduledAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {upcoming()!.autoScheduled ? ' • auto' : ' • needs review'}
                </p>
              </>
            ) : (
              <p class="mt-2 text-sm text-slate-500">Schedule allowance to see it here.</p>
            )}
          </div>
          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current streak</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{streak()} approvals</p>
            <p class="text-xs text-slate-500">
              {props.summary?.lastCompletedAt
                ? `Last complete ${new Date(props.summary.lastCompletedAt).toLocaleDateString()}`
                : 'No payouts yet'}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick action</p>
            <p class="mt-2 text-sm text-slate-600">Kick off a new earning stream or mark work complete.</p>
            <div class="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => props.onCreateStream()}>
                New stream
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => props.onRequestPayout?.()}
                disabled={!props.onRequestPayout}
              >
                Request payout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
