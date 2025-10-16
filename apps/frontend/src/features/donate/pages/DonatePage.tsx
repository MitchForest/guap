import { For, Show, createMemo, createSignal, type Component } from 'solid-js';
import type { DonationCause, DonationGuardrailSummary, ScheduleDonationInput } from '@guap/api';
import { useAppData } from '~/app/contexts/AppDataContext';
import { PageContainer } from '~/shared/components/layout/PageContainer';
import { DataState } from '~/shared/components/data/DataState';
import { notifyError, notifyInfo, notifySuccess } from '~/shared/services/notifications';
import { trackEvent } from '~/shared/services/analytics';
import { formatCurrency } from '~/shared/utils/format';
import { organizationIdFor } from '~/features/money-map/api/cache';
import { guapApi } from '~/shared/services/guapApi';
import { DonateHero } from '../components/DonateHero';
import { DonationCauseGrid } from '../components/DonationCauseGrid';
import { DonationHistoryList } from '../components/DonationHistoryList';
import { UpcomingDonationsList } from '../components/UpcomingDonationsList';
import { ScheduleDonationDrawer } from '../components/ScheduleDonationDrawer';
import { scheduleDonation } from '../api/client';
import { DonationGuardrailCard } from '../components/DonationGuardrailCard';
import { createDonateData } from '../state/createDonateData';

const DonatePage: Component = () => {
  const { accounts, activeHousehold } = useAppData();
  const householdId = createMemo(() => activeHousehold()?._id ?? null);
  const organizationId = createMemo(() =>
    householdId() ? organizationIdFor(householdId()!) : null
  );

  const donateData = createDonateData(organizationId);

  const donationAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'donation')
  );
  const fundingAccounts = createMemo(() =>
    accounts().filter((account) => account.kind !== 'donation' && account.kind !== 'liability')
  );

  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [selectedCause, setSelectedCause] = createSignal<DonationCause | null>(null);

  const openDrawer = (cause: DonationCause) => {
    setSelectedCause(cause);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedCause(null);
  };

  const handleScheduleDonation = async (input: ScheduleDonationInput) => {
    if (!organizationId()) {
      notifyError('No household selected');
      return;
    }

    try {
      const payload: ScheduleDonationInput = {
        ...input,
        organizationId: organizationId()!,
      };
      const result = await scheduleDonation(payload);
      await donateData.refetch();

      if (result.autoExecuted) {
        notifySuccess('Donation completed', {
          description: `${result.cause.name} received ${formatCurrency(result.transfer.amount.cents)}.`,
        });
      } else {
        notifyInfo('Donation scheduled', {
          description: `${result.cause.name} is pending approval.`,
        });
      }

      trackEvent({
        name: 'donation_scheduled',
        properties: {
          causeId: result.cause.id,
          autoExecuted: result.autoExecuted,
        },
      });
    } catch (error) {
      notifyError('Could not schedule donation', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  const handleGuardrailSave = async (
    policy: DonationGuardrailSummary['approvalPolicy'],
    autoApproveUpToCents: number | null
  ) => {
    if (!organizationId()) {
      notifyError('No household selected');
      return;
    }
    const donationAccount = donationAccounts()[0];
    if (!donationAccount) {
      notifyError('No donation account available');
      return;
    }
    try {
      await guapApi.donate.updateGuardrail({
        organizationId: organizationId()!,
        accountId: donationAccount._id,
        approvalPolicy: policy,
        autoApproveUpToCents,
      });
      await donateData.refetch();
      notifySuccess('Guardrail updated', {
        description:
          policy === 'auto'
            ? `Auto approvals up to ${autoApproveUpToCents != null ? formatCurrency(autoApproveUpToCents) : 'no limit'}.`
            : 'Donations will require review.',
      });
      trackEvent({
        name: 'donation_guardrail_updated',
        properties: {
          policy,
          autoApproveUpToCents,
        },
      });
    } catch (error) {
      notifyError('Unable to update donation guardrail', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  const causesStatus = () => {
    if (donateData.isLoading()) return 'loading' as const;
    if (donateData.error()) return 'error' as const;
    return donateData.causes().length ? ('success' as const) : ('empty' as const);
  };

  const historyStatus = () => {
    if (donateData.isLoading()) return 'loading' as const;
    if (donateData.error()) return 'error' as const;
    return 'success' as const;
  };

  return (
    <PageContainer>
      <div class="flex flex-col gap-6">
        <DonateHero summary={donateData.summary()} guardrail={donateData.guardrail()} />

        <section class="space-y-4">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Causes</h2>
              <p class="text-sm text-slate-500">
                Choose a partner organization and schedule new donations in a few taps.
              </p>
            </div>
            <Show when={!donationAccounts().length}>
              <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Add a donation account in Money Map to activate scheduling
              </span>
            </Show>
          </div>

          <DataState
            status={causesStatus()}
            loadingFallback={<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <For each={[0, 1, 2]}>
                {() => <div class="h-40 animate-pulse rounded-2xl bg-slate-100" />}
              </For>
            </div>}
            emptyFallback={
              <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Causes will appear here once configured.
              </div>
            }
            errorFallback={
              <div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
                Unable to load causes right now.
              </div>
            }
          >
            <DonationCauseGrid
              causes={donateData.causes()}
              onSelect={(cause) => openDrawer(cause)}
            />
          </DataState>
        </section>

        <section class="grid gap-6 lg:grid-cols-2">
          <DonationGuardrailCard
            guardrail={donateData.guardrail()}
            onSave={handleGuardrailSave}
            disabled={!donationAccounts().length}
          />
          <DataState
            status={historyStatus()}
            loadingFallback={<div class="h-40 animate-pulse rounded-2xl bg-slate-100" />}
          >
            <DonationHistoryList entries={donateData.history()} />
          </DataState>
          <DataState
            status={historyStatus()}
            loadingFallback={<div class="h-40 animate-pulse rounded-2xl bg-slate-100" />}
          >
            <UpcomingDonationsList entries={donateData.upcoming()} />
          </DataState>
        </section>
      </div>

      <ScheduleDonationDrawer
        open={drawerOpen()}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
          else setDrawerOpen(open);
        }}
        cause={selectedCause()}
        organizationId={organizationId()}
        fundingAccounts={fundingAccounts()}
        donationAccounts={donationAccounts()}
        onSubmit={handleScheduleDonation}
      />
    </PageContainer>
  );
};

export default DonatePage;
