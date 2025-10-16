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
import { IncomeStreamStatusSchema } from '@guap/types';
import { z } from 'zod';
import { guapApi } from '~/shared/services/guapApi';

export const fetchIncomeStreams = async (organizationId: string, status?: z.infer<typeof IncomeStreamStatusSchema>) => {
  return await guapApi.earn.listStreams({
    organizationId,
    status,
  });
};

export const fetchEarnSummary = async (organizationId: string): Promise<EarnSummary> => {
  return await guapApi.earn.summarize(organizationId);
};

export const fetchEarnTimeline = async (organizationId: string, limit = 50): Promise<EarnTimelineEntry[]> => {
  return await guapApi.earn.timeline({ organizationId, limit });
};

export const createIncomeStream = async (input: CreateIncomeStreamInput): Promise<IncomeStreamRecord> => {
  return await guapApi.earn.createStream(input);
};

export const updateIncomeStream = async (input: UpdateIncomeStreamInput): Promise<IncomeStreamRecord> => {
  return await guapApi.earn.updateStream(input);
};

export const requestIncomePayout = async (input: RequestIncomePayoutInput): Promise<EarnPayoutResult> => {
  return await guapApi.earn.requestPayout(input);
};

export const skipIncomePayout = async (input: SkipIncomePayoutInput): Promise<IncomeStreamRecord> => {
  return await guapApi.earn.skipPayout(input);
};
