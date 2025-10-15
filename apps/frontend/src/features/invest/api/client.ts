import type {
  ApproveInvestmentOrderInput,
  CancelInvestmentOrderInput,
  CreateInvestmentOrderInput,
  InvestmentGuardrailEvaluation,
  InvestmentOrderRecord,
  InvestmentPositionRecord,
  InstrumentSnapshotRecord,
  WatchlistEntryRecord,
} from '@guap/types';
import { guapApi } from '~/shared/services/guapApi';

export const fetchPositions = async (organizationId: string): Promise<InvestmentPositionRecord[]> =>
  await guapApi.investing.listPositions({ organizationId });

export const fetchOrders = async (organizationId: string): Promise<InvestmentOrderRecord[]> =>
  await guapApi.investing.listOrders({
    organizationId,
    limit: 50,
  });

export const fetchWatchlist = async (organizationId: string, profileId: string): Promise<WatchlistEntryRecord[]> =>
  await guapApi.investing.listWatchlist({
    organizationId,
    profileId,
  });

export const fetchGuardrail = async (input: {
  organizationId: string;
  accountId: string;
  symbol?: string;
  instrumentType?: string;
  side?: 'buy' | 'sell';
  notionalCents?: number;
}): Promise<InvestmentGuardrailEvaluation> => {
  return await guapApi.investing.getGuardrail(input);
};

export const submitInvestmentOrder = async (
  input: CreateInvestmentOrderInput
): Promise<InvestmentOrderRecord> => {
  return await guapApi.investing.submitOrder(input);
};

export const approveInvestmentOrder = async (
  input: ApproveInvestmentOrderInput
): Promise<InvestmentOrderRecord> => {
  return await guapApi.investing.approveOrder(input);
};

export const cancelInvestmentOrder = async (
  input: CancelInvestmentOrderInput
): Promise<InvestmentOrderRecord> => {
  return await guapApi.investing.cancelOrder(input);
};

export const upsertWatchlistEntry = async (input: {
  organizationId: string;
  profileId: string;
  symbol: string;
  instrumentType: string;
  notes?: string;
}): Promise<WatchlistEntryRecord> => await guapApi.investing.upsertWatchlist(input);

export const removeWatchlistEntry = async (input: {
  organizationId: string;
  profileId: string;
  symbol: string;
}): Promise<void> => {
  await guapApi.investing.removeWatchlist(input);
};

export const fetchSnapshotsForSymbol = async (symbol: string): Promise<InstrumentSnapshotRecord[]> =>
  await guapApi.investing.listSnapshots({ symbol, limit: 2 });
