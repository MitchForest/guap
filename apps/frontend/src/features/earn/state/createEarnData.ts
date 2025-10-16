import { Accessor, createMemo } from 'solid-js';
import type {
  CreateIncomeStreamInput,
  EarnPayoutResult,
  EarnSummary,
  EarnTimelineEntry,
  IncomeStreamRecord,
  RequestIncomePayoutInput,
  SkipIncomePayoutInput,
  UpdateIncomeStreamInput,
} from '@guap/api';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import {
  createIncomeStream,
  fetchEarnSummary,
  fetchEarnTimeline,
  fetchIncomeStreams,
  requestIncomePayout,
  skipIncomePayout,
  updateIncomeStream,
} from '../api/client';

type EarnData = {
  streams: Accessor<IncomeStreamRecord[]>;
  streamsLoading: Accessor<boolean>;
  refetchStreams: () => Promise<IncomeStreamRecord[] | null | undefined>;
  summary: Accessor<EarnSummary | null>;
  summaryLoading: Accessor<boolean>;
  refetchSummary: () => Promise<EarnSummary | null | undefined>;
  timeline: Accessor<EarnTimelineEntry[]>;
  timelineLoading: Accessor<boolean>;
  refetchTimeline: () => Promise<EarnTimelineEntry[] | null | undefined>;
  createStream: (input: CreateIncomeStreamInput) => Promise<IncomeStreamRecord | null>;
  updateStream: (input: UpdateIncomeStreamInput) => Promise<IncomeStreamRecord | null>;
  requestPayout: (input: RequestIncomePayoutInput) => Promise<EarnPayoutResult | null>;
  skipPayout: (input: SkipIncomePayoutInput) => Promise<IncomeStreamRecord | null>;
};

export const createEarnData = (organizationId: Accessor<string | null | undefined>): EarnData => {
  const streamsQuery = createGuapQuery<string, IncomeStreamRecord[]>({
    source: organizationId,
    initialValue: [] as IncomeStreamRecord[],
    fetcher: async (orgId) => await fetchIncomeStreams(orgId),
  });

  const summaryQuery = createGuapQuery<string, EarnSummary | null>({
    source: organizationId,
    initialValue: null,
    fetcher: async (orgId) => await fetchEarnSummary(orgId),
  });

  const timelineQuery = createGuapQuery<string, EarnTimelineEntry[]>({
    source: organizationId,
    initialValue: [] as EarnTimelineEntry[],
    fetcher: async (orgId) => await fetchEarnTimeline(orgId, 40),
  });

  const streams = createMemo(() => streamsQuery.data());

  const createStream = async (input: CreateIncomeStreamInput) => {
    const result = await createIncomeStream(input);
    await Promise.all([streamsQuery.refetch(), summaryQuery.refetch()]);
    return result;
  };

  const updateStream = async (input: UpdateIncomeStreamInput) => {
    const result = await updateIncomeStream(input);
    await Promise.all([streamsQuery.refetch(), summaryQuery.refetch()]);
    return result;
  };

  const requestStreamPayout = async (input: RequestIncomePayoutInput) => {
    const result = await requestIncomePayout(input);
    await Promise.all([streamsQuery.refetch(), summaryQuery.refetch(), timelineQuery.refetch()]);
    return result;
  };

  const skipStreamPayout = async (input: SkipIncomePayoutInput) => {
    const result = await skipIncomePayout(input);
    await Promise.all([streamsQuery.refetch(), summaryQuery.refetch(), timelineQuery.refetch()]);
    return result;
  };

  return {
    streams,
    streamsLoading: streamsQuery.isLoading,
    refetchStreams: streamsQuery.refetch,
    summary: () => summaryQuery.data() ?? null,
    summaryLoading: summaryQuery.isLoading,
    refetchSummary: summaryQuery.refetch,
    timeline: () => timelineQuery.data(),
    timelineLoading: timelineQuery.isLoading,
    refetchTimeline: timelineQuery.refetch,
    createStream,
    updateStream,
    requestPayout: requestStreamPayout,
    skipPayout: skipStreamPayout,
  };
};
