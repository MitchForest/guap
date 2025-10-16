import type {
  DonationCause,
  DonationHistoryEntry,
  DonationOverview,
  ScheduleDonationInput,
  ScheduleDonationResult,
} from '@guap/api';
import { guapApi } from '~/shared/services/guapApi';

export const fetchDonationOverview = async (
  organizationId: string,
  options: { historyLimit?: number } = {}
): Promise<DonationOverview> => {
  return await guapApi.donate.overview({
    organizationId,
    historyLimit: options.historyLimit ?? 25,
  });
};

export const fetchDonationCauses = async (organizationId: string): Promise<DonationCause[]> => {
  return await guapApi.donate.listCauses(organizationId);
};

export const fetchDonationHistory = async (
  organizationId: string,
  options: { limit?: number } = {}
): Promise<DonationHistoryEntry[]> => {
  return await guapApi.donate.listHistory({
    organizationId,
    limit: options.limit ?? 50,
  });
};

export const scheduleDonation = async (
  input: ScheduleDonationInput
): Promise<ScheduleDonationResult> => {
  return await guapApi.donate.scheduleDonation(input);
};
