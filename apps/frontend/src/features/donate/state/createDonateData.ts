import { Accessor, createMemo } from 'solid-js';
import type {
  DonationOverview,
  DonationGuardrailSummary,
} from '@guap/api';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import { fetchDonationOverview } from '../api/client';

const zeroAmount = { cents: 0, currency: 'USD' } as const;

const emptyGuardrail: DonationGuardrailSummary = {
  approvalPolicy: 'parent_required',
  autoApproveUpToCents: null,
  scope: null,
};

const emptyOverview: DonationOverview = {
  summary: {
    yearToDate: zeroAmount,
    monthlyAverage: zeroAmount,
    target: null,
    percentTowardTarget: 0,
    totalDonations: 0,
    lastDonationAt: null,
  },
  causes: [],
  history: [],
  upcoming: [],
  guardrail: emptyGuardrail,
};

export const createDonateData = (organizationId: Accessor<string | null | undefined>) => {
  const overviewQuery = createGuapQuery<string, DonationOverview>({
    source: organizationId,
    initialValue: emptyOverview,
    fetcher: async (orgId) => await fetchDonationOverview(orgId, { historyLimit: 40 }),
  });

  const overview = () => overviewQuery.data();

  const summary = createMemo(() => overview().summary);
  const causes = createMemo(() => overview().causes);
  const history = createMemo(() => overview().history);
  const upcoming = createMemo(() => overview().upcoming);
  const guardrail = createMemo(() => overview().guardrail ?? emptyGuardrail);

  return {
    overview,
    summary,
    causes,
    history,
    upcoming,
    guardrail,
    isLoading: overviewQuery.isLoading,
    error: overviewQuery.error,
    refetch: overviewQuery.refetch,
  };
};
