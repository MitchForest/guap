import { Component, Show } from 'solid-js';
import { Button } from '~/components/ui/button';
import { useAppData } from '~/contexts/AppDataContext';

const planLabels: Record<string, string> = {
  free: 'Free sandbox',
  household: 'Household plan',
  organization: 'Organization-sponsored',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  inactive: 'Not active',
  past_due: 'Past due',
  canceled: 'Canceled',
};

const HouseholdBillingPage: Component = () => {
  const { activeHousehold } = useAppData();
  const plan = () => activeHousehold()?.plan ?? 'free';
  const status = () => activeHousehold()?.planStatus ?? 'inactive';
  const interval = () => activeHousehold()?.planInterval ?? 'monthly';

  return (
    <div class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-900">Billing & plans</h1>
        <p class="text-sm text-slate-600">
          Upgrade when you want to connect real accounts. Stay on the free sandbox until you're ready.
        </p>
      </header>

      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Current plan</h2>
        <div class="mt-4 space-y-2">
          <p class="text-lg font-semibold text-slate-900">{planLabels[plan()] ?? plan()}</p>
          <p class="text-sm text-slate-600">Status: {statusLabels[status()] ?? status()}</p>
          <Show when={plan() !== 'free'}>
            <p class="text-sm text-slate-600">Billing interval: {interval()}</p>
          </Show>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" class="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
            Upgrade household plan
          </Button>
          <Button type="button" variant="secondary" class="rounded-2xl border border-slate-300">
            Redeem invite code
          </Button>
        </div>

        <p class="mt-4 text-xs text-slate-500">
          Upgrades will connect you to secure bank data and unlock automations with real money. We'll add
          Stripe checkout when we're ready to process payments.
        </p>
      </section>
    </div>
  );
};

export default HouseholdBillingPage;
